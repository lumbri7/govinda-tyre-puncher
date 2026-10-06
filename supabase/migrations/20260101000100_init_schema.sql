-- Govinda Tyre Puncture :: core schema
-- Money is stored as numeric(12,2). Timestamps are timestamptz and are always
-- interpreted in the shop timezone (businesses.timezone, default Asia/Kolkata).

-- Enums, the `private` schema and the authorization helpers live in
-- 20260101000000_core_types_and_helpers.sql.

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  bill_prefix text not null default 'GTP' check (bill_prefix ~ '^[A-Z]{2,5}$'),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.businesses is
  'One row per shop. The schema supports more than one shop but the app is built for a single shop.';

-- ---------------------------------------------------------------------------
-- profiles (auth identity mirror, written only by the server)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role public.app_role not null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 60),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets employees.business_id be pinned to the profile's shop by a foreign key.
  unique (id, business_id)
);

create index profiles_business_id_idx on public.profiles (business_id);
create unique index profiles_phone_key on public.profiles (phone) where phone is not null;
create unique index profiles_email_key on public.profiles (lower(email)) where email is not null;

comment on table public.profiles is
  'Role and business membership live here, not in auth.users metadata, so that authorization is server-trusted.';

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  monthly_salary numeric(12, 2) not null default 0 check (monthly_salary >= 0),
  is_active boolean not null default true,
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_business_matches_profile
    foreign key (user_id, business_id) references public.profiles (id, business_id) on delete cascade
);

create unique index employees_user_id_business_key on public.employees (user_id, business_id);
create index employees_business_id_idx on public.employees (business_id);

comment on column public.employees.user_id is 'Supabase Auth user id of the employee login.';

-- ---------------------------------------------------------------------------
-- bills + bill_items
-- ---------------------------------------------------------------------------

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  bill_number text not null check (bill_number ~ '^[A-Z]{2,5}-[0-9]{8}-[0-9]{3,6}$'),
  created_by uuid not null references public.profiles (id),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  vehicle_type public.vehicle_type not null,
  vehicle_number text not null check (vehicle_number ~ '^[A-Z0-9]{4,15}$'),
  customer_phone text check (customer_phone is null or customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  service_total numeric(12, 2) not null default 0 check (service_total >= 0),
  parts_total numeric(12, 2) not null default 0 check (parts_total >= 0),
  custom_items_total numeric(12, 2) not null default 0 check (custom_items_total >= 0),
  grand_total numeric(12, 2) not null default 0 check (grand_total >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, bill_number)
);

create index bills_business_id_idx on public.bills (business_id);
create index bills_created_at_idx on public.bills (created_at desc);
create index bills_created_by_created_at_idx on public.bills (created_by, created_at desc);
create index bills_vehicle_number_idx on public.bills (vehicle_number);
create index bills_business_created_at_idx on public.bills (business_id, created_at desc);

comment on table public.bills is
  'Append-only ledger. Totals are always recalculated by public.create_bill(); direct writes are revoked.';

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  item_type public.bill_item_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  quantity numeric(10, 2) not null check (quantity > 0 and quantity <= 9999),
  unit_price numeric(12, 2) not null check (unit_price >= 0 and unit_price <= 10000000),
  line_total numeric(12, 2) not null check (line_total >= 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index bill_items_bill_id_idx on public.bill_items (bill_id, sort_order);
create index bill_items_business_id_idx on public.bill_items (business_id);

-- Sequential, per-shop per-day bill number counter. Row lock on upsert makes
-- concurrent bill creation safe without trusting any client counter.
create table public.bill_number_counters (
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  last_value integer not null default 0 check (last_value >= 0),
  primary key (business_id, day)
);

-- ---------------------------------------------------------------------------
-- salary_payments
-- ---------------------------------------------------------------------------

create table public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0 and amount <= 10000000),
  payment_date date not null,
  status public.salary_payment_status not null default 'pending',
  acknowledged_at timestamptz,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_payments_acknowledged_only_when_confirmed check (
    (status = 'confirmed' and acknowledged_at is not null) or status <> 'confirmed'
  )
);

create index salary_payments_employee_id_idx on public.salary_payments (employee_id);
create index salary_payments_payment_date_idx on public.salary_payments (payment_date desc);
create index salary_payments_status_idx on public.salary_payments (status) where status = 'pending';
create index salary_payments_business_date_idx on public.salary_payments (business_id, payment_date desc);
create index salary_payments_employee_date_idx on public.salary_payments (employee_id, payment_date desc);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'salary_payment_recorded',
    'salary_payment_accepted',
    'salary_payment_cancelled',
    'employee_joined'
  )),
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 240),
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where is_read = false;

-- ---------------------------------------------------------------------------
-- updated_at maintenance + immutability guards
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function private.set_updated_at();

create trigger salary_payments_set_updated_at
  before update on public.salary_payments
  for each row execute function private.set_updated_at();

-- An employee row can never be re-pointed at a different login or a different
-- shop, and the monthly salary can never be set below what has already been
-- paid out for the current month.
create or replace function private.guard_employee_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_paid numeric;
  v_month date;
begin
  if new.user_id <> old.user_id or new.business_id <> old.business_id then
    raise exception 'Employee login and shop cannot be changed.'
      using errcode = '42501';
  end if;

  if new.monthly_salary <> old.monthly_salary then
    v_month := (current_timestamp at time zone private.business_timezone(old.business_id))::date;
    select coalesce(sum(p.amount), 0)
      into v_paid
      from public.salary_payments p
     where p.employee_id = old.id
       and p.status <> 'cancelled'
       and p.payment_date >= date_trunc('month', v_month)::date
       and p.payment_date < (date_trunc('month', v_month)::date + interval '1 month')::date;

    if new.monthly_salary < v_paid then
      raise exception 'Monthly salary cannot be less than the % already paid this month.', v_paid
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger employees_guard_update
  before update on public.employees
  for each row execute function private.guard_employee_update();

-- Financial ledger rules for salary payments:
--   * amount, employee, date, author and shop can never change
--   * pending -> confirmed is only allowed for the employee the payment belongs to
--   * pending -> cancelled is only allowed for the shop owner
--   * confirmed rows are immutable
create or replace function private.guard_salary_payment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_id <> old.business_id
     or new.employee_id <> old.employee_id
     or new.amount <> old.amount
     or new.payment_date <> old.payment_date
     or new.created_by <> old.created_by then
    raise exception 'Salary payment details cannot be changed.'
      using errcode = '42501';
  end if;

  if new.status = old.status then
    if new.acknowledged_at is distinct from old.acknowledged_at and old.status <> 'pending' then
      raise exception 'Confirmed salary payments cannot be edited.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'This salary payment is already % and cannot be changed.', old.status
      using errcode = '42501';
  end if;

  if new.status = 'confirmed' then
    if (select auth.uid()) is null
       or not exists (
         select 1
           from public.employees e
          where e.id = old.employee_id
            and e.user_id = (select auth.uid())
       ) then
      raise exception 'Only the employee can accept this salary payment.'
        using errcode = '42501';
    end if;
    new.acknowledged_at := now();
  elsif new.status = 'cancelled' then
    if (select auth.uid()) is not null and not private.is_owner_of(old.business_id) then
      raise exception 'Only the shop owner can cancel a salary payment.'
        using errcode = '42501';
    end if;
    new.acknowledged_at := null;
  else
    raise exception 'Unsupported salary payment status.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger salary_payments_guard_update
  before update on public.salary_payments
  for each row execute function private.guard_salary_payment_update();

-- ---------------------------------------------------------------------------
-- Notification fan-out (server side only, no client insert path)
-- ---------------------------------------------------------------------------

create or replace function private.notify_salary_payment_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_shopper text;
begin
  select e.user_id, p.full_name
    into v_recipient, v_shopper
    from public.employees e
    join public.profiles p on p.id = e.user_id
   where e.id = new.employee_id;

  if v_recipient is null then
    return new;
  end if;

  insert into public.notifications (business_id, user_id, type, title, message, related_id)
  values (
    new.business_id,
    v_recipient,
    'salary_payment_recorded',
    'Salary payment',
    format('%s recorded a salary payment of Rs %s for %s. Please accept it.',
           coalesce(v_shopper, 'The owner'),
           trim(to_char(new.amount, 'FM999999990.00')),
           to_char(new.payment_date, 'DD Mon YYYY')),
    new.id
  );

  return new;
end;
$$;

create trigger salary_payments_notify_recorded
  after insert on public.salary_payments
  for each row execute function private.notify_salary_payment_recorded();

create or replace function private.notify_salary_payment_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee text;
begin
  if new.status = 'confirmed' and old.status = 'pending' then
    select p.full_name into v_employee
      from public.employees e
      join public.profiles p on p.id = e.user_id
     where e.id = new.employee_id;

    insert into public.notifications (business_id, user_id, type, title, message, related_id)
    select
      new.business_id,
      o.id,
      'salary_payment_accepted',
      'Salary accepted',
      format('%s accepted a salary payment of Rs %s.',
             coalesce(v_employee, 'An employee'),
             trim(to_char(new.amount, 'FM999999990.00'))),
      new.id
    from public.profiles o
    where o.business_id = new.business_id
      and o.role = 'owner'
      and o.is_active;
  end if;

  return new;
end;
$$;

create trigger salary_payments_notify_accepted
  after update of status on public.salary_payments
  for each row execute function private.notify_salary_payment_accepted();