-- DESTRUCTIVE, DEVELOPMENT ONLY. Safe by default because the first block aborts.
-- Delete the guard below only for an intentionally disposable development database.

do $$ begin raise exception 'DEV RESET DISABLED — delete this block to run'; end $$;

begin;
select set_config('app.audit_skip', 'on', true);
truncate table public.audit_log, public.recipe_items, public.recipes, public.inventory_items, public.products restart identity;
commit;

-- After the intentionally disabled reset completes, run seed.sql manually.
-- SQL Editor cannot include another local file, so seed content is not duplicated here.
