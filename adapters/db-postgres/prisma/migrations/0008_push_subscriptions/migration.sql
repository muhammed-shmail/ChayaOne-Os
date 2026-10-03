-- Phase: Staff PWA P3 — Web Push subscriptions
-- Additive & idempotent. No drops, no data loss. Safe on a live DB.
-- Apply with: dotenv -e ../../.env -- prisma db execute --file ./prisma/migrations/0008_push_subscriptions/migration.sql
--        or:  prisma db push against the updated schema.
--
-- Adds push_subscriptions (one row per opted-in browser/device). The notify
-- dispatcher sends Web Push to these so staff alerts reach the phone when the
-- app is closed. Dead endpoints (404/410 on send) are pruned by the app.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"   UUID           NOT NULL,
  "staffId"    UUID           NOT NULL,
  "sessionId"  UUID,
  "endpoint"   TEXT           NOT NULL,
  "p256dh"     TEXT           NOT NULL,
  "auth"       TEXT           NOT NULL,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lastUsedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions" ("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_tenantId_staffId_idx" ON "push_subscriptions" ("tenantId", "staffId");

DO $$ BEGIN
  ALTER TABLE "push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "staff_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
