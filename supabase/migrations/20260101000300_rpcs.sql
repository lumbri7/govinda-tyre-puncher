-- Govinda Tyre Puncture :: write paths
--
-- Every mutation in the app goes through one of these functions. They are
-- SECURITY DEFINER on purpose: the database must be able to recompute money
-- and derive identity from auth.uid() instead of trusting values posted by a
-- client. Each function therefore starts with an explicit authorization check
-- and never accepts a caller id, business id or status as an argument.

-- ---------------------------------------------------------------------------
-- authorization assertions
-- ---------------------------------------------------------------------------

create or replace function private.require_active_user()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'Your account is not active. Please contact the shop owner.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.require_owner()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'Only the shop owner can do this.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.require_employee()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_employee_id() is null then
    raise exception 'Only employees can do this.'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- bill numbers
-- ---------------------------------------------------------------------------

-- Row lock on the upsert makes the counter safe for concurrent bills; the
-- sequence is never derived from anything the client sends.
create or replace function private.next_bill_number(p_business_id uuid, p_prefix text, p_day date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq integer;
begin
  insert into public.bill_number_counters as counter (business_id, day, last_value)
  values (p_business_id, p_day, 1)
  on conflict (business_id, day)
    do update set last_value = counter.last_value + 1
  returning last_value into v_seq;

  return format('%s-%s-%s', upper(p_prefix), to_char(p_day, 'YYYYMMDD'), lpad(v_seq::text, 3, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- owner bootstrap (server/service role only)
-- ---------------------------------------------------------------------------

create or replace function public.bootstrap_owner(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_business_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  perform pg_advisory_xact_lock(20260101);

  if exists (select 1 from public.businesses) then
    raise exception 'This shop is already set up. Please sign in as the owner.'
      using errcode = '23505';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Account was not created.'
      using errcode = '23503';
  end if;

  insert into public.businesses (name)
  values (btrim(p_business_name))
  returning id into v_business;

  insert into public.profiles (id, business_id, role, full_name, email)
  values (p_user_id, v_business, 'owner', btrim(p_full_name), lower(btrim(p_email)));

  return v_business;
end;
$$;

revoke all on function public.bootstrap_owner(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_owner(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------

create or replace function public.create_employee_record(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_monthly_salary numeric,
  p_joined_at date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_name text;
  v_phone text;
  v_salary numeric;
  v_employee uuid;
begin
  perform private.require_owner();

  v_business := private.current_business_id();

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Login could not be created for this employee.'
      using errcode = '23503';
  end if;

  v_name := btrim(coalesce(p_full_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'Employee name is not valid.';
  end if;

  v_phone := nullif(btrim(coalesce(p_phone, '')), '');
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Mobile number is not valid. Use a 10 digit Indian mobile number.';
  end if;

  if exists (select 1 from public.profiles where phone = v_phone) then
    raise exception 'This mobile number is already used by another employee.';
  end if;

  v_salary := round(coalesce(p_monthly_salary, 0), 2);
  if v_salary < 0 or v_salary > 10000000 then
    raise exception 'Monthly salary is not valid.';
  end if;

  insert into public.profiles (id, business_id, role, full_name, phone)
  values (p_user_id, v_business, 'employee', v_name, v_phone);

  insert into public.employees (business_id, user_id, monthly_salary, joined_at)
  values (v_business, p_user_id, v_salary, coalesce(p_joined_at, (now() at time zone private.business_timezone(v_business))::date))
  returning id into v_employee;

  insert into public.notifications (business_id, user_id, type, title, message, related_id)
  values (
    v_business,
    p_user_id,
    'employee_joined',
    'Welcome',
    'Your login is ready. You can start creating bills now.',
    v_employee
  );

  return v_employee;
end;
$$;

create or replace function public.update_employee_record(
  p_employee_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_monthly_salary numeric default null,
  p_joined_at date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_employee public.employees;
  v_profile public.profiles;
  v_name text;
  v_phone text;
  v_salary numeric;
begin
  perform private.require_owner();

  v_business := private.current_business_id();

  select * into v_employee
    from public.employees
   where id = p_employee_id and business_id = v_business;
  if not found then
    raise exception 'Employee not found.' using errcode = 'P0002';
  end if;

  select * into v_profile from public.profiles where id = v_employee.user_id;

  if p_full_name is not null then
    v_name := btrim(p_full_name);
    if char_length(v_name) < 2 or char_length(v_name) > 60 then
      raise exception 'Employee name is not valid.';
    end if;
    update public.profiles set full_name = v_name where id = v_employee.user_id;
  end if;

  if p_phone is not null then
    v_phone := btrim(p_phone);
    if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception 'Mobile number is not valid. Use a 10 digit Indian mobile number.';
    end if;
    if exists (select 1 from public.profiles where phone = v_phone and id <> v_employee.user_id) then
      raise exception 'This mobile number is already used by another employee.';
    end if;
    update public.profiles set phone = v_phone where id = v_employee.user_id;
  end if;

  if p_monthly_salary is not null then
    v_salary := round(p_monthly_salary, 2);
    if v_salary < 0 or v_salary > 10000000 then
      raise exception 'Monthly salary is not valid.';
    end if;
    update public.employees set monthly_salary = v_salary where id = p_employee_id;
  end if;

  if p_joined_at is not null then
    update public.employees set joined_at = p_joined_at where id = p_employee_id;
  end if;
end;
$$;

create or replace function public.set_employee_active(p_employee_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  perform private.require_owner();

  v_business := private.current_business_id();

  if not exists (
    select 1 from public.employees
     where id = p_employee_id and business_id = v_business
  ) then
    raise exception 'Employee not found.' using errcode = 'P0002';
  end if;

  update public.employees
     set is_active = p_is_active
   where id = p_employee_id and business_id = v_business;

  update public.profiles p
     set is_active = p_is_active
    from public.employees e
   where e.id = p_employee_id and p.id = e.user_id;
end;
$$;

create or replace function public.update_business(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform private.require_owner();

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Shop name is not valid.';
  end if;

  update public.businesses
     set name = v_name
   where id = private.current_business_id();
end;
$$;

-- ---------------------------------------------------------------------------
-- billing
-- ---------------------------------------------------------------------------

create or replace function public.create_bill(
  p_customer_name text,
  p_vehicle_type text,
  p_vehicle_number text,
  p_items jsonb,
  p_customer_phone text default null
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_business uuid;
  v_prefix text;
  v_tz text;
  v_day date;
  v_bill public.bills;
  v_customer text;
  v_vehicle_type public.vehicle_type;
  v_vehicle text;
  v_phone text;
  v_item jsonb;
  v_item_type text;
  v_name text;
  v_qty numeric;
  v_price numeric;
  v_line numeric;
  v_service numeric := 0;
  v_parts numeric := 0;
  v_custom numeric := 0;
  v_seen int := 0;
begin
  perform private.require_active_user();

  v_business := private.current_business_id();
  if v_business is null then
    raise exception 'Your account is not linked to a shop.' using errcode = '42501';
  end if;

  v_customer := btrim(coalesce(p_customer_name, ''));
  if char_length(v_customer) < 1 or char_length(v_customer) > 80 then
    raise exception 'Customer name is required.';
  end if;

  if coalesce(p_vehicle_type, '') not in ('bike', 'car', 'small_truck', 'large_truck', 'tractor', 'other') then
    raise exception 'Please choose the vehicle type.';
  end if;
  v_vehicle_type := p_vehicle_type::public.vehicle_type;

  v_vehicle := upper(regexp_replace(coalesce(p_vehicle_number, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(v_vehicle) < 4 or char_length(v_vehicle) > 15 then
    raise exception 'Vehicle number is not valid.';
  end if;

  v_phone := nullif(btrim(coalesce(p_customer_phone, '')), '');
  if v_phone is not null then
    v_phone := regexp_replace(v_phone, '[^0-9+]', '', 'g');
    v_phone := regexp_replace(v_phone, '^\+?91', '');
    v_phone := regexp_replace(v_phone, '^0+', '');
    if v_phone !~ '^[0-9]{10}$' then
      raise exception 'Mobile number is not valid.';
    end if;
    v_phone := '+91' || v_phone;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'No items were added to the bill.';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item to the bill.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'A bill can have at most 50 items.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_type := coalesce(v_item ->> 'item_type', '');
    if v_item_type not in ('service', 'part', 'custom') then
      raise exception 'Unknown item type.';
    end if;

    v_name := btrim(coalesce(v_item ->> 'name', ''));
    if char_length(v_name) < 1 or char_length(v_name) > 60 then
      raise exception 'Item name is required.';
    end if;

    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then
      raise exception 'Quantity is not valid for % .', v_name;
    end if;
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty <= 0 or v_qty > 9999 then
      raise exception 'Quantity is not valid for % .', v_name;
    end if;

    if coalesce(v_item ->> 'unit_price', '') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' then
      raise exception 'Price is not valid for % .', v_name;
    end if;
    v_price := (v_item ->> 'unit_price')::numeric;
    if v_price < 0 or v_price > 10000000 then
      raise exception 'Price is not valid for % .', v_name;
    end if;

    v_line := round(v_qty * v_price, 2);
    v_seen := v_seen + 1;

    if v_item_type = 'service' then
      v_service := v_service + v_line;
    elsif v_item_type = 'part' then
      v_parts := v_parts + v_line;
    else
      v_custom := v_custom + v_line;
    end if;
  end loop;

  if v_seen = 0 then
    raise exception 'Add at least one item to the bill.';
  end if;

  v_tz := private.business_timezone(v_business);
  select b.bill_prefix into v_prefix from public.businesses b where b.id = v_business;
  v_day := (now() at time zone v_tz)::date;

  insert into public.bills (
    business_id,
    bill_number,
    created_by,
    customer_name,
    vehicle_type,
    vehicle_number,
    customer_phone,
    service_total,
    parts_total,
    custom_items_total,
    grand_total
  )
  values (
    v_business,
    private.next_bill_number(v_business, v_prefix, v_day),
    v_actor,
    v_customer,
    v_vehicle_type,
    v_vehicle,
    v_phone,
    v_service,
    v_parts,
    v_custom,
    v_service + v_parts + v_custom
  )
  returning * into v_bill;

  insert into public.bill_items (bill_id, business_id, item_type, name, quantity, unit_price, line_total, sort_order)
  select
    v_bill.id,
    v_business,
    (entry ->> 'item_type')::public.bill_item_type,
    btrim(entry ->> 'name'),
    (entry ->> 'quantity')::numeric,
    (entry ->> 'unit_price')::numeric,
    round(((entry ->> 'quantity')::numeric) * ((entry ->> 'unit_price')::numeric), 2),
    (ordinal - 1)::smallint
  from jsonb_array_elements(p_items) with ordinality as items(entry, ordinal);

  return v_bill;
end;
$$;

-- ---------------------------------------------------------------------------
-- salary
-- ---------------------------------------------------------------------------

create or replace function public.record_salary_payment(
  p_employee_id uuid,
  p_amount numeric,
  p_payment_date date default null,
  p_note text default null
)
returns public.salary_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_tz text;
  v_today date;
  v_month date;
  v_salary numeric;
  v_amount numeric;
  v_date date;
  v_note text;
  v_paid numeric;
  v_payment public.salary_payments;
begin
  perform private.require_owner();

  v_business := private.current_business_id();
  v_tz := private.business_timezone(v_business);
  v_today := (now() at time zone v_tz)::date;

  select e.monthly_salary into v_salary
    from public.employees e
   where e.id = p_employee_id and e.business_id = v_business;
  if not found then
    raise exception 'Employee not found.' using errcode = 'P0002';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 or v_amount > 10000000 then
    raise exception 'Enter a valid amount.';
  end if;

  v_date := coalesce(p_payment_date, v_today);
  if v_date < date '2000-01-01' or v_date > v_today + 1 then
    raise exception 'Payment date is not valid.';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'Note is too long.';
  end if;

  v_month := date_trunc('month', v_date)::date;

  select coalesce(sum(sp.amount), 0) into v_paid
    from public.salary_payments sp
   where sp.employee_id = p_employee_id
     and sp.status <> 'cancelled'
     and sp.payment_date >= v_month
     and sp.payment_date < (v_month + interval '1 month')::date;

  if v_paid + v_amount > v_salary then
    raise exception 'This is more than the remaining salary of Rs % for % .',
      trim(to_char(greatest(v_salary - v_paid, 0), 'FM999999990.00')),
      to_char(v_month, 'FMMonth YYYY');
  end if;

  insert into public.salary_payments (business_id, employee_id, amount, payment_date, note, created_by)
  values (v_business, p_employee_id, v_amount, v_date, v_note, (select auth.uid()))
  returning * into v_payment;

  return v_payment;
end;
$$;

create or replace function public.accept_salary_payment(p_payment_id uuid)
returns public.salary_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee uuid;
  v_payment public.salary_payments;
begin
  perform private.require_employee();

  v_employee := private.current_employee_id();

  update public.salary_payments
     set status = 'confirmed'
   where id = p_payment_id
     and employee_id = v_employee
     and status = 'pending'
  returning * into v_payment;

  if not found then
    raise exception 'This salary payment is not waiting for your acceptance.';
  end if;

  return v_payment;
end;
$$;

create or replace function public.cancel_salary_payment(p_payment_id uuid, p_note text default null)
returns public.salary_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_note text;
  v_payment public.salary_payments;
begin
  perform private.require_owner();

  v_business := private.current_business_id();

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'Note is too long.';
  end if;

  update public.salary_payments
     set status = 'cancelled',
         note = coalesce(v_note, note)
   where id = p_payment_id
     and business_id = v_business
     and status = 'pending'
  returning * into v_payment;

  if not found then
    raise exception 'Only a payment waiting for acceptance can be cancelled.';
  end if;

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- reporting (owner only, aggregated in the database)
-- ---------------------------------------------------------------------------

create or replace function public.sales_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_created_by uuid default null
)
returns table (
  total_sales numeric,
  bill_count bigint,
  service_revenue numeric,
  parts_revenue numeric,
  custom_revenue numeric,
  average_bill numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();

  return query
  select
    coalesce(sum(b.grand_total), 0),
    count(*),
    coalesce(sum(b.service_total), 0),
    coalesce(sum(b.parts_total), 0),
    coalesce(sum(b.custom_items_total), 0),
    coalesce(round(avg(b.grand_total), 2), 0)
  from public.bills b
  where b.business_id = private.current_business_id()
    and b.created_at >= p_from
    and b.created_at < p_to
    and (p_created_by is null or b.created_by = p_created_by);
end;
$$;

create or replace function public.sales_by_day(
  p_from timestamptz,
  p_to timestamptz,
  p_created_by uuid default null
)
returns table (
  day date,
  total_sales numeric,
  bill_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();

  return query
  select
    (b.created_at at time zone private.business_timezone(b.business_id))::date as day,
    sum(b.grand_total),
    count(*)
  from public.bills b
  where b.business_id = private.current_business_id()
    and b.created_at >= p_from
    and b.created_at < p_to
    and (p_created_by is null or b.created_by = p_created_by)
  group by 1
  order by 1;
end;
$$;

create or replace function public.salary_overview(p_month date)
returns table (
  employee_id uuid,
  full_name text,
  phone text,
  is_active boolean,
  monthly_salary numeric,
  paid numeric,
  remaining numeric,
  pending_acknowledgements bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_start date;
  v_end date;
begin
  perform private.require_owner();

  v_business := private.current_business_id();
  v_start := date_trunc('month', coalesce(p_month, current_date))::date;
  v_end := (v_start + interval '1 month')::date;

  return query
  select
    e.id,
    p.full_name,
    p.phone,
    e.is_active,
    e.monthly_salary,
    coalesce(pay.paid, 0),
    greatest(e.monthly_salary - coalesce(pay.paid, 0), 0),
    coalesce(pend.count, 0)
  from public.employees e
  join public.profiles p on p.id = e.user_id
  left join lateral (
    select sum(sp.amount) as paid
      from public.salary_payments sp
     where sp.employee_id = e.id
       and sp.status <> 'cancelled'
       and sp.payment_date >= v_start
       and sp.payment_date < v_end
  ) pay on true
  left join lateral (
    select count(*) as count
      from public.salary_payments sp
     where sp.employee_id = e.id
       and sp.status = 'pending'
  ) pend on true
  where e.business_id = v_business
  order by p.full_name;
end;
$$;

create or replace function public.my_salary_summary(p_month date default null)
returns table (
  monthly_salary numeric,
  paid numeric,
  remaining numeric,
  pending_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employee public.employees;
  v_tz text;
  v_start date;
  v_end date;
  v_paid numeric;
  v_pending bigint;
begin
  perform private.require_employee();

  select * into v_employee
    from public.employees
   where user_id = (select auth.uid());
  if not found then
    raise exception 'Salary details are not available for your account.'
      using errcode = 'P0002';
  end if;

  v_tz := private.business_timezone(v_employee.business_id);
  v_start := date_trunc('month', coalesce(p_month, (now() at time zone v_tz)::date))::date;
  v_end := (v_start + interval '1 month')::date;

  select
    coalesce(sum(sp.amount) filter (where sp.status <> 'cancelled'), 0),
    count(*) filter (where sp.status = 'pending')
  into v_paid, v_pending
  from public.salary_payments sp
  where sp.employee_id = v_employee.id
    and sp.payment_date >= v_start
    and sp.payment_date < v_end;

  return query
  select
    v_employee.monthly_salary,
    v_paid,
    greatest(v_employee.monthly_salary - v_paid, 0),
    v_pending;
end;
$$;

-- ---------------------------------------------------------------------------
-- grants: server actions call these as the signed-in user
-- ---------------------------------------------------------------------------

revoke all on function
  public.create_employee_record(uuid, text, text, numeric, date),
  public.update_business(text),
  public.update_employee_record(uuid, text, text, numeric, date),
  public.set_employee_active(uuid, boolean),
  public.create_bill(text, text, text, jsonb, text),
  public.record_salary_payment(uuid, numeric, date, text),
  public.accept_salary_payment(uuid),
  public.cancel_salary_payment(uuid, text),
  public.sales_summary(timestamptz, timestamptz, uuid),
  public.sales_by_day(timestamptz, timestamptz, uuid),
  public.salary_overview(date),
  public.my_salary_summary(date)
  from public, anon;

grant execute on function
  public.create_employee_record(uuid, text, text, numeric, date),
  public.update_business(text),
  public.update_employee_record(uuid, text, text, numeric, date),
  public.set_employee_active(uuid, boolean),
  public.create_bill(text, text, text, jsonb, text),
  public.record_salary_payment(uuid, numeric, date, text),
  public.accept_salary_payment(uuid),
  public.cancel_salary_payment(uuid, text),
  public.sales_summary(timestamptz, timestamptz, uuid),
  public.sales_by_day(timestamptz, timestamptz, uuid),
  public.salary_overview(date),
  public.my_salary_summary(date)
  to authenticated, service_role;

revoke all on function private.next_bill_number(uuid, text, date) from public, anon;
grant execute on function private.next_bill_number(uuid, text, date) to service_role;
grant execute on function
  private.require_active_user(),
  private.require_owner(),
  private.require_employee(),
  private.set_updated_at()
  to authenticated, service_role;