# MIU In-Venti-ry audit

Audited 2026-09-26 against this checkout's source and SQL files. This source audit does not establish which migrations are deployed or what data is present in the live Supabase project.

## Route and navigation

There is no router package. `App.jsx` uses a hash route for Dashboard, Order, Inventory, Products, and Activity. The selected page survives a refresh and supports links such as `#/activity`. A Supabase session gates the pages; signed-out users see `Login`.

## Data access

| Area | Current reads | Current writes |
| --- | --- | --- |
| Dashboard | `inventory_status`, `product_availability`, and recipe-item checks for whole-package materials | Stock adjustments through `adjust_inventory` / `set_inventory_count` in its shared inventory dialog |
| Inventory | `inventory_status` | Direct `inventory_items` insert/update/delete for item details, maintenance and deletion; `adjust_inventory`, `set_inventory_count`, and `convert_item_to_pack` RPCs for stock and unit changes |
| Products | `products`, `inventory_items`, and a selected product's `recipes` / `recipe_items` | `save_product` RPC for product and recipe rows; direct product deletion; Storage upload/removal for images |
| Order | `product_availability`, `inventory_status`, and recipe-item checks for whole-package materials | One `checkout_order` RPC at checkout |
| Custom order | Selected base product's `recipes` / `recipe_items` | Added to the in-memory cart, then included in `checkout_order` |
| Activity | `audit_log` pages and `profiles` for staff filters | No client write; CSV export is local |

The client calls `adjust_inventory`, `set_inventory_count`, `convert_item_to_pack`, `save_product`, and `checkout_order`. `OrderEntry.jsx` calls `checkout_order({ p_lines })` once with an array containing `{ kind: 'standard', product_id, qty }` and `{ kind: 'custom', base_product_id, qty, ingredients }` lines. `02_stock_rpcs.sql` defines `checkout_order(p_lines jsonb)` and checks stock before deducting it in the same function. This contract is implemented in the checkout and SQL source. `submit_order`, `get_orderable_products`, and `check_product_availability` are not called by the current client.

## SQL files in this checkout

- `supabase/01_inventory_model.sql`: Adds inventory type, pack, maintenance and product image-path fields; normalizes known legacy values; enforces constraints; creates `inventory_status` and `product_availability` views.
- `supabase/02_stock_rpcs.sql`: Defines atomic stock adjustment/count, pack conversion, product-and-recipe save, and checkout RPCs, with authenticated execution grants.
- `supabase/03_audit_log.sql`: Creates staff profiles and the audit log, adds inventory/product/recipe-item audit triggers, and sets audit/profile read policies.
- `supabase/04_rls.sql`: Enables row-level security and authenticated staff policies on the legacy product, inventory, recipe and recipe-item tables.
- `supabase/05_storage_product_images.sql`: Ensures `products.image_path`, creates the public `product-images` bucket, and defines authenticated Storage policies.
- `supabase/seed.sql`: Classifies the approved inventory list and inserts missing inventory items at zero quantity; it does not seed products, prices or recipes. Its documented `pc` to `pkg` conversion resets affected counts for a recount.
- `supabase/dev_reset.sql`: Development-only destructive truncation script with an exception guard that must be removed intentionally before use.
- `supabase/dev_sample_recipes.sql`: Comment-only reminder for optional disposable development data; it inserts no recipe rows.

`supabase/README.md` gives the intended migration order. File presence does not prove that any of these scripts ran against the live database.

## Existing field assumptions in source

- Inventory reads `inventory_status`, whose SQL marks `current_quantity <= 0` out of stock and then `current_quantity <= minimum_quantity` low stock. The dashboard and inventory page use its `stock_status` value.
- Inventory source uses `item_type`, `category`, `unit`, `pack_size`, `needs_maintenance`, `maintenance_interval_days`, and `last_maintained_at`. Pack-tracked pieces use `pc` with `pack_size`; a whole-package `pkg` item is blocked from recipes.
- `image_path` is the active product image field. `ImageUpload.jsx` and `ProductDashboard.jsx` use the Storage upload flow; `images.js` builds a public URL from `image_path` and retains `image_url` only as a legacy display fallback. `05_storage_product_images.sql` adds the active column and bucket policies.
- Product and recipe-row saves use `save_product` in one RPC. An image upload/removal is a separate Storage operation, so that file step is outside the database transaction.

## Selects, number fields, and controls

The checked selects pass Base UI's `items` prop: `ActivityLog.jsx`'s `FilterSelect`, `ItemSelect.jsx`, `IngredientList.jsx`'s status and category selects (also its unit select), and `OrderEntry.jsx`'s custom-order base-product select. `ProductDashboard.jsx` uses `ItemSelect` for recipe rows. Each inspected site supplies value-to-label items.

Quantity and price inputs use `NumberField` where needed. Inventory and product dialogs use `DialogBody` plus `DialogFooter`; inventory's dialog triggers use Base UI's `render` prop. The navigation and data views have responsive mobile and wider-screen layouts, with intentional overflow for constrained content.

## CSS and shell audit

`src/index.css` contains the Tailwind/theme definitions and light-mode `--background`; `public/favicon.svg` is the brand favicon. `vite.config.js` uses an ESM-compatible alias based on `process.cwd()`. There is no `App.css` in this checkout.

## Low-stock reproduction

The checked-in `inventory_status` view evaluates out of stock first (`current_quantity <= 0`), then low stock (`current_quantity <= minimum_quantity`). The client presents those values using `StatusBadge` and the status filter's labels. The checked-in view explains the intended threshold behavior; a live-data reproduction still requires querying the deployed database.

## Known open gaps

No checked-in seed supplies `recipe_items` for real products: `seed.sql` only seeds inventory, and `dev_sample_recipes.sql` inserts nothing. With that repository-provided data alone, `product_availability.max_servings` is null (or zero for an existing recipe whose ingredients lack stock) for every product, so nothing is orderable end-to-end. Real recipe quantities and product mappings must come from the client; they cannot be inferred from this repository. Live database contents were not verified in this audit.

## Baseline checks

The project defines `npm run build` and `npm run lint` as its source checks. Their result for the connectivity changes is reported separately with the implementation.

## Prompt/repository differences

The checked-out app already includes the dashboard, products, custom order, activity log, hash navigation, typed inventory model, single-RPC checkout and SQL scripts listed above. Any older plain-table description or earlier RPC name must be checked against the current source before use.
