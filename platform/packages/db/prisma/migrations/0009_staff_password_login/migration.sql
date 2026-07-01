-- Staff username + password login (secure sign-in for owner/manager dashboard roles)
-- Additive & idempotent. No drops, no data loss. Safe on a live DB.
-- Apply with: dotenv -e ../../.env -- prisma db execute --file ./prisma/migrations/0009_staff_password_login/migration.sql
--        or:  prisma db push against the updated schema.
--
-- NOTE: these two columns and the unique index were previously only applied via
-- `prisma db push` and had no migration file, so migrate-based deploys (e.g.
-- Railway) never created them — the password-login query then throws (500).
-- This file backfills that drift.

-- 1) Optional username + scrypt password hash on staff_users. Existing rows keep
--    NULLs (PIN-only staff). scrypt hash format: scrypt$<saltHex>$<keyHex>.
ALTER TABLE "staff_users" ADD COLUMN IF NOT EXISTS "username"     TEXT;
ALTER TABLE "staff_users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- 2) Username is unique per tenant (NULLs allowed & non-colliding in Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS "staff_users_tenantId_username_key"
  ON "staff_users" ("tenantId", "username");
