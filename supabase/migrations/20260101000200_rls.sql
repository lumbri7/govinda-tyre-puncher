-- Govinda Tyre Puncture :: row level security
--
-- Read access is enforced by RLS policies. Write access is intentionally NOT
-- granted to authenticated: every mutation goes through a `security definer`
-- RPC in 20260101000300_rpcs.sql which re-derives the caller's identity from
-- auth.uid() and validates the input. That keeps a single audited write path
-- and makes it impossible to post a bill with hand-crafted totals.

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.bill_number_counters enable row level security;
alter table public.salary_payments enable row level security;
alter table public.notifications enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

grant select on public.businesses to authenticated;

create policy businesses_select_own
  on public.businesses
  for select
  to authenticated
  using (private.is_active_user() and id = private.current_business_id());

create policy businesses_update_owner
  on public.businesses
  for update
  to authenticated
  using (private.is_owner_of(id))
  with check (private.is_owner_of(id));

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

grant select on public.profiles to authenticated;
-- Employees may correct their own spelling of their name. Role, shop, phone and
-- active flag stay under owner/server control (column grant + trigger).
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select_self_or_owner
  on public.profiles
  for select
  to authenticated
  using (private.is_active_user() and (id = (select auth.uid()) or private.is_owner_of(business_id)));

create policy profiles_update_self_or_owner
  on public.profiles
  for update
  to authenticated
  using (private.is_active_user() and (id = (select auth.uid()) or private.is_owner_of(business_id)))
  with check (id = (select auth.uid()) or private.is_owner_of(business_id));

create policy profiles_insert_owner_only
  on public.profiles
  for insert
  to authenticated
  with check (private.is_owner() and private.is_owner_of(business_id) and role = 'employee');

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------

grant select on public.employees to authenticated;

create policy employees_select_self_or_owner
  on public.employees
  for select
  to authenticated
  using (
    private.is_active_user()
    and (
      user_id = (select auth.uid())
      or private.is_owner_of(business_id)
    )
  );

-- ---------------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------------

grant select on public.bills to authenticated;

create policy bills_select_self_or_owner
  on public.bills
  for select
  to authenticated
  using (
    private.is_active_user()
    and (
      created_by = (select auth.uid())
      or private.is_owner_of(business_id)
    )
  );

-- ---------------------------------------------------------------------------
-- bill_items
-- ---------------------------------------------------------------------------

grant select on public.bill_items to authenticated;

create policy bill_items_select_via_bill
  on public.bill_items
  for select
  to authenticated
  using (
    private.is_active_user()
    and exists (
      select 1
        from public.bills b
       where b.id = bill_items.bill_id
         and (
           b.created_by = (select auth.uid())
           or private.is_owner_of(b.business_id)
         )
    )
  );

-- ---------------------------------------------------------------------------
-- bill_number_counters: service/RPC only, no client access at all.
-- ---------------------------------------------------------------------------

revoke all on public.bill_number_counters from anon, authenticated;

-- ---------------------------------------------------------------------------
-- salary_payments
-- ---------------------------------------------------------------------------

grant select on public.salary_payments to authenticated;

create policy salary_payments_select_self_or_owner
  on public.salary_payments
  for select
  to authenticated
  using (
    private.is_active_user()
    and (
      private.is_owner_of(business_id)
      or exists (
        select 1
          from public.employees e
         where e.id = salary_payments.employee_id
           and e.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (private.is_active_user() and user_id = (select auth.uid()));

create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (private.is_active_user() and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.salary_payments;