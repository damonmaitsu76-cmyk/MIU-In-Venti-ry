-- Tamper-resistant stock, inventory, product, and recipe audit trail. Safe to re-run.
-- Seed scripts set app.audit_skip for their transaction to avoid fake historical rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Staff'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select id, coalesce(nullif(split_part(email, '@', 1), ''), 'Staff') from auth.users
on conflict (id) do nothing;

create table if not exists public.audit_log (
  audit_id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  batch_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  entity_type text not null check (entity_type in ('inventory_item', 'product')),
  entity_id bigint,
  entity_name text,
  action text not null,
  source text not null default 'manual',
  quantity_before numeric,
  quantity_after numeric,
  quantity_delta numeric,
  unit text,
  pack_size numeric,
  changes jsonb,
  note text
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

create or replace function public.audit_actor_name()
returns text language plpgsql security definer set search_path = public as $$
declare name text;
begin
  select display_name into name from public.profiles where id = auth.uid();
  return coalesce(name, nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''), 'System');
end $$;

create or replace function public.stamp_inventory_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.audit_inventory_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare source_value text := coalesce(nullif(current_setting('app.audit_source', true), ''), 'manual');
declare note_value text := nullif(current_setting('app.audit_note', true), '');
declare batch_value uuid := nullif(current_setting('app.audit_batch', true), '')::uuid;
declare changes_value jsonb;
declare action_value text;
begin
  if current_setting('app.audit_skip', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source, quantity_after, unit, pack_size)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'inventory_item', new.inventory_item_id, new.item_name, 'created', source_value, new.current_quantity, new.unit, new.pack_size);
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source, quantity_before, unit, pack_size)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'inventory_item', old.inventory_item_id, old.item_name, 'deleted', source_value, old.current_quantity, old.unit, old.pack_size);
    return old;
  end if;

  if old.current_quantity is distinct from new.current_quantity then
    action_value := case source_value
      when 'order' then 'order_deduction'
      when 'restock' then 'restock'
      when 'usage' then 'usage'
      when 'correction' then 'correction'
      when 'conversion' then 'unit_converted'
      else case when new.current_quantity > old.current_quantity then 'restock' else 'usage' end
    end;
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source, quantity_before, quantity_after, quantity_delta, unit, pack_size, note)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'inventory_item', new.inventory_item_id, new.item_name, action_value, source_value,
      old.current_quantity, new.current_quantity, new.current_quantity - old.current_quantity, new.unit, new.pack_size, note_value);
  end if;

  if old.last_maintained_at is distinct from new.last_maintained_at then
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source, changes)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'inventory_item', new.inventory_item_id, new.item_name, 'maintenance', source_value,
      jsonb_build_object('last_maintained_at', jsonb_build_object('old', old.last_maintained_at, 'new', new.last_maintained_at)));
  end if;

  changes_value := jsonb_strip_nulls(jsonb_build_object(
    'item_name', case when old.item_name is distinct from new.item_name then jsonb_build_object('old', old.item_name, 'new', new.item_name) end,
    'item_type', case when old.item_type is distinct from new.item_type then jsonb_build_object('old', old.item_type, 'new', new.item_type) end,
    'category', case when old.category is distinct from new.category then jsonb_build_object('old', old.category, 'new', new.category) end,
    'unit', case when old.unit is distinct from new.unit then jsonb_build_object('old', old.unit, 'new', new.unit) end,
    'pack_size', case when old.pack_size is distinct from new.pack_size then jsonb_build_object('old', old.pack_size, 'new', new.pack_size) end,
    'minimum_quantity', case when old.minimum_quantity is distinct from new.minimum_quantity then jsonb_build_object('old', old.minimum_quantity, 'new', new.minimum_quantity) end,
    'needs_maintenance', case when old.needs_maintenance is distinct from new.needs_maintenance then jsonb_build_object('old', old.needs_maintenance, 'new', new.needs_maintenance) end,
    'maintenance_interval_days', case when old.maintenance_interval_days is distinct from new.maintenance_interval_days then jsonb_build_object('old', old.maintenance_interval_days, 'new', new.maintenance_interval_days) end
  ));
  if changes_value <> '{}'::jsonb then
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source, changes)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'inventory_item', new.inventory_item_id, new.item_name, 'edited', source_value, changes_value);
  end if;
  return new;
end $$;

create or replace function public.audit_product_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare source_value text := coalesce(nullif(current_setting('app.audit_source', true), ''), 'manual');
declare batch_value uuid := nullif(current_setting('app.audit_batch', true), '')::uuid;
declare changes_value jsonb;
declare action_value text;
begin
  if current_setting('app.audit_skip', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'product', new.product_id, new.product_name, 'created', source_value);
    return new;
  end if;
  if tg_op = 'DELETE' then
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'product', old.product_id, old.product_name, 'deleted', source_value);
    return old;
  end if;
  action_value := case
    when old.is_active and not new.is_active then 'archived'
    when not old.is_active and new.is_active then 'restored'
    else 'edited'
  end;
  changes_value := jsonb_strip_nulls(jsonb_build_object(
    'product_name', case when old.product_name is distinct from new.product_name then jsonb_build_object('old', old.product_name, 'new', new.product_name) end,
    'price', case when old.price is distinct from new.price then jsonb_build_object('old', old.price, 'new', new.price) end,
    'is_active', case when old.is_active is distinct from new.is_active then jsonb_build_object('old', old.is_active, 'new', new.is_active) end,
    'image_path', case when old.image_path is distinct from new.image_path then jsonb_build_object('old', old.image_path, 'new', new.image_path) end
  ));
  if changes_value <> '{}'::jsonb then
    insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source, changes)
    values (batch_value, auth.uid(), public.audit_actor_name(), 'product', new.product_id, new.product_name, action_value, source_value, changes_value);
  end if;
  return new;
end $$;

create or replace function public.audit_recipe_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare product_id_value bigint;
declare product_name_value text;
declare item_name_value text;
declare recipe_id_value bigint;
declare item_id_value bigint;
declare source_value text := coalesce(nullif(current_setting('app.audit_source', true), ''), 'manual');
declare batch_value uuid := nullif(current_setting('app.audit_batch', true), '')::uuid;
begin
  if current_setting('app.audit_skip', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    recipe_id_value := old.recipe_id;
    item_id_value := old.inventory_item_id;
  else
    recipe_id_value := new.recipe_id;
    item_id_value := new.inventory_item_id;
  end if;
  select r.product_id into product_id_value from public.recipes r where r.recipe_id = recipe_id_value;
  select product_name into product_name_value from public.products where product_id = product_id_value;
  select item_name into item_name_value from public.inventory_items where inventory_item_id = item_id_value;
  if product_id_value is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  insert into public.audit_log (batch_id, actor_id, actor_name, entity_type, entity_id, entity_name, action, source, changes)
  values (batch_value, auth.uid(), public.audit_actor_name(), 'product', product_id_value, product_name_value, 'recipe_changed', source_value,
    jsonb_build_object('item_name', item_name_value, 'old_quantity', case when tg_op = 'INSERT' then null else old.quantity_required end, 'new_quantity', case when tg_op = 'DELETE' then null else new.quantity_required end));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists inventory_stamp_updated on public.inventory_items;
create trigger inventory_stamp_updated before update on public.inventory_items for each row execute function public.stamp_inventory_updated_at();
drop trigger if exists inventory_audit_change on public.inventory_items;
create trigger inventory_audit_change after insert or update or delete on public.inventory_items for each row execute function public.audit_inventory_change();
drop trigger if exists product_audit_change on public.products;
create trigger product_audit_change after insert or update or delete on public.products for each row execute function public.audit_product_change();
drop trigger if exists recipe_item_audit_change on public.recipe_items;
create trigger recipe_item_audit_change after insert or update or delete on public.recipe_items for each row execute function public.audit_recipe_item_change();

do $$
declare foreign_key_name text;
begin
  select conname into foreign_key_name
  from pg_constraint
  where conrelid = 'public.inventory_items'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.inventory_items'::regclass and attname = 'updated_by')];
  if foreign_key_name is not null then
    execute format('alter table public.inventory_items drop constraint %I', foreign_key_name);
  end if;
  alter table public.inventory_items add constraint inventory_items_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;
exception when duplicate_object then null;
end $$;

alter table public.audit_log enable row level security;
alter table public.profiles enable row level security;
drop policy if exists "staff read audit log" on public.audit_log;
create policy "staff read audit log" on public.audit_log for select to authenticated using (true);
drop policy if exists "staff read profiles" on public.profiles;
drop policy if exists "staff update own profile" on public.profiles;
create policy "staff read profiles" on public.profiles for select to authenticated using (true);
create policy "staff update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.audit_log from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_log') then
    alter publication supabase_realtime add table public.audit_log;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory_items') then
    alter publication supabase_realtime add table public.inventory_items;
  end if;
end $$;
