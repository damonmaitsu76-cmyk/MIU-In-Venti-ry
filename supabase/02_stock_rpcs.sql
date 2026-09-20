-- Atomic stock, product, and checkout RPCs. Safe to re-run.
-- All quantity arguments and recipe amounts are in the item's stored unit.

create extension if not exists pgcrypto;

create or replace function public.adjust_inventory(
  p_item_id bigint,
  p_delta numeric,
  p_reason text default null,
  p_note text default null
) returns public.inventory_items
language plpgsql security invoker set search_path = public as $$
declare row public.inventory_items;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Amount must not be zero'; end if;
  if coalesce(char_length(p_note), 0) > 200 then raise exception 'Notes must be 200 characters or fewer'; end if;
  p_reason := coalesce(p_reason, case when p_delta > 0 then 'restock' else 'usage' end);
  if p_reason not in ('restock', 'usage') then raise exception 'Invalid stock adjustment reason'; end if;

  select * into row from public.inventory_items where inventory_item_id = p_item_id for update;
  if not found then raise exception 'Inventory item % not found', p_item_id; end if;
  if row.current_quantity + p_delta < 0 then raise exception '% would go below zero', row.item_name; end if;

  perform set_config('app.audit_source', p_reason, true);
  perform set_config('app.audit_note', coalesce(p_note, ''), true);
  update public.inventory_items
  set current_quantity = current_quantity + p_delta
  where inventory_item_id = p_item_id
  returning * into row;
  return row;
end $$;

create or replace function public.set_inventory_count(
  p_item_id bigint,
  p_new_qty numeric,
  p_note text default null
) returns public.inventory_items
language plpgsql security invoker set search_path = public as $$
declare row public.inventory_items;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_new_qty is null or p_new_qty < 0 then raise exception 'Recount quantity cannot be negative'; end if;
  if coalesce(char_length(p_note), 0) > 200 then raise exception 'Notes must be 200 characters or fewer'; end if;
  select * into row from public.inventory_items where inventory_item_id = p_item_id for update;
  if not found then raise exception 'Inventory item % not found', p_item_id; end if;
  perform set_config('app.audit_source', 'correction', true);
  perform set_config('app.audit_note', coalesce(p_note, ''), true);
  update public.inventory_items set current_quantity = p_new_qty
  where inventory_item_id = p_item_id returning * into row;
  return row;
end $$;

create or replace function public.convert_item_to_pack(
  p_item_id bigint,
  p_pack_size numeric
) returns public.inventory_items
language plpgsql security invoker set search_path = public as $$
declare row public.inventory_items;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_pack_size is null or p_pack_size <= 0 then raise exception 'Pieces per package must be positive'; end if;
  select * into row from public.inventory_items where inventory_item_id = p_item_id for update;
  if not found then raise exception 'Inventory item % not found', p_item_id; end if;
  if row.unit <> 'pkg' or row.pack_size is not null then
    raise exception '% is not currently tracked as whole packages', row.item_name;
  end if;
  perform set_config('app.audit_source', 'conversion', true);
  perform set_config('app.audit_batch', gen_random_uuid()::text, true);
  update public.inventory_items
  set unit = 'pc',
      pack_size = p_pack_size,
      current_quantity = current_quantity * p_pack_size,
      minimum_quantity = minimum_quantity * p_pack_size
  where inventory_item_id = p_item_id
  returning * into row;
  return row;
end $$;

create or replace function public.save_product(
  p_product_id bigint,
  p_name text,
  p_price numeric,
  p_image_path text,
  p_is_active boolean,
  p_items jsonb
) returns public.products
language plpgsql security invoker set search_path = public as $$
declare saved_product public.products;
declare saved_recipe public.recipes;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Product name is required'; end if;
  if p_price is null or p_price < 0 then raise exception 'Product price cannot be negative'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one ingredient to the recipe';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(inventory_item_id bigint, quantity_required numeric)
    where inventory_item_id is null or quantity_required is null or quantity_required <= 0
  ) then raise exception 'Every recipe item needs a positive amount'; end if;
  if (select count(*) from jsonb_to_recordset(p_items) as x(inventory_item_id bigint, quantity_required numeric))
      <> (select count(distinct inventory_item_id) from jsonb_to_recordset(p_items) as x(inventory_item_id bigint, quantity_required numeric)) then
    raise exception 'An item can appear only once in a recipe';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(inventory_item_id bigint, quantity_required numeric)
    left join public.inventory_items i on i.inventory_item_id = x.inventory_item_id
    where i.inventory_item_id is null or i.unit = 'pkg'
  ) then raise exception 'Recipes cannot use items tracked by whole package'; end if;

  perform set_config('app.audit_source', 'product', true);
  perform set_config('app.audit_batch', gen_random_uuid()::text, true);
  if p_product_id is null then
    insert into public.products (product_name, price, image_path, is_active)
    values (trim(p_name), p_price, nullif(trim(p_image_path), ''), coalesce(p_is_active, true))
    returning * into saved_product;
  else
    update public.products
    set product_name = trim(p_name), price = p_price,
        image_path = nullif(trim(p_image_path), ''), is_active = coalesce(p_is_active, true)
    where product_id = p_product_id
    returning * into saved_product;
    if not found then raise exception 'Product % not found', p_product_id; end if;
  end if;

  insert into public.recipes (product_id, recipe_name)
  values (saved_product.product_id, saved_product.product_name || ' recipe')
  on conflict (product_id) do update set recipe_name = excluded.recipe_name
  returning * into saved_recipe;

  delete from public.recipe_items where recipe_id = saved_recipe.recipe_id;
  insert into public.recipe_items (recipe_id, inventory_item_id, quantity_required)
  select saved_recipe.recipe_id, x.inventory_item_id, x.quantity_required
  from jsonb_to_recordset(p_items) as x(inventory_item_id bigint, quantity_required numeric);
  return saved_product;
end $$;

create or replace function public.checkout_order(p_lines jsonb)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare line jsonb;
declare demand record;
declare shortages text[] := array[]::text[];
declare deductions jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one order line';
  end if;

  for line in select value from jsonb_array_elements(p_lines) loop
    if line->>'kind' = 'standard' then
      if coalesce((line->>'product_id')::bigint, 0) <= 0 or coalesce((line->>'qty')::integer, 0) <= 0 then
        raise exception 'Every product line needs a product and positive quantity';
      end if;
      if not exists (
        select 1 from public.recipes r join public.recipe_items ri on ri.recipe_id = r.recipe_id
        where r.product_id = (line->>'product_id')::bigint
      ) then raise exception 'Product % has no recipe', line->>'product_id'; end if;
    elsif line->>'kind' = 'custom' then
      if coalesce((line->>'base_product_id')::bigint, 0) <= 0 or coalesce((line->>'qty')::integer, 0) <= 0 then
        raise exception 'Every custom line needs a base product and positive quantity';
      end if;
      if jsonb_typeof(line->'ingredients') <> 'array' or jsonb_array_length(line->'ingredients') = 0 then
        raise exception 'Every custom line needs at least one item';
      end if;
      if exists (
        select 1 from jsonb_to_recordset(line->'ingredients') as x(inventory_item_id bigint, amount numeric)
        where inventory_item_id is null or amount is null or amount <= 0
      ) then raise exception 'Every custom item needs a positive amount'; end if;
    else
      raise exception 'Order line kind must be standard or custom';
    end if;
  end loop;

  for demand in
    with expanded as (
      select ri.inventory_item_id, ri.quantity_required * (line.value->>'qty')::integer as required
      from jsonb_array_elements(p_lines) line(value)
      join public.recipes r on r.product_id = (line.value->>'product_id')::bigint
      join public.recipe_items ri on ri.recipe_id = r.recipe_id
      where line.value->>'kind' = 'standard'
      union all
      select x.inventory_item_id, x.amount * (line.value->>'qty')::integer
      from jsonb_array_elements(p_lines) line(value)
      cross join lateral jsonb_to_recordset(line.value->'ingredients') as x(inventory_item_id bigint, amount numeric)
      where line.value->>'kind' = 'custom'
    ), grouped as (
      select inventory_item_id, sum(required) as required from expanded group by inventory_item_id
    )
    select grouped.inventory_item_id, grouped.required, i.item_name, i.unit, i.current_quantity
    from grouped join public.inventory_items i using (inventory_item_id)
    order by grouped.inventory_item_id for update of i
  loop
    if demand.unit = 'pkg' then raise exception '% is tracked by whole package and cannot be deducted by a recipe', demand.item_name; end if;
    if demand.current_quantity < demand.required then
      shortages := array_append(shortages, format('%s (need %s %s, have %s %s)', demand.item_name, demand.required, demand.unit, demand.current_quantity, demand.unit));
    end if;
  end loop;
  if array_length(shortages, 1) is not null then
    raise exception 'Not enough stock: %', array_to_string(shortages, '; ');
  end if;

  perform set_config('app.audit_source', 'order', true);
  perform set_config('app.audit_batch', gen_random_uuid()::text, true);
  for demand in
    with expanded as (
      select ri.inventory_item_id, ri.quantity_required * (line.value->>'qty')::integer as required
      from jsonb_array_elements(p_lines) line(value)
      join public.recipes r on r.product_id = (line.value->>'product_id')::bigint
      join public.recipe_items ri on ri.recipe_id = r.recipe_id
      where line.value->>'kind' = 'standard'
      union all
      select x.inventory_item_id, x.amount * (line.value->>'qty')::integer
      from jsonb_array_elements(p_lines) line(value)
      cross join lateral jsonb_to_recordset(line.value->'ingredients') as x(inventory_item_id bigint, amount numeric)
      where line.value->>'kind' = 'custom'
    )
    select inventory_item_id, sum(required) as required from expanded group by inventory_item_id order by inventory_item_id
  loop
    update public.inventory_items
    set current_quantity = current_quantity - demand.required
    where inventory_item_id = demand.inventory_item_id;
    deductions := deductions || jsonb_build_array(jsonb_build_object('inventory_item_id', demand.inventory_item_id, 'quantity', demand.required));
  end loop;
  return jsonb_build_object('deductions', deductions);
end $$;

revoke all on function public.adjust_inventory(bigint, numeric, text, text) from public, anon;
revoke all on function public.set_inventory_count(bigint, numeric, text) from public, anon;
revoke all on function public.convert_item_to_pack(bigint, numeric) from public, anon;
revoke all on function public.save_product(bigint, text, numeric, text, boolean, jsonb) from public, anon;
revoke all on function public.checkout_order(jsonb) from public, anon;
grant execute on function public.adjust_inventory(bigint, numeric, text, text) to authenticated;
grant execute on function public.set_inventory_count(bigint, numeric, text) to authenticated;
grant execute on function public.convert_item_to_pack(bigint, numeric) to authenticated;
grant execute on function public.save_product(bigint, text, numeric, text, boolean, jsonb) to authenticated;
grant execute on function public.checkout_order(jsonb) to authenticated;
