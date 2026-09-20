-- Authoritative inventory classification refresh. Safe to re-run.
-- It does not invent missing items, recipes, or product prices.

begin;
select set_config('app.audit_skip', 'on', true);

create temporary table if not exists _miu_inventory_seed (
  item_name text primary key,
  item_type text not null,
  category text not null,
  unit text not null,
  pack_size numeric,
  minimum_quantity numeric not null,
  needs_maintenance boolean not null,
  maintenance_interval_days integer,
  reset_from_pc_to_pkg boolean not null default false
) on commit drop;

truncate _miu_inventory_seed;
insert into _miu_inventory_seed values
('Yabukita Matcha', 'ingredient', 'base', 'g', null, 100, false, null, false),
('Hojicha Matcha', 'ingredient', 'base', 'g', null, 100, false, null, false),
('Multi-Cultivar Matcha', 'ingredient', 'base', 'g', null, 100, false, null, false),
('Earl Grey Tea Bags', 'ingredient', 'base', 'pc', null, 10, false, null, false),
('Oatside (Oat Milk)', 'ingredient', 'milk', 'mL', null, 1000, false, null, false),
('Agave', 'ingredient', 'sweetener', 'mL', null, 250, false, null, false),
('Condensed Milk', 'ingredient', 'sweetener', 'mL', null, 250, false, null, false),
('Evaporated Milk', 'ingredient', 'sweetener', 'mL', null, 250, false, null, false),
('Heavy Cream', 'ingredient', 'addon', 'mL', null, 250, false, null, false),
('Ube Flavor', 'ingredient', 'flavor', 'mL', null, 100, false, null, false),
('Ube Jam', 'ingredient', 'flavor', 'g', null, 200, false, null, false),
('Iodized Sea Salt', 'ingredient', 'flavor', 'g', null, 100, false, null, false),
('Milo', 'ingredient', 'flavor', 'g', null, 200, false, null, false),
('Ice', 'ingredient', 'other', 'g', null, 0, false, null, false),
('Weighing Scales', 'material', 'equipment', 'pc', null, 0, false, null, false),
('Chasen', 'material', 'equipment', 'pc', null, 0, true, 120, false),
('Matcha Bowl', 'material', 'equipment', 'pc', null, 0, false, null, false),
('Stainless Steel', 'material', 'equipment', 'pc', null, 0, false, null, false),
('Cups', 'material', 'serving', 'pkg', null, 1, false, null, true),
('Straws', 'material', 'serving', 'pkg', null, 1, false, null, true),
('Cellophane (Single)', 'material', 'packaging', 'pkg', null, 1, false, null, true),
('Cellophane (Double)', 'material', 'packaging', 'pkg', null, 1, false, null, true),
('Parchment Paper', 'material', 'packaging', 'pkg', null, 1, false, null, true),
('Tissue', 'material', 'packaging', 'pkg', null, 1, false, null, true);

do $$
declare row record;
begin
  for row in
    select i.inventory_item_id, i.item_name
    from public.inventory_items i
    join _miu_inventory_seed s using (item_name)
    where s.reset_from_pc_to_pkg and i.unit = 'pc'
  loop
    update public.inventory_items set current_quantity = 0 where inventory_item_id = row.inventory_item_id;
    raise notice 'Reset % to 0 pkg: re-count this item in whole packages.', row.item_name;
  end loop;
end $$;

insert into public.inventory_items (
  item_name, item_type, category, unit, pack_size, minimum_quantity,
  needs_maintenance, maintenance_interval_days, current_quantity
)
select item_name, item_type, category, unit, pack_size, minimum_quantity,
       needs_maintenance, maintenance_interval_days, 0
from _miu_inventory_seed
on conflict (lower(item_name)) do update set
  item_type = excluded.item_type,
  category = excluded.category,
  unit = excluded.unit,
  pack_size = excluded.pack_size,
  minimum_quantity = case when public.inventory_items.minimum_quantity = 0 then excluded.minimum_quantity else public.inventory_items.minimum_quantity end,
  needs_maintenance = excluded.needs_maintenance,
  maintenance_interval_days = excluded.maintenance_interval_days,
  last_maintained_at = case when excluded.needs_maintenance then public.inventory_items.last_maintained_at else null end;

commit;
