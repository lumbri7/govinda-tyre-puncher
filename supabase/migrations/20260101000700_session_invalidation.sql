-- ---------------------------------------------------------------------------
-- Ending every session when a password changes
-- ---------------------------------------------------------------------------
-- Changing a password does not end the sessions that Auth has already handed
-- out: the access token in the cookie stays valid until it expires, and a
-- refresh token that was copied before the change still works. An owner
-- resetting a forgotten password is told "they have been signed out of every
-- device", so that has to be true immediately, not an hour later.
--
-- Supabase has no session version inside the JWT to check, so the app records
-- the moment sessions stopped being valid and refuses anything issued before
-- it. `src/lib/auth.ts` and `src/lib/supabase/proxy.ts` both compare this
-- against the token's own `iat`, and the proxy drops the cookies so the dead
-- session cannot be replayed on later requests.
--
-- Only service role writes the column: `authenticated` has an update grant on
-- `full_name` alone (see 00200), so a stolen session cannot move the mark to
-- make itself valid again.
alter table public.profiles
  add column if not exists session_invalid_before timestamptz;

comment on column public.profiles.session_invalid_before is
  'Sessions issued at or before this moment are refused. Set when a password changes.';

-- Nothing to grant, but say so out loud: a later migration that hands
-- authenticated a wider update grant must not quietly open this up.
do $$
begin
  if exists (
    select 1
    from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'session_invalid_before'
      and privilege_type = 'UPDATE'
  ) then
    raise exception 'authenticated must not be able to update profiles.session_invalid_before';
  end if;
end
$$;