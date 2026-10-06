-- Govinda Tyre Puncture
--
-- Employee sign in moved from Supabase phone auth to an internal email
-- identity (see src/lib/employee-identity.ts): the employee still types their
-- mobile number, the server maps it to the login, and Supabase Auth only ever
-- sees an address in the reserved `auth.govindatyrepuncture.internal` domain.
--
-- That mapping needs a phone -> Auth user id lookup, which has to happen before
-- anyone has signed in. It cannot be a table read: row level security would
-- block an anonymous visitor, and a view or function open to `anon` would let
-- anyone holding the publishable key probe which numbers exist.
--
-- So it is a security definer function that is executable by `service_role`
-- only. The login server action reaches it through the privileged server
-- client; nobody can call it with the browser key, and it returns a uuid or
-- nothing at all.

create or replace function public.employee_auth_user_id(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.user_id
  from public.employees e
  join public.profiles p on p.id = e.user_id
  where p.phone = nullif(btrim(coalesce(p_phone, '')), '')
    and p.is_active
    and e.is_active
  limit 1;
$$;

comment on function public.employee_auth_user_id(text) is
  'Auth user id for an active employee with this exact phone, or null. service_role only: it runs before sign in, when the caller has no role yet.';

revoke all on function public.employee_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.employee_auth_user_id(text) to service_role;