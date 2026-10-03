-- Phase: Staff PWA — persistent device sessions ("stay logged in" + remote revoke)
-- Additive & idempotent. No drops, no data loss. Safe on a live DB.
-- Apply with: dotenv -e ../../.env -- prisma db execute --file ./prisma/migrations/0006_staff_sessions/migration.sql
--        or:  prisma db push against the updated schema.
--
-- Adds: staff_sessions (one row per logged-in device). Login mints a short access
-- JWT + a long refresh token bound to a row here; the refresh endpoint slides
-- expiresAt/lastSeenAt and enforces revokedAt. lastSeenAt also powers live presence.

CREATE TABLE IF NOT EXISTS "staff_sessions" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"   UUID           NOT NULL,
  "staffId"    UUID           NOT NULL,
  "label"      TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expiresAt"  TIMESTAMPTZ(6) NOT NULL,
  "revokedAt"  TIMESTAMPTZ(6),
  CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_sessions_tenantId_staffId_idx" ON "staff_sessions" ("tenantId", "staffId");
CREATE INDEX IF NOT EXISTS "staff_sessions_staffId_revokedAt_idx" ON "staff_sessions" ("staffId", "revokedAt");

-- FK to staff_users (cascade so removing a staff member clears their devices).
DO $$ BEGIN
  ALTER TABLE "staff_sessions"
    ADD CONSTRAINT "staff_sessions_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "staff_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
