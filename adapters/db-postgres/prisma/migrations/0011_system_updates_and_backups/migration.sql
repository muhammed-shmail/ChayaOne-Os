-- CreateTable
CREATE TABLE "system_update_history" (
    "id" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "previousVersion" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(20) NOT NULL DEFAULT 'stable',
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "releaseDate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releaseNotes" JSONB,
    "errorDetails" TEXT,
    "diagnosticRefId" VARCHAR(100),
    "installedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "metadata" JSONB,

    CONSTRAINT "system_update_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_backup_logs" (
    "id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "filepath" VARCHAR(500) NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "backupType" VARCHAR(50) NOT NULL DEFAULT 'AUTOMATIC_UPDATE',
    "checksum" VARCHAR(128) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'VALID',
    "dbVersion" VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_diagnostic_logs" (
    "id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_diagnostic_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_update_history_version_status_idx" ON "system_update_history"("version", "status");

-- CreateIndex
CREATE INDEX "system_update_history_installedAt_idx" ON "system_update_history"("installedAt");

-- CreateIndex
CREATE INDEX "database_backup_logs_backupType_status_idx" ON "database_backup_logs"("backupType", "status");

-- CreateIndex
CREATE INDEX "database_backup_logs_createdAt_idx" ON "database_backup_logs"("createdAt");

-- CreateIndex
CREATE INDEX "system_diagnostic_logs_category_severity_idx" ON "system_diagnostic_logs"("category", "severity");

-- CreateIndex
CREATE INDEX "system_diagnostic_logs_createdAt_idx" ON "system_diagnostic_logs"("createdAt");
