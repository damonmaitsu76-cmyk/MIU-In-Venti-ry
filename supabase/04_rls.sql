-- Legacy-table RLS and RPC grants. Safe to re-run. Apply before production handover.
-- Smoke-test every signed-in workflow immediately after applying this file.

alter table public.products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;

drop policy if exists "staff manage products" on public.products;
drop policy if exists "staff manage inventory" on public.inventory_items;
drop policy if exists "staff manage recipes" on public.recipes;
drop policy if exists "staff manage recipe items" on public.recipe_items;
create policy "staff manage products" on public.products for all to authenticated using (true) with check (true);
create policy "staff manage inventory" on public.inventory_items for all to authenticated using (true) with check (true);
create policy "staff manage recipes" on public.recipes for all to authenticated using (true) with check (true);
create policy "staff manage recipe items" on public.recipe_items for all to authenticated using (true) with check (true);

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
