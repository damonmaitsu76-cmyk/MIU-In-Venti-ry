-- MIU In-Venti-ry inventory model. Safe to re-run.
-- Preflight before applying: inspect any unexpected legacy values first.
-- select distinct unit from inventory_items order by 1;
-- select distinct category from inventory_items order by 1;

begin;

alter table public.inventory_items add column if not exists item_type text not null default 'ingredient';
alter table public.inventory_items add column if not exists pack_size numeric;
alter table public.inventory_items add column if not exists needs_maintenance boolean not null default false;
alter table public.inventory_items add column if not exists maintenance_interval_days integer;
alter table public.inventory_items add column if not exists last_maintained_at timestamptz;
-- Kept here as well as 05 so save_product can be created before storage policies.
alter table public.products add column if not exists image_path text;

-- Normalise known legacy units before applying the finite unit constraint.
update public.inventory_items
set unit = case lower(trim(unit))
  when 'ml' then 'mL'
  when 'milliliter' then 'mL'
  when 'milliliters' then 'mL'
  when 'gram' then 'g'
  when 'grams' then 'g'
  when 'pcs' then 'pc'
  when 'piece' then 'pc'
  when 'pieces' then 'pc'
  when 'pack' then 'pkg'
  when 'packs' then 'pkg'
  when 'package' then 'pkg'
  when 'packages' then 'pkg'
  else trim(unit)
end
where unit is not null;

-- Explicit names win, then broad legacy categories supply a safe fallback.
update public.inventory_items
set item_type = case
  when item_name in ('Weighing Scales', 'Chasen', 'Matcha Bowl', 'Stainless Steel', 'Cups', 'Straws', 'Cellophane (Single)', 'Cellophane (Double)', 'Parchment Paper', 'Tissue') then 'material'
  when item_type not in ('ingredient', 'material') then 'ingredient'
  else item_type
end;

update public.inventory_items
set category = case
  when item_name in ('Yabukita Matcha', 'Hojicha Matcha', 'Multi-Cultivar Matcha', 'Earl Grey Tea Bags') then 'base'
  when item_name = 'Oatside (Oat Milk)' then 'milk'
  when item_name in ('Agave', 'Condensed Milk', 'Evaporated Milk') then 'sweetener'
  when item_name in ('Heavy Cream') then 'addon'
  when item_name in ('Ube Flavor', 'Ube Jam', 'Iodized Sea Salt', 'Milo') then 'flavor'
  when item_name = 'Ice' then 'other'
  when item_name in ('Cups', 'Straws') then 'serving'
  when item_name in ('Cellophane (Single)', 'Cellophane (Double)', 'Parchment Paper', 'Tissue') then 'packaging'
  when item_name in ('Weighing Scales', 'Chasen', 'Matcha Bowl', 'Stainless Steel') then 'equipment'
  when item_type = 'material' and lower(coalesce(category, '')) like '%packag%' then 'packaging'
  when item_type = 'material' then 'equipment'
  when lower(coalesce(category, '')) like '%matcha%' or lower(coalesce(category, '')) like '%tea%' then 'base'
  when lower(coalesce(category, '')) like '%milk%' then 'milk'
  when lower(coalesce(category, '')) like '%sweet%' then 'sweetener'
  else 'other'
end;

update public.inventory_items
set needs_maintenance = true,
    maintenance_interval_days = 120
where item_name = 'Chasen';

update public.inventory_items
set needs_maintenance = false,
    maintenance_interval_days = null,
    last_maintained_at = null
where item_type = 'ingredient';

alter table public.inventory_items drop constraint if exists inventory_items_item_type_check;
alter table public.inventory_items add constraint inventory_items_item_type_check
  check (item_type in ('ingredient', 'material')) not valid;

alter table public.inventory_items drop constraint if exists inventory_items_category_check;
alter table public.inventory_items add constraint inventory_items_category_check check (
  (item_type = 'ingredient' and category in ('base', 'milk', 'sweetener', 'flavor', 'addon', 'other')) or
  (item_type = 'material' and category in ('packaging', 'serving', 'equipment'))
) not valid;

alter table public.inventory_items drop constraint if exists inventory_items_unit_check;
alter table public.inventory_items add constraint inventory_items_unit_check
  check (unit in ('g', 'mL', 'pc', 'pkg')) not valid;

alter table public.inventory_items drop constraint if exists inventory_items_pack_size_check;
alter table public.inventory_items add constraint inventory_items_pack_size_check
  check (pack_size is null or (pack_size > 0 and unit = 'pc')) not valid;

alter table public.inventory_items drop constraint if exists inventory_items_maintenance_interval_check;
alter table public.inventory_items add constraint inventory_items_maintenance_interval_check
  check (maintenance_interval_days is null or maintenance_interval_days > 0) not valid;

alter table public.inventory_items drop constraint if exists inventory_items_maintenance_type_check;
alter table public.inventory_items add constraint inventory_items_maintenance_type_check
  check (item_type = 'material' or needs_maintenance = false) not valid;

alter table public.inventory_items drop constraint if exists inventory_items_quantity_nonnegative_check;
alter table public.inventory_items add constraint inventory_items_quantity_nonnegative_check
  check (current_quantity >= 0) not valid;

create unique index if not exists inventory_items_item_name_unique on public.inventory_items (lower(item_name));
create unique index if not exists products_product_name_unique on public.products (lower(product_name));

alter table public.inventory_items validate constraint inventory_items_item_type_check;
alter table public.inventory_items validate constraint inventory_items_category_check;
alter table public.inventory_items validate constraint inventory_items_unit_check;
alter table public.inventory_items validate constraint inventory_items_pack_size_check;
alter table public.inventory_items validate constraint inventory_items_maintenance_interval_check;
alter table public.inventory_items validate constraint inventory_items_maintenance_type_check;
alter table public.inventory_items validate constraint inventory_items_quantity_nonnegative_check;

drop view if exists public.inventory_status;
create view public.inventory_status with (security_invoker = true) as
select i.*,
  case
    when i.current_quantity <= 0 then 'out_of_stock'
    when i.current_quantity <= i.minimum_quantity then 'low_stock'
    else 'ok'
  end as stock_status
from public.inventory_items i;
grant select on public.inventory_status to authenticated;

drop view if exists public.product_availability;
create view public.product_availability with (security_invoker = true) as
select p.*,
       availability.recipe_line_count,
       availability.max_servings,
       availability.limiting_item_name
from public.products p
left join lateral (
  select count(*)::integer as recipe_line_count,
         min(floor(i.current_quantity / nullif(ri.quantity_required, 0))) as max_servings,
         (array_agg(i.item_name order by floor(i.current_quantity / nullif(ri.quantity_required, 0)), i.item_name))[1] as limiting_item_name
  from public.recipes r
  join public.recipe_items ri on ri.recipe_id = r.recipe_id
  join public.inventory_items i on i.inventory_item_id = ri.inventory_item_id
  where r.product_id = p.product_id
) availability on true;
grant select on public.product_availability to authenticated;

commit;

-- inventory_status expands i.* when it is created. Re-run this file after adding
-- inventory_items columns so staff receive the expanded view definition.
