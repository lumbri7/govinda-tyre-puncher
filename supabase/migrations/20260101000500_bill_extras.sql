-- Govinda Tyre Puncture
--
-- Two gaps found while preparing the shop for real use:
--
--   1. `public.bills` was missing from the `supabase_realtime` publication, so
--      the owner dashboard, which watches that table, never refreshed when a
--      new bill was saved (notifications and salary payments were published).
--
--   2. Choosing "Other" as the vehicle type left the employee to type a plate
--      number for something that may not have one (a trolley, a generator, a
--      hand cart). `vehicle_description` records what actually came in.

-- ---------------------------------------------------------------------------
-- vehicle description
-- ---------------------------------------------------------------------------

alter table public.bills
  add column if not exists vehicle_description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bills_vehicle_description_check'
  ) then
    alter table public.bills
      add constraint bills_vehicle_description_check
      check (
        (vehicle_description is null and vehicle_type <> 'other')
        or (
          vehicle_description is not null
          and char_length(btrim(vehicle_description)) between 1 and 80
          and vehicle_type = 'other'
        )
      );
  end if;
end;
$$;

comment on column public.bills.vehicle_description is
  'What the vehicle actually is, when the type is anything other than a known one (kept only for vehicle_type = ''other'').';

-- ---------------------------------------------------------------------------
-- create_bill: carry the description through
-- ---------------------------------------------------------------------------

-- The argument list changes, so this is a new overload rather than a replace;
-- the five argument version is dropped so there is only one way in.
drop function if exists public.create_bill(text, text, text, jsonb, text);

create or replace function public.create_bill(
  p_customer_name text,
  p_vehicle_type text,
  p_vehicle_number text,
  p_items jsonb,
  p_customer_phone text default null,
  p_vehicle_description text default null
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_business uuid;
  v_prefix text;
  v_tz text;
  v_day date;
  v_bill public.bills;
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
    grand_total
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
    v_service + v_parts + v_custom
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
end;
$$;

-- ---------------------------------------------------------------------------
-- grants: server actions call this as the signed-in user
-- ---------------------------------------------------------------------------

revoke all on function public.create_bill(text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.create_bill(text, text, text, jsonb, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- realtime
-- ---------------------------------------------------------------------------

do $$
begin
  -- `alter publication ... add table` fails when the table is already a member,
  -- so the publication is checked first and this stays safe to re-run.
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bills'
  ) then
    alter publication supabase_realtime add table public.bills;
  end if;
end;
$$;