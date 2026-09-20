# MIU In-Venti-ry audit

Audited 2026-09-20 against the checked-out repository. The running code is ahead of the prompt's old plain-table snapshot, but not yet aligned with the requested data model. There are no SQL files in this checkout, so database schema, view definitions, RLS state, and live data could not be inspected locally.

## Route and navigation

There is no router. `App.jsx` keeps an in-memory `view` state and switches between Inventory, Order entry, and Products. The current selection does not survive refresh or support deep links. Authentication is a Supabase session gate; signed-out users see `Login` only.

## Data access

| Area | Current reads | Current writes |
| --- | --- | --- |
| Inventory | `inventory_full_status` in `IngredientList.jsx` | Direct `inventory_items.insert`, plus direct `inventory_items.update` for quantity, maintenance interval, and last-maintained timestamp |
| Products | `products`, `inventory_items`, `recipes`, `recipe_items` in `ProductDashboard.jsx` | Product insert/update, then separate recipe lookup/insert/update, recipe-item delete, and recipe-item insert |
| Order | `get_orderable_products` RPC | `submit_order` RPC |
| Custom order | `check_product_availability` RPC | Added to in-memory cart; checkout is included in `submit_order` |

The RPCs currently called by the client are:

- `get_orderable_products()`
- `submit_order({ p_product_lines, p_custom_lines })`
- `check_product_availability({ p_product_id, p_qty })`

`press_product` is not called by the checked-out client. Checkout is already one client RPC call, but the current payload is split into product and custom arrays rather than the requested single `checkout_order(p_lines jsonb)` contract. The database implementation cannot be verified here.

## Existing field assumptions in source

- Inventory list reads `inventory_full_status`, not the prompt's `inventory_status`.
- Source uses `maintenance_interval_days` and `last_maintained_at`; it currently treats `category === 'equipment'` as the maintenance condition. There is no `needs_maintenance` field in current client code.
- Products use `image_url`; `image_path` is not used.
- Product saves are not transactional: a product can be written before a recipe or its recipe items fail.

## Selects, number fields, and controls

All current selects omit Base UI's `items` prop, so their triggers can render raw values rather than labels. This affects inventory category/status filters, the custom-order base-product picker, and the product recipe-item picker. Installed Base UI 1.8.0 exposes `items` on `Select.Root`, confirming the prompt's proposed fix is supported.

Number inputs occur in the add/update inventory dialogs, custom-order quantity and line amounts, and product price/recipe rows. Native spinners remain enabled. The two dialogs with potentially long content use `overflow-y-auto`, but their action footer is not sticky.

`DialogTrigger asChild` appears twice in `IngredientList.jsx`; Base UI dialogs use `render`, so these are nested-button risks. No `alert()` calls were found. The navigation and table wrapper can show horizontal scrollbars.

## CSS and shell audit

`App.css` is unused Vite-template/hero CSS and is safe to remove. `index.css` retains Vite template typography, colors, dark-mode media overrides, custom code/counter styles, and unrelated `#social` styling. It advertises `color-scheme: light dark`, which explains native dark scrollbars and number steppers on an otherwise light app. `index.html` points to `/public/favicon.ico`; public assets are served from `/`, and `public/favicon.svg` exists.

## Low-stock reproduction

The client correctly displays a `low_stock` value as “Low stock”, but the status select trigger can display the raw `ok` / `low_stock` / `out_of_stock` value. The live view's threshold expression cannot be reproduced without database access. The local code relies on `inventory_full_status`, whose definition is absent, and therefore cannot establish whether its column list is stale or whether seeded minimums are zero. The migration will recreate the requested `inventory_status` view with the specified `<= 0` then `<= minimum` order.

## Baseline checks

- `npm run build`: passed. Vite warned that the old `__dirname` alias is incompatible with its upcoming native config loader.
- `npm run lint`: failed before application changes because `vite.config.js` referenced undefined `__dirname`. The config is adjusted in this audit commit to use an ESM URL path so lint and build can be required for subsequent commits.

## Prompt/repository differences

- The repository already has product cards, a custom-order modal, product editing, maintenance UI, and a single-RPC checkout, unlike the older snapshot mentioned in the prompt.
- The checked-out inventory view is named `inventory_full_status`, not `inventory_status`.
- No existing SQL migrations or schema exports were found, so existing database object definitions must be treated as unverified and migrations are written defensively.
