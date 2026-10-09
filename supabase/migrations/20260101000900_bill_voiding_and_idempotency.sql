-- Govinda Tyre Puncture
--
-- Three gaps found while making the shop production-ready:
--
--   1. A wrong bill was permanent. Owners can now void a bill: a reversible
--      recording of "this never happened", kept as columns on the row itself so
--      the paper trail survives (unlike a delete) and every sales figure knows
--      to leave it out.
--
--   2. The printed receipt says "Serviced by <name>", but an employee could not
--      read the creator's name through RLS, so their PDFs were missing the line.
--      `serviced_by` is snapshotted on the bill by `create_bill` instead; a
--      later rename never changes what is already on paper.
--
--   3. A double tap, or a retry after a flaky network, could save the same bill
--      or the same salary payment twice. A key the form generates lets a replay
--      return the row it already created instead of writing another one.

begin;

-- ---------------------------------------------------------------------------
-- bills: voiding, idempotency and the serviced-by snapshot
-- ---------------------------------------------------------------------------

alter table public.bills
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id) on delete set null,
  add column if not exists void_reason text check (
    void_reason is null or char_length(btrim(void_reason)) between 1 and 240
  ),
  add column if not exists idempotency_key text check (
    idempotency_key is null or char_length(idempotency_key) between 1 and 64
  ),
  add column if not exists serviced_by text check (
    serviced_by is null or char_length(btrim(serviced_by)) between 1 and 60
  );

comment on column public.bills.voided_at is
  'Set when the owner voids this bill. Voided bills never count in sales figures.';
comment on column public.bills.voided_by is 'Owner profile that voided the bill.';
comment on column public.bills.void_reason is 'What the owner typed when voiding.';
comment on column public.bills.idempotency_key is
  'Client-supplied key that makes a retried submit return the same bill.';
comment on column public.bills.serviced_by is
  'Employee name at the moment the bill was saved, so printed copies stay accurate after a rename.';

create unique index if not exists bills_idempotency_key_uq
  on public.bills (business_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists bills_voided_at_idx
  on public.bills (voided_at)
  where voided_at is not null;

-- Back-fill the employee name for bills created before this migration. A
-- rename after this point does not reach already-printed paper anyway.
update public.bills b
   set serviced_by = p.full_name
  from public.profiles p
 where p.id = b.created_by
   and b.serviced_by is null;

-- ---------------------------------------------------------------------------
-- salary_payments: idempotency
-- ---------------------------------------------------------------------------

alter table public.salary_payments
  add column if not exists idempotency_key text check (
    idempotency_key is null or char_length(idempotency_key) between 1 and 64
  );

comment on column public.salary_payments.idempotency_key is
  'Client-supplied key that makes a retried salary payment return the same row.';

create unique index if not exists salary_payments_idempotency_key_uq
  on public.salary_payments (business_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- create_bill: idempotency + the serviced-by snapshot
-- ---------------------------------------------------------------------------

-- The argument list changes, so this is a new overload; the six argument
-- version from 000500 is dropped so there is only one way in.
drop function if exists public.create_bill(text, text, text, jsonb, text, text);

create or replace function public.create_bill(
  p_customer_name text,
  p_vehicle_type text,
  p_vehicle_number text,
  p_items jsonb,
  p_customer_phone text default null,
  p_vehicle_description text default null,
  p_idempotency_key text default null
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_business uuid;
  v_prefix text;
  v_tz text;
  v_day date;
  v_bill public.bills;
  v_existing public.bills;
  v_customer text;
  v_vehicle_type public.vehicle_type;
  v_vehicle text;
  v_description text;
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

  -- A retried submit asks the same question and must get the same bill, not a
  -- second one. This guard runs before the number counter is touched.
  if p_idempotency_key is not null then
    if char_length(p_idempotency_key) > 64 then
      raise exception 'The bill could not be saved. Please try again.';
    end if;
    select * into v_existing
      from public.bills b
     where b.business_id = v_business
       and b.idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
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

  -- Only "other" carries a description, so the check constraint holds whatever
  -- the client sends.
  v_description := nullif(btrim(coalesce(p_vehicle_description, '')), '');
  if v_vehicle_type = 'other' then
    if v_description is null then
      raise exception 'Describe the vehicle.';
    end if;
    if char_length(v_description) > 80 then
      raise exception 'That vehicle description is too long.';
    end if;
  else
    v_description := null;
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

  select p.full_name into v_actor_name from public.profiles p where p.id = v_actor;

  insert into public.bills (
    business_id,
    bill_number,
    created_by,
    customer_name,
    vehicle_type,
    vehicle_number,
    vehicle_description,
    customer_phone,
    service_total,
    parts_total,
    custom_items_total,
    grand_total,
    idempotency_key,
    serviced_by
  )
  values (
    v_business,
    private.next_bill_number(v_business, v_prefix, v_day),
    v_actor,
    v_customer,
    v_vehicle_type,
    v_vehicle,
    v_description,
    v_phone,
    v_service,
    v_parts,
    v_custom,
    v_service + v_parts + v_custom,
    nullif(p_idempotency_key, ''),
    nullif(v_actor_name, '')
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

exception
  -- Two submissions with the same key can race: both pass the select above,
  -- one wins the insert, the other trips the unique index. The loser returns
  -- what the winner wrote, so the outcome is still a single bill.
  when unique_violation then
    if p_idempotency_key is not null then
      select * into v_existing
        from public.bills b
       where b.business_id = v_business
         and b.idempotency_key = p_idempotency_key;
      if found then
        return v_existing;
      end if;
    end if;
    raise exception 'Could not save the bill. Please try again.' using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------------
-- record_salary_payment: idempotency
-- ---------------------------------------------------------------------------

drop function if exists public.record_salary_payment(uuid, numeric, date, text);

create or replace function public.record_salary_payment(
  p_employee_id uuid,
  p_amount numeric,
  p_payment_date date default null,
  p_note text default null,
  p_idempotency_key text default null
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
  v_existing public.salary_payments;
begin
  perform private.require_owner();

  v_business := private.current_business_id();

  -- The owner's "Record payment" button knows what it is asking for; a retry
  -- after a slow network must come back with the payment it already made.
  if p_idempotency_key is not null then
    if char_length(p_idempotency_key) > 64 then
      raise exception 'The payment could not be recorded. Please try again.';
    end if;
    select * into v_existing
      from public.salary_payments sp
     where sp.business_id = v_business
       and sp.idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

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
    raise exception 'This is more than the remaining salary of % for % .',
      private.format_rupees(greatest(v_salary - v_paid, 0)),
      to_char(v_month, 'FMMonth YYYY');
  end if;

  insert into public.salary_payments (business_id, employee_id, amount, payment_date, note, created_by, idempotency_key)
  values (v_business, p_employee_id, v_amount, v_date, v_note, (select auth.uid()), nullif(p_idempotency_key, ''))
  returning * into v_payment;

  return v_payment;

exception
  when unique_violation then
    if p_idempotency_key is not null then
      select * into v_existing
        from public.salary_payments sp
       where sp.business_id = v_business
         and sp.idempotency_key = p_idempotency_key;
      if found then
        return v_existing;
      end if;
    end if;
    raise exception 'The payment could not be recorded. Please try again.' using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------------
-- void_bill
-- ---------------------------------------------------------------------------

create or replace function public.void_bill(
  p_bill_id uuid,
  p_reason text default null
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text;
  v_bill public.bills;
  v_owner bool;
begin
  perform private.require_owner();

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) > 240 then
    raise exception 'Enter a reason for voiding this bill.';
  end if;

  update public.bills
     set voided_at = now(),
         voided_by = v_actor,
         void_reason = v_reason
   where id = p_bill_id
     and business_id = private.current_business_id()
     and voided_at is null
  returning * into v_bill;

  if not found then
    select exists (
      select 1
        from public.bills
       where id = p_bill_id
         and business_id = private.current_business_id()
    ) into v_owner;
    if not v_owner then
      raise exception 'Bill not found.' using errcode = 'P0002';
    end if;
    raise exception 'This bill has already been voided.';
  end if;

  return v_bill;
end;
$$;

comment on function public.void_bill(uuid, text) is
  'Owner-only: marks a bill as voided at this moment. The row and its lines stay for the paper trail; every sales figure excludes voided bills.';

-- ---------------------------------------------------------------------------
-- sales reports: leave voided bills out
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
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  perform private.require_owner();
  v_business := private.current_business_id();

if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Report window is not valid.'
      using errcode = 'P0002';
  end if;

  return query
    select
      coalesce(sum(b.grand_total), 0),
      count(*)::bigint,
      coalesce(sum(b.service_total), 0),
      coalesce(sum(b.parts_total), 0),
      coalesce(sum(b.custom_items_total), 0),
      case when count(*) = 0 then 0 else round(sum(b.grand_total) / count(*), 2) end
    from public.bills b
    where b.business_id = v_business
      and b.created_at >= p_from
      and b.created_at < p_to
      and b.voided_at is null
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
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_tz text;
begin
  perform private.require_owner();
  v_business := private.current_business_id();
  v_tz := private.business_timezone(v_business);

if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Report window is not valid.'
      using errcode = 'P0002';
  end if;

  return query
    select
      (b.created_at at time zone v_tz)::date,
      sum(b.grand_total),
      count(*)
    from public.bills b
    where b.business_id = v_business
      and b.created_at >= p_from
      and b.created_at < p_to
      and b.voided_at is null
      and (p_created_by is null or b.created_by = p_created_by)
    group by (b.created_at at time zone v_tz)::date
    order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- grants: server actions call these as the signed-in user
-- ---------------------------------------------------------------------------

revoke all on function public.create_bill(text, text, text, jsonb, text, text, text) from public, anon;
revoke all on function public.record_salary_payment(uuid, numeric, date, text, text) from public, anon;
revoke all on function public.void_bill(uuid, text) from public, anon;

grant execute on function
  public.create_bill(text, text, text, jsonb, text, text, text),
  public.record_salary_payment(uuid, numeric, date, text, text),
  public.void_bill(uuid, text)
  to authenticated, service_role;

-- The functions these replaced were dropped above, which also dropped their
-- grants, so nothing old keeps a way in.

do $$
begin
  if exists (
    select 1
    from information_schema.routine_privileges
    where privilege_type = 'EXECUTE'
      and specific_schema = 'public'
      and specific_name like 'sales_summary%'
      and grantee in ('anon', 'public')
  ) then
    raise exception 'anon/public must not be able to run sales_summary';
  end if;
end;
$$;

commit;