-- Phase: Staff PWA P2 — notification targeting (staff notification bar)
-- Additive & idempotent. No drops, no data loss. Safe on a live DB.
-- Apply with: dotenv -e ../../.env -- prisma db execute --file ./prisma/migrations/0007_notification_targeting/migration.sql
--        or:  prisma db push against the updated schema.
--
-- Adds audience + target columns so a notification can be aimed at the owner
-- bell (default — existing behaviour), all floor staff, a role, or one staff
-- member. DEFAULT 'owner' backfills existing rows, so the owner bell is unchanged.

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "targetRole" "StaffRole";
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "targetStaffId" UUID;

CREATE INDEX IF NOT EXISTS "notifications_outletId_audience_createdAt_idx"
  ON "notifications" ("outletId", "audience", "createdAt");
