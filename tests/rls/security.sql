-- Govinda Tyre Puncture :: database security tests
--
-- Runs the whole flow as three different database roles (owner, employee Ravi,
-- employee Suresh) plus a logged-out visitor and asserts that every
-- unauthorized read and write is rejected by the database itself.
--
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/rls/security.sql
-- (tests/rls/run.sh applies the harness stub + migrations first)

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, phone) values
  ('11111111-1111-1111-1111-111111111111', 'govinda@govindytyre.test', '+919000000001'),
  ('22222222-2222-2222-2222-222222222222', null, '+919000000002'),
  ('33333333-3333-3333-3333-333333333333', null, '+919000000003');

select public.bootstrap_owner(
  '11111111-1111-1111-1111-111111111111',
  'Govinda',
  'govinda@govindytyre.test',
  'Govinda Tyre Puncture'
) as business \gset

set role authenticated;
select auth.set_claims('11111111-1111-1111-1111-111111111111', 'authenticated');

select public.create_employee_record(
  '22222222-2222-2222-2222-222222222222', 'Ravi', '+919000000002', 18000, current_date
) as ravi_id \gset

select public.create_employee_record(
  '33333333-3333-3333-3333-333333333333', 'Suresh', '+919000000003', 15000, current_date
) as suresh_id \gset

reset role;

-- Ravi bills a bike: 2 service lines, 2 parts, 1 custom item.
set role authenticated;
select auth.set_claims('22222222-2222-2222-2222-222222222222', 'authenticated');

select (public.create_bill(
  'Rahul Kumar',
  'bike',
  'pb 12 ab 1234',
  '[{"item_type":"service","name":"Puncture Repair","quantity":"1","unit_price":"100"},
    {"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"},
    {"item_type":"service","name":"Service Charge","quantity":"1","unit_price":"100"},
    {"item_type":"part","name":"Tube","quantity":"1","unit_price":"250"},
    {"item_type":"part","name":"Nut & Bolt","quantity":"2","unit_price":"20"},
    {"item_type":"custom","name":"Rim Repair","quantity":"1","unit_price":"150"}]'::jsonb,
  '098765 43210'
)).id as ravi_bill \gset

reset role;

-- The owner pays Ravi 10000 for this month.
set role authenticated;
select auth.set_claims('11111111-1111-1111-1111-111111111111', 'authenticated');

select (public.record_salary_payment(:'ravi_id', 10000, current_date, 'First part payment')).id
  as ravi_payment \gset

-- A pending payment for Suresh, so "accept somebody else's" has a real target.
select (public.record_salary_payment(:'suresh_id', 15000, current_date, null)).id
  as suresh_payment \gset

reset role;

-- ---------------------------------------------------------------------------
-- Test helpers (SECURITY INVOKER: every assertion runs with the caller's
-- database role, so grants and RLS are genuinely exercised)
-- ---------------------------------------------------------------------------

create schema if not exists test;

create table if not exists test.results (
  name text primary key,
  passed boolean not null,
  detail text
);

grant usage on schema test to anon, authenticated, service_role;
-- ON CONFLICT DO UPDATE also needs SELECT on the table.
grant select, insert, update on test.results to anon, authenticated, service_role;

create or replace function test.scalar(p_sql text)
returns text
language plpgsql
as $$
declare
  v_value text;
begin
  execute p_sql into v_value;
  return v_value;
end;
$$;

create or replace function test.expect(p_name text, p_condition boolean, p_detail text default '')
returns void
language plpgsql
as $$
begin
  insert into test.results (name, passed, detail)
  values (p_name, p_condition, p_detail)
  on conflict (name) do update
    set passed = excluded.passed, detail = excluded.detail;
  raise notice '%  %', case when p_condition then 'PASS' else 'FAIL' end, p_name;
end;
$$;

create or replace function test.expect_sql(p_name text, p_sql text, p_expected text)
returns void
language plpgsql
as $$
declare
  v_value text;
begin
  execute p_sql into v_value;
  perform test.expect(p_name, v_value = p_expected, format('got "%s", wanted "%s"', v_value, p_expected));
end;
$$;

create or replace function test.raises(p_name text, p_sql text)
returns void
language plpgsql
as $$
declare
  v_allowed boolean := true;
begin
  begin
    execute p_sql;
  exception when others then
    v_allowed := false;
  end;

  perform test.expect(
    p_name,
    not v_allowed,
    case when v_allowed then 'statement was ALLOWED' else 'rejected by the database' end
  );
end;
$$;

grant execute on all functions in schema test to anon, authenticated, service_role;

truncate test.results;

-- ---------------------------------------------------------------------------
-- Bill maths (owner view)
-- ---------------------------------------------------------------------------

set role authenticated;
select auth.set_claims('11111111-1111-1111-1111-111111111111', 'authenticated');

select test.expect_sql('service, parts and custom totals are kept apart', format($fmt$select service_total || '|' || parts_total || '|' || custom_items_total || '|' || grand_total
    from public.bills where id = %L$fmt$, :'ravi_bill'), '200.00|290.00|150.00|640.00');

select test.expect_sql('vehicle number and mobile are normalised', format($fmt$select vehicle_number || '|' || customer_phone from public.bills where id = %L$fmt$, :'ravi_bill'), 'PB12AB1234|+919876543210');

select test.expect('bill number uses the GTP-YYYYMMDD-NNN format',
  (select bill_number ~ '^GTP-[0-9]{8}-001$' from public.bills where id = :'ravi_bill'),
  (select bill_number from public.bills where id = :'ravi_bill'));

select test.expect_sql('bill is attributed to the employee who created it', format($fmt$select created_by from public.bills where id = %L$fmt$, :'ravi_bill'), '22222222-2222-2222-2222-222222222222');

select test.expect_sql('bill items keep their own line totals', format($fmt$select string_agg(line_total::text, ',' order by sort_order)
    from public.bill_items where bill_id = %L$fmt$, :'ravi_bill'), '100.00,0.00,100.00,250.00,40.00,150.00');

reset role;

-- ---------------------------------------------------------------------------
-- Logged-out visitor
-- ---------------------------------------------------------------------------

set role anon;

select test.raises('anon cannot read bills', $$select count(*) from public.bills$$);
select test.raises('anon cannot read salary payments', $$select count(*) from public.salary_payments$$);
select test.raises('anon cannot read employees', $$select count(*) from public.employees$$);
select test.raises('anon cannot read notifications', $$select count(*) from public.notifications$$);
select test.raises('anon cannot create a bill',
  $$select public.create_bill('X', 'bike', 'AB1234',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb)$$);
select test.raises('anon cannot record a salary payment', format($fmt$select public.record_salary_payment(%L, 100, current_date, null)$fmt$, :'ravi_id'));
select test.raises('anon cannot bootstrap an owner',
  $$select public.bootstrap_owner('44444444-4444-4444-4444-444444444444', 'Fake', 'f@x.test', 'Fake Shop')$$);

reset role;

-- ---------------------------------------------------------------------------
-- Employee Ravi
-- ---------------------------------------------------------------------------

set role authenticated;
select auth.set_claims('22222222-2222-2222-2222-222222222222', 'authenticated');

-- reads that must work
select test.expect_sql('employee can read their own bills',
  $$select count(*) from public.bills$$, '1');

select test.expect_sql('employee can read their own salary record',
  $$select monthly_salary || '|' || paid || '|' || remaining from public.my_salary_summary(current_date)$$,
  '18000.00|10000.00|8000.00');

select test.expect_sql('employee can read their own salary payments',
  $$select count(*) from public.salary_payments$$, '1');

select test.expect_sql('employee can read their own notifications',
  $$select count(*) from public.notifications$$, '2');

select test.expect_sql('employee sees only their own profile',
  $$select count(*) from public.profiles$$, '1');

select test.expect_sql('employee can read their own employee row',
  $$select count(*) from public.employees$$, '1');

select test.expect_sql('employee can correct their own name',
  $$with updated as (
       update public.profiles set full_name = 'Ravi Kumar' where id = auth.uid()
       returning full_name
     )
     select full_name from updated$$, 'Ravi Kumar');

-- reads that must be empty or filtered
select test.expect_sql('employee cannot see another employee salary',
  $$select count(*) from public.salary_payments sp
     join public.employees e on e.id = sp.employee_id
    where e.user_id <> '22222222-2222-2222-2222-222222222222'$$, '0');

select test.expect_sql('employee cannot list the other employees',
  $$select count(*) from public.employees where user_id <> auth.uid()$$, '0');

select test.expect_sql('employee cannot read the owner profile',
  $$select count(*) from public.profiles where role = 'owner'$$, '0');

select test.expect_sql('employee cannot read another employee bill',
  $$select count(*) from public.bills where created_by <> auth.uid()$$, '0');

select test.raises('employee cannot run owner sales reports',
  $$select * from public.sales_summary(now() - interval '1 year', now(), null)$$);

select test.raises('employee cannot run owner sales-by-day reports',
  $$select * from public.sales_by_day(now() - interval '1 year', now(), null)$$);

select test.raises('employee cannot run the owner salary overview',
  $$select * from public.salary_overview(current_date)$$);

select test.expect_sql('employee cannot read another employee payment by filtering on it',
  $$select count(*) from public.salary_payments where employee_id <> private.current_employee_id()$$, '0');

-- writes that must be refused
select test.raises('employee cannot create an employee',
  $$select public.create_employee_record(
       '44444444-4444-4444-4444-444444444444', 'Fake', '+919000000009', 1, current_date)$$);

select test.raises('employee cannot raise their own salary', format($fmt$select public.update_employee_record(%L, null, null, 99999, null)$fmt$, :'ravi_id'));

select test.raises('employee cannot edit another employee', format($fmt$select public.update_employee_record(%L, 'Hacker', null, null, null)$fmt$, :'suresh_id'));

select test.raises('employee cannot disable an employee', format($fmt$select public.set_employee_active(%L, false)$fmt$, :'suresh_id'));

select test.raises('employee cannot record a salary payment', format($fmt$select public.record_salary_payment(%L, 5000, current_date, null)$fmt$, :'suresh_id'));

select test.raises('employee cannot edit the business name',
  $$update public.businesses set name = 'Hacked'$$);

select test.raises('employee cannot promote themselves to owner',
  $$update public.profiles set role = 'owner' where id = auth.uid()$$);

select test.raises('employee cannot deactivate their own account',
  $$update public.profiles set is_active = false where id = auth.uid()$$);

select test.raises('employee cannot move their profile to another shop',
  $$update public.profiles set business_id = gen_random_uuid()$$);

-- The mark that ends sessions after a password change is server owned. If a
-- stolen session could move it, it could make itself valid again.
select test.raises('employee cannot clear the session invalidation mark',
  $$update public.profiles set session_invalid_before = null where id = auth.uid()$$);

select test.raises('employee cannot move the mark into the past to keep an old session',
  $$update public.profiles set session_invalid_before = '2000-01-01' where id = auth.uid()$$);

select test.raises('employee cannot insert bills directly', format($fmt$insert into public.bills (business_id, bill_number, created_by, customer_name, vehicle_type,
      vehicle_number, grand_total)
     values (%L, 'GTP-20260101-999', auth.uid(), 'Fake', 'bike', 'AB1234', 999999)$fmt$, :'business'));

select test.raises('employee cannot insert bill items directly', format($fmt$insert into public.bill_items (bill_id, business_id, item_type, name, quantity, unit_price, line_total)
     values (%L, %L, 'service', 'Fake', 1, 1, 1)$fmt$, :'ravi_bill', :'business'));

select test.raises('employee cannot update a bill total', format($fmt$update public.bills set grand_total = 0 where id = %L$fmt$, :'ravi_bill'));

select test.raises('employee cannot delete a bill', format($fmt$delete from public.bills where id = %L$fmt$, :'ravi_bill'));

select test.raises('employee cannot touch the bill number counter',
  $$update public.bill_number_counters set last_value = 5000$$);

select test.raises('employee cannot accept another employee salary', format($fmt$select public.accept_salary_payment(%L)$fmt$, :'suresh_payment'));

select test.raises('employee cannot cancel their own salary payment', format($fmt$select public.cancel_salary_payment(%L, 'nope')$fmt$, :'ravi_payment'));

select test.raises('employee cannot change the amount of a payment', format($fmt$update public.salary_payments set amount = 1 where id = %L$fmt$, :'ravi_payment'));

select test.raises('employee cannot change the payment date', format($fmt$update public.salary_payments set payment_date = current_date - 30 where id = %L$fmt$, :'ravi_payment'));

select test.raises('employee cannot re-point a payment at another employee', format($fmt$update public.salary_payments set employee_id = %L where id = %L$fmt$, :'suresh_id', :'ravi_payment'));

select test.raises('employee cannot confirm a payment with a direct update', format($fmt$update public.salary_payments set status = 'confirmed' where id = %L$fmt$, :'ravi_payment'));

select test.raises('employee cannot send notifications to other users', format($fmt$insert into public.notifications (business_id, user_id, type, title, message)
     values (%L, '33333333-3333-3333-3333-333333333333', 'salary_payment_recorded', 'Hi', 'Hi')$fmt$, :'business'));

select test.expect_sql('employee cannot mark someone else notification as read',
  $$with touched as (
       update public.notifications set is_read = true where user_id <> auth.uid()
       returning id
     )
     select count(*) from touched$$, '0');

select test.raises('employee cannot change a notification message',
  $$update public.notifications set message = 'changed' where id = auth.uid()$$);

-- legitimate actions
select test.expect_sql('accepting their own payment succeeds',
  format($fmt$select (public.accept_salary_payment(%L)).status::text$fmt$, :'ravi_payment'), 'confirmed');

select test.expect_sql('employee can accept their own salary payment',
  format($fmt$select status || '|' || (acknowledged_at is not null)::text
    from public.salary_payments where id = %L$fmt$, :'ravi_payment'), 'confirmed|true');

select test.raises('a confirmed payment cannot be accepted twice', format($fmt$select public.accept_salary_payment(%L)$fmt$, :'ravi_payment'));

select test.raises('a confirmed payment cannot be cancelled afterwards', format($fmt$select public.cancel_salary_payment(%L, 'changed my mind')$fmt$, :'ravi_payment'));

select test.raises('a confirmed payment amount is immutable even for the owner', format($fmt$update public.salary_payments set amount = 500 where id = %L$fmt$, :'ravi_payment'));

reset role;

-- ---------------------------------------------------------------------------
-- Owner Govinda
-- ---------------------------------------------------------------------------

set role authenticated;
select auth.set_claims('11111111-1111-1111-1111-111111111111', 'authenticated');

select test.expect_sql('owner was notified that the salary was accepted',
  $$select count(*) from public.notifications where type = 'salary_payment_accepted'
     and user_id = '11111111-1111-1111-1111-111111111111'$$, '1');

select test.expect_sql('owner sees every bill', $$select count(*) from public.bills$$, '1');

select test.expect_sql('owner sees every employee', $$select count(*) from public.employees$$, '2');

select test.expect_sql('owner sales report aggregates the whole shop',
  $$select total_sales || '|' || bill_count || '|' || service_revenue || '|' || parts_revenue
        || '|' || custom_revenue || '|' || average_bill
    from public.sales_summary(now() - interval '1 day', now() + interval '1 day', null)$$,
  '640.00|1|200.00|290.00|150.00|640.00');

select test.expect_sql('owner report can be filtered to one employee',
  $$select total_sales from public.sales_summary(
       now() - interval '1 day', now() + interval '1 day', '22222222-2222-2222-2222-222222222222')$$,
  '640.00');

select test.expect_sql('owner report of an empty window is zero, not null',
  $$select total_sales || '|' || bill_count from public.sales_summary(
       now() + interval '2 years', now() + interval '3 years', null)$$, '0|0');

select test.expect_sql('owner sales-by-day groups by shop day',
  $$select count(*) from public.sales_by_day(now() - interval '1 day', now() + interval '1 day', null)$$,
  '1');

select test.expect_sql('owner salary overview covers both employees',
  $$select count(*) from public.salary_overview(current_date)$$, '2');

select test.expect_sql('owner salary overview shows the remaining amount',
  $$select monthly_salary || '|' || paid || '|' || remaining || '|' || pending_acknowledgements
    from public.salary_overview(current_date) where full_name like 'Ravi%'$$, '18000.00|10000.00|8000.00|0');

select test.raises('owner cannot accept a salary payment on the employee behalf', format($fmt$select public.accept_salary_payment(%L)$fmt$, :'suresh_payment'));

select test.raises('owner cannot pay more than the remaining salary', format($fmt$select public.record_salary_payment(%L, 8001, current_date, null)$fmt$, :'ravi_id'));

select test.expect_sql('owner can pay the remaining part of the salary',
  format($fmt$select (public.record_salary_payment(%L, 8000, current_date, 'Balance')).amount::text$fmt$, :'ravi_id'),
  '8000.00');

select test.expect_sql('salary history keeps every payment instead of overwriting',
  $$select count(*) from public.salary_payments sp
     join public.employees e on e.id = sp.employee_id
     join public.profiles p on p.id = e.user_id
    where p.full_name like 'Ravi%'$$, '2');

select test.raises('owner cannot pay once the full salary is paid',
  format($fmt$select public.record_salary_payment(%L, 1, current_date, null)$fmt$, :'ravi_id'));

select test.raises('owner cannot create a bill with a negative price',
  $$select public.create_bill('Rahul', 'bike', 'PB12AB1234',
       '[{"item_type":"service","name":"Puncture Repair","quantity":"1","unit_price":"-50"}]'::jsonb)$$);

select test.raises('owner cannot create a bill with zero quantity',
  $$select public.create_bill('Rahul', 'bike', 'PB12AB1234',
       '[{"item_type":"part","name":"Tube","quantity":"0","unit_price":"250"}]'::jsonb)$$);

select test.raises('a bill needs at least one item',
  $$select public.create_bill('Rahul', 'bike', 'PB12AB1234', '[]'::jsonb)$$);

select test.raises('a bill needs a vehicle number',
  $$select public.create_bill('Rahul', 'bike', 'X',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb)$$);

select test.raises('a bill needs a vehicle type',
  $$select public.create_bill('Rahul', 'spaceship', 'PB12AB1234',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb)$$);

select test.raises('an unrecognised vehicle must be described',
  $$select public.create_bill('Rahul', 'other', 'NOPLATE1',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb)$$);

select test.expect_sql('an unrecognised vehicle keeps its description',
  $$select (public.create_bill('Rahul', 'other', 'NOPLATE1',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb,
       null, '  Hand cart  ')).vehicle_description$$,
  'Hand cart');

select test.expect_sql('a description on a known vehicle type is dropped, not stored',
  $$select coalesce((public.create_bill('Rahul', 'bike', 'PB12AB1234',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb,
       null, 'Hand cart')).vehicle_description::text, 'NULL')$$,
  'NULL');

select test.raises('a description longer than the column is refused',
  $$select public.create_bill('Rahul', 'other', 'NOPLATE1',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb,
       null, repeat('x', 81))$$);

select test.expect('bills are published for realtime so the owner dashboard refreshes',
  (select count(*) = 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bills'),
  'bills in supabase_realtime');

select test.raises('a second owner cannot be bootstrapped',
  $$select public.bootstrap_owner('33333333-3333-3333-3333-333333333333', 'Other', 'o@x.test', 'Other Shop')$$);

select public.update_employee_record(:'suresh_id', 'Suresh Kumar', null, null, null);

select test.expect_sql('owner can rename an employee', format($fmt$select full_name from public.profiles where id = (select user_id from public.employees where id = %L)$fmt$, :'suresh_id'), 'Suresh Kumar');

select test.raises('owner cannot set a salary below what is already paid', format($fmt$select public.update_employee_record(%L, null, null, 500, null)$fmt$, :'ravi_id'));

-- Taking a colleague's number would hand one person two logins and lock the
-- other one out of their own account.
select test.raises('the owner cannot point an employee at a colleague’s mobile number',
  format($fmt$select public.update_employee_record(%L, null, '+919000000003', null, null)$fmt$, :'ravi_id'));

select test.expect_sql('the first employee keeps their number after the attempt',
  $$select phone from public.profiles where id = '22222222-2222-2222-2222-222222222222'$$, '+919000000002');

select test.raises('owner cannot pay an unknown employee',
  $$select public.record_salary_payment('44444444-4444-4444-4444-444444444444', 100, current_date, null)$$);

select public.update_business('Govinda Tyre Puncture');

select test.expect_sql('owner can change the business name',
  $$select name from public.businesses$$, 'Govinda Tyre Puncture');

reset role;

-- ---------------------------------------------------------------------------
-- Disabled employee keeps nothing
-- ---------------------------------------------------------------------------

set role authenticated;
select auth.set_claims('11111111-1111-1111-1111-111111111111', 'authenticated');
select public.set_employee_active(:'suresh_id', false);
reset role;

set role authenticated;
select auth.set_claims('33333333-3333-3333-3333-333333333333', 'authenticated');

select test.expect_sql('a disabled employee cannot read bills', $$select count(*) from public.bills$$, '0');
select test.raises('a disabled employee cannot create a bill',
  $$select public.create_bill('X', 'bike', 'AB1234',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb)$$);
select test.raises('a disabled employee cannot accept salary', format($fmt$select public.accept_salary_payment(%L)$fmt$, :'suresh_payment'));

reset role;

-- ---------------------------------------------------------------------------
-- Half deactivated accounts
--
-- private.set_employee_active() flips employees.is_active and profiles.is_active
-- together. This block simulates the accident that would break that promise:
-- only one of the two flags is changed (a manual fix, a bad import, a future
-- code path). private.is_active_user() must still close the door.
-- ---------------------------------------------------------------------------

reset role;

insert into auth.users (id, phone) values ('44444444-4444-4444-4444-444444444444', '+919000000004');

set role authenticated;
select auth.set_claims('11111111-1111-1111-1111-111111111111', 'authenticated');

select public.create_employee_record(
  '44444444-4444-4444-4444-444444444444', 'Half Active', '+919000000004', 5000, current_date
) as half_id \gset

select public.record_salary_payment(:'half_id', 1000, current_date, 'half deactivation') as half_payment \gset
reset role;

-- Only the employee record is switched off; the profile still looks active.
update public.employees set is_active = false where id = :'half_id';

set role authenticated;
select auth.set_claims('44444444-4444-4444-4444-444444444444', 'authenticated');

select test.expect_sql('an inactive employee record hides everything, even with an active profile',
  $$select count(*) from public.bills$$, '0');
select test.expect_sql('an inactive employee record sees no employees',
  $$select count(*) from public.employees$$, '0');
select test.raises('an inactive employee record cannot create a bill',
  $$select public.create_bill('X', 'bike', 'AB1234',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb)$$);
select test.raises('an inactive employee record cannot accept salary',
  format($fmt$select public.accept_salary_payment(%L)$fmt$, :'half_payment'));
select test.expect_sql('an inactive employee record cannot read its own notifications',
  $$select count(*) from public.notifications where user_id = '44444444-4444-4444-4444-444444444444'$$, '0');
select test.expect_sql('an inactive employee record cannot see the shop',
  $$select count(*) from public.businesses$$, '0');

reset role;

-- Now only the profile is switched off; the employee record still looks active.
update public.employees set is_active = true where id = :'half_id';
update public.profiles set is_active = false where id = '44444444-4444-4444-4444-444444444444';

set role authenticated;
select auth.set_claims('44444444-4444-4444-4444-444444444444', 'authenticated');

select test.expect_sql('an inactive profile hides everything, even with an active employee record',
  $$select count(*) from public.bills$$, '0');
select test.raises('an inactive profile cannot create a bill',
  $$select public.create_bill('X', 'bike', 'AB1234',
       '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb)$$);
select test.raises('an inactive profile cannot accept salary',
  format($fmt$select public.accept_salary_payment(%L)$fmt$, :'half_payment'));

reset role;

-- Restoring one flag is not enough; both have to come back.
update public.employees set is_active = false where id = :'half_id';

set role authenticated;
select auth.set_claims('44444444-4444-4444-4444-444444444444', 'authenticated');

select test.expect_sql('restoring only the employee record does not re-open access',
  $$select count(*) from public.bills$$, '0');

reset role;

update public.employees set is_active = true where id = :'half_id';
update public.profiles set is_active = true where id = '44444444-4444-4444-4444-444444444444';

set role authenticated;
select auth.set_claims('44444444-4444-4444-4444-444444444444', 'authenticated');

select test.expect_sql('a fully reactivated employee can bill again',
  $$select count(*) from public.create_bill('Back On Duty', 'car', 'PB00AA1111',
       '[{"item_type":"service","name":"Puncture Repair","quantity":"1","unit_price":"150"}]'::jsonb)$$, '1');
select test.expect_sql('a fully reactivated employee can see its own new bill',
  $$select count(*) from public.bills$$, '1');

reset role;

-- ---------------------------------------------------------------------------
-- Employee sign in lookup (public.employee_auth_user_id)
--
-- The login action turns the number an employee types into the Auth user id
-- before anybody has signed in. It must answer for a real employee and stay
-- shut to every caller that a browser could be holding a key for.
-- ---------------------------------------------------------------------------

set role service_role;
select test.expect_sql('the sign in lookup finds an active employee by their number',
  $$select public.employee_auth_user_id('+919000000002')$$, '22222222-2222-2222-2222-222222222222');
select test.expect_sql('the sign in lookup ignores surrounding whitespace',
  $$select public.employee_auth_user_id('  +919000000002  ')$$, '22222222-2222-2222-2222-222222222222');
select test.expect_sql('the sign in lookup does not match a number that is not there',
  $$select coalesce(public.employee_auth_user_id('+919999999999')::text, 'null')$$, 'null');
select test.expect_sql('the sign in lookup does not match a number that is only half typed',
  $$select coalesce(public.employee_auth_user_id('9190000000')::text, 'null')$$, 'null');
select test.expect_sql('the sign in lookup does not match an empty number',
  $$select coalesce(public.employee_auth_user_id('')::text, 'null')$$, 'null');
select test.expect_sql('the sign in lookup does not match an owner, who signs in with an email',
  $$select coalesce(public.employee_auth_user_id('+919000000001')::text, 'null')$$, 'null');
reset role;

set role authenticated;
select auth.set_claims('22222222-2222-2222-2222-222222222222', 'authenticated');
select test.raises('a signed in employee cannot look up a login identity',
  $$select public.employee_auth_user_id('+919000000003')$$);
reset role;

set role anon;
select test.raises('a signed out visitor cannot look up a login identity',
  $$select public.employee_auth_user_id('+919000000002')$$);
reset role;

-- A number nobody may reach still has to resolve the same way, so the answer
-- cannot be used to find out who works here.
update public.profiles set is_active = false where id = '33333333-3333-3333-3333-333333333333';

set role service_role;
select test.expect_sql('a disabled employee cannot sign in, even with the right number',
  $$select coalesce(public.employee_auth_user_id('+919000000003')::text, 'null')$$, 'null');
reset role;

update public.employees set is_active = false where id = :'suresh_id';

set role service_role;
select test.expect_sql('an employee record that is switched off cannot sign in either',
  $$select coalesce(public.employee_auth_user_id('+919000000003')::text, 'null')$$, 'null');
reset role;

update public.profiles set is_active = true where id = '33333333-3333-3333-3333-333333333333';
update public.employees set is_active = true where id = :'suresh_id';

set role service_role;
select test.expect_sql('switching the employee back on brings the login back',
  $$select public.employee_auth_user_id('+919000000003')$$, '33333333-3333-3333-3333-333333333333');
reset role;

-- ---------------------------------------------------------------------------
-- Bill voiding and idempotent writes (migration 00900)
-- ---------------------------------------------------------------------------

set role authenticated;
select auth.set_claims('22222222-2222-2222-2222-222222222222', 'authenticated');

-- The printed "Serviced by" name is snapshotted on the bill, so an employee's
-- own PDF has it without needing to read another profile.
select test.expect_sql('an employee can read the serviced-by name on their own bill',
  format($fmt$select serviced_by from public.bills where id = %L$fmt$, :'ravi_bill'), 'Ravi');

select test.raises('an employee cannot void a bill',
  format($fmt$select public.void_bill(%L, 'not mine to void')$fmt$, :'ravi_bill'));
reset role;

set role anon;
select test.raises('a logged out visitor cannot void a bill',
  format($fmt$select public.void_bill(%L, 'nope')$fmt$, :'ravi_bill'));
reset role;

-- Replaying a bill with the same key must answer with the bill that already
-- exists, not create a second one. The owner types nothing here; the form's
-- submit button does, so it stays invisible in this test.
set role authenticated;
select auth.set_claims('11111111-1111-1111-1111-111111111111', 'authenticated');

select test.expect_sql('replaying a bill with the same key returns the same bill',
  format($fmt$
    select
      (public.create_bill('Replay', 'bike', 'RJ14ABCD',
        '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb,
        null, null, 'e2e-replay-bill')).id
      =
      (public.create_bill('Replay', 'bike', 'RJ14ABCD',
        '[{"item_type":"service","name":"Air Check","quantity":"1","unit_price":"0"}]'::jsonb,
        null, null, 'e2e-replay-bill')).id$fmt$),
  'true');

select test.expect_sql('a replayed bill is written once, not twice',
  $$select count(*) from public.bills where idempotency_key = 'e2e-replay-bill'$$, '1');

select test.expect_sql('the employee who served the bill is remembered on it',
  $$select serviced_by from public.bills where idempotency_key = 'e2e-replay-bill'$$, 'Govinda');

-- Replaying a salary payment with the same key must not pay twice. The half
-- activated fixture (4444) has 4000 remaining, so 500 is safely payable.
select test.expect_sql('replaying a salary payment with the same key returns the same payment',
  format($fmt$
    select
      (public.record_salary_payment(%L, 500, current_date, null, 'e2e-replay-payment')).id
      =
      (public.record_salary_payment(%L, 500, current_date, null, 'e2e-replay-payment')).id$fmt$,
    :'half_id', :'half_id'),
  'true');

select test.expect_sql('a replayed salary payment is written once, not twice',
  $$select count(*) from public.salary_payments where idempotency_key = 'e2e-replay-payment'$$, '1');

-- Voids stay in the books but stop counting in every total.
select test.raises('a void needs a reason before it is accepted',
  format($fmt$select public.void_bill(%L, null)$fmt$, :'ravi_bill'));

select test.expect_sql('voiding returns the bill marked at this moment',
  format($fmt$select voided_at is not null from public.void_bill(%L, 'Wrong amount typed')$fmt$, :'ravi_bill'), 'true');

select test.expect_sql('the void is attributed to the owner with the reason kept',
  format($fmt$select (voided_by = '11111111-1111-1111-1111-111111111111' and void_reason = 'Wrong amount typed')::text
    from public.bills where id = %L$fmt$, :'ravi_bill'),
  'true');

select test.raises('a bill cannot be voided twice',
  format($fmt$select public.void_bill(%L, 'so sorry, wrong wrong')$fmt$, :'ravi_bill'));

select test.expect_sql('a voided bill stays in the table for the books',
  format($fmt$select count(*) from public.bills where id = %L$fmt$, :'ravi_bill'), '1');

select test.expect_sql('the sales report leaves a voided bill out',
  format($fmt$
    select
      (select total_sales from public.sales_summary(now() - interval '1 day', now() + interval '1 day', null) limit 1)
      = (select coalesce(sum(grand_total), 0) from public.bills b
          where b.voided_at is null
            and b.created_at >= now() - interval '1 day'
            and b.created_at < now() + interval '1 day')$fmt$),
  'true');

reset role;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------

select
  case when bool_and(passed) then 'ALL PASSED' else 'SOME FAILED' end as summary,
  count(*) as checks,
  count(*) filter (where not passed) as failures
from test.results;

select name, detail from test.results where not passed order by name;