-- Harden private.is_active_user(): require BOTH an active profile and, for
-- employees, an active employee record.
--
-- private.set_employee_active() flips both flags, but any future code path that
-- only touches one of them (a manual fix, an import, an admin panel) would
-- otherwise leave a half active account able to read and write data.

create or replace function private.is_active_user()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
      from public.profiles p
     where p.id = (select auth.uid())
       and p.is_active
       and (
         p.role = 'owner'
         or exists (
           select 1
             from public.employees e
            where e.user_id = p.id
              and e.is_active
         )
       )
  );
end;
$$;