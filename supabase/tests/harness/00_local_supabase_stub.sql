-- Local test harness ONLY. Never run this against a Supabase project.
--
-- Supabase already provides the auth schema, auth.uid(), and the anon /
-- authenticated / service_role roles. A plain PostgreSQL server does not, so
-- this file recreates just enough of that surface to run the app migrations
-- and exercise the RLS policies locally with `tests/rls/run.sh`.

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Mirror of what PostgREST does per request: set the JWT claims for the role
-- currently impersonated, then reset.
create or replace function auth.set_claims(p_sub uuid, p_role text)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), false),
         set_config('request.jwt.claim.role', coalesce(p_role, 'anon'), false);
$$;

grant execute on function auth.set_claims(uuid, text) to postgres;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;