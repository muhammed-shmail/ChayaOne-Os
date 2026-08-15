-- Configurable kitchens: convert the fixed Station enum columns to free-text
-- kitchen slugs. Kitchens are now defined per-outlet in Outlet.settings.kitchens
-- (see apps/web/lib/kitchens.ts). The built-in defaults 'kitchen' | 'bar' |
-- 'dessert' remain valid values, so existing menu items / order lines / KOTs are
-- carried over untouched.
--
-- Apply with: dotenv -e ../../.env -- prisma db execute --file ./prisma/migrations/0010_configurable_kitchens/migration.sql
--        or:  prisma db push against the updated schema.

-- 1) Widen the three station columns from the "Station" enum to TEXT.
--    USING ...::text preserves every existing value verbatim (idempotent: a
--    TEXT->TEXT rewrite with the same cast is a harmless no-op on re-run).
ALTER TABLE "menu_items"  ALTER COLUMN "station" TYPE TEXT USING "station"::text;
ALTER TABLE "order_items" ALTER COLUMN "station" TYPE TEXT USING "station"::text;
ALTER TABLE "kots"        ALTER COLUMN "station" TYPE TEXT USING "station"::text;

-- 2) Drop the now-unused enum type (guarded so re-runs don't error).
DROP TYPE IF EXISTS "Station";
