# Supabase run order

Apply these files in the Supabase SQL editor, one at a time, in this exact order:

1. `01_inventory_model.sql`
2. `02_stock_rpcs.sql`
3. `03_audit_log.sql`
4. `05_storage_product_images.sql`
5. `seed.sql`
6. Smoke-test while signed in.
7. `04_rls.sql`, then repeat the signed-in smoke test before handing the app to the client.

All files above are intended to be safe to re-run. `01_inventory_model.sql` recreates `inventory_status`; run it again after any future `alter table inventory_items add column` because PostgreSQL freezes a view's `i.*` expansion at create time.

`01` deliberately creates the nullable `products.image_path` column before `02`, because the transactional `save_product` RPC needs it. `05` owns the storage bucket and storage policies and repeats the column guard for safe standalone re-runs.

`seed.sql` classifies only items named in the approved inventory list. It preserves all current quantities except for the six listed consumables the first time each is changed from `pc` to whole-package `pkg`, where it resets the quantity to zero and emits a notice for a staff recount. It does not create products, prices, or recipes because the repository contains no authoritative product-seed list.

Useful verification queries:

```sql
select item_type, category, unit, pack_size, count(*)
from inventory_items
group by 1, 2, 3, 4
order by 1, 2;

select stock_status, count(*) from inventory_status group by 1;

select * from audit_log order by audit_id desc limit 10;
```

After `04_rls.sql`, verify signed-out reads are denied or empty, signed-in staff can complete all workflows, and direct client insert/update/delete on `audit_log` fails.
