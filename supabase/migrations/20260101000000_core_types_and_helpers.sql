-- Govinda Tyre Puncture :: enums + private helper functions
--
-- The functions in the `private` schema are the single trust anchor for
-- authorization. They are SECURITY DEFINER so that RLS policies can ask
-- "who is calling?" without recursing through the profiles table, and they are
-- granted only to `authenticated` (never to `anon`).

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum ('owner', 'employee');

create type public.vehicle_type as enum (
  'bike',
  'car',
  'small_truck',
  'large_truck',
  'tractor',
  'other'
);

create type public.bill_item_type as enum ('service', 'part', 'custom');

create type public.salary_payment_status as enum ('pending', 'confirmed', 'cancelled');

revoke all on type public.app_role from public;
revoke all on type public.vehicle_type from public;
revoke all on type public.bill_item_type from public;
revoke all on type public.salary_payment_status from public;

-- Shop timezone, used for day/month boundaries in reports.
create or replace function private.business_timezone(p_business_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(
    (select b.timezone from public.businesses b where b.id = p_business_id),
    'Asia/Kolkata'
  );
end;
$$;

-- The caller's business id, taken from the profiles row that only the server writes.
create or replace function private.current_business_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select p.business_id into v_business_id
    from public.profiles p
   where p.id = (select auth.uid());
  return v_business_id;
end;
$$;

create or replace function private.current_role()
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  select p.role into v_role
    from public.profiles p
   where p.id = (select auth.uid());
  return v_role;
end;
$$;

-- An active profile is required for every read and every write.
create or replace function private.is_active_user()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.is_active
  );
end;
$$;

create or replace function private.is_owner()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.role = 'owner'
       and p.is_active
  );
end;
$$;

create or replace function private.is_owner_of(p_business_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.role = 'owner'
       and p.is_active
       and p.business_id = p_business_id
  );
end;
$$;

-- employees.id of the caller, or null when the caller is the owner or has
-- been disabled by the owner.
create or replace function private.current_employee_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (
    select e.id
      from public.employees e
      join public.profiles p on p.id = e.user_id
     where e.user_id = (select auth.uid())
       and e.is_active
       and p.is_active
  );
end;
$$;

-- True when the caller is an owner of the shop the given employee belongs to.
create or replace function private.is_owner_of_employee(p_employee_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.employees e
     where e.id = p_employee_id
       and private.is_owner_of(e.business_id)
  );
end;
$$;

grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on all functions in schema private from anon;