-- Money amounts shown inside database-generated text (salary notifications and
-- the remaining-salary guard) used the format 'Rs 12000.00'. The app displays
-- whole rupees without decimals and groups them the Indian way (₹12,000,
-- ₹1,25,000), so these messages are rewritten to match, keeping paise only when
-- the amount actually has them.

begin;

create function private.format_rupees(a_amount numeric)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sign text := case when a_amount < 0 then '-' else '' end;
  v_whole bigint := floor(abs(a_amount))::bigint;
  v_paise int := round((abs(a_amount) - floor(abs(a_amount))) * 100)::int;
  v_out text := private.group_indian(v_whole);
begin
  return v_sign
    || '₹'
    || v_out
    || case when v_paise > 0 then '.' || lpad(v_paise::text, 2, '0') else '' end;
end;
$$;

create function private.group_indian(n bigint)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_s text := n::text;
  v_head text;
  v_out text := '';
  v_i int;
begin
  if n < 1000 then
    return v_s;
  end if;

  v_head := left(v_s, length(v_s) - 3);
  v_i := length(v_head);
  while v_i > 0 loop
    v_out :=
      substr(v_head, greatest(v_i - 1, 1), least(2, v_i))
      || case when v_out = '' then '' else ',' end
      || v_out;
    v_i := v_i - 2;
  end loop;

  return v_out || ',' || right(v_s, 3);
end;
$$;

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
    format('%s recorded a salary payment of %s for %s. Please accept it.',
           coalesce(v_shopper, 'The owner'),
           private.format_rupees(new.amount),
           to_char(new.payment_date, 'DD Mon YYYY')),
    new.id
  );

  return new;
end;
$$;

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
      format('%s accepted a salary payment of %s.',
             coalesce(v_employee, 'An employee'),
             private.format_rupees(new.amount)),
      new.id
    from public.profiles o
    where o.business_id = new.business_id
      and o.role = 'owner'
      and o.is_active;
  end if;

  return new;
end;
$$;

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
    raise exception 'This is more than the remaining salary of % for % .',
      private.format_rupees(greatest(v_salary - v_paid, 0)),
      to_char(v_month, 'FMMonth YYYY');
  end if;

  insert into public.salary_payments (business_id, employee_id, amount, payment_date, note, created_by)
  values (v_business, p_employee_id, v_amount, v_date, v_note, (select auth.uid()))
  returning * into v_payment;

  return v_payment;
end;
$$;

commit;