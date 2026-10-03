-- Migration 0012: Add expenses table and related finance tables
-- Created to match schema.prisma models not covered by previous migrations.

-- ─── Expenses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "expenses" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "outletId"     UUID         NOT NULL,
    "businessDate" TEXT         NOT NULL,
    "category"     TEXT         NOT NULL,
    "vendor"       TEXT,
    "amountPaise"  INTEGER      NOT NULL,
    "gstPaise"     INTEGER      NOT NULL DEFAULT 0,
    "method"       TEXT         NOT NULL DEFAULT 'cash',
    "status"       TEXT         NOT NULL DEFAULT 'approved',
    "approvedBy"   TEXT,
    "paidAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "notes"        TEXT,
    "reference"    TEXT,
    "createdById"  UUID,
    "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "expenses_outletId_businessDate_idx" ON "expenses"("outletId", "businessDate");
CREATE INDEX IF NOT EXISTS "expenses_outletId_paidAt_idx"       ON "expenses"("outletId", "paidAt");

-- FK to outlets
ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_outletId_fkey"
    FOREIGN KEY ("outletId")
    REFERENCES "outlets"("id")
    ON UPDATE CASCADE
    ON DELETE CASCADE;

-- ─── FinancialYear ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "financial_years" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"     UUID         NOT NULL,
    "outletId"     UUID,
    "name"         TEXT         NOT NULL,
    "startDate"    TEXT         NOT NULL,
    "endDate"      TEXT         NOT NULL,
    "status"       TEXT         NOT NULL DEFAULT 'active',
    "isDefault"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "closedAt"     TIMESTAMPTZ,
    "closedById"   UUID,
    "closedByName" TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "financial_years_tenantId_idx"  ON "financial_years"("tenantId");
CREATE INDEX IF NOT EXISTS "financial_years_outletId_idx"  ON "financial_years"("outletId");
