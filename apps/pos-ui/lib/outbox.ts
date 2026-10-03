import crypto from 'crypto';
import { prisma, type Prisma, SyncOperation, SyncStatus } from '@cafeos/db';

export interface CreateOutboxParams {
  tenantId: string;
  outletId: string;
  eventId?: string;
  entityType: 'Order' | 'Payment' | 'Refund' | 'StockLedger' | 'LoyaltyLedger' | 'Customer' | 'MenuItem' | string;
  entityId: string;
  operation?: SyncOperation;
  payload: Record<string, any>;
  causalGroup?: string;
}

/**
 * Atomically create a SyncOutbox event record inside an existing Prisma transaction.
 */
export async function createOutboxEntry(
  tx: Prisma.TransactionClient,
  params: CreateOutboxParams,
) {
  const eventId = params.eventId || crypto.randomUUID();
  const operation = params.operation || SyncOperation.CREATE;

  return await tx.syncOutbox.create({
    data: {
      tenantId: params.tenantId,
      outletId: params.outletId,
      eventId,
      entityType: params.entityType,
      entityId: params.entityId,
      operation,
      payload: params.payload as Prisma.InputJsonValue,
      causalGroup: params.causalGroup || `${params.entityType.toLowerCase()}:${params.entityId}`,
      status: SyncStatus.PENDING,
    },
  });
}

/**
 * Query pending outbox entries scheduled for processing (availableAt <= now).
 */
export async function getPendingOutboxEntries(limit = 50) {
  return await prisma.syncOutbox.findMany({
    where: {
      status: { in: [SyncStatus.PENDING, SyncStatus.FAILED] },
      availableAt: { lte: new Date() },
    },
    orderBy: { sequenceNo: 'asc' },
    take: limit,
  });
}

/**
 * Calculate exponential backoff date based on retry attempt count.
 */
export function getExponentialBackoffDate(attempts: number): Date {
  // Base delay: 2 seconds, exponential factor: 2^attempts, max delay: 5 minutes (300,000 ms)
  const delayMs = Math.min(300_000, Math.pow(2, attempts) * 2000);
  return new Date(Date.now() + delayMs);
}

/**
 * Mark outbox entry as SYNCED.
 */
export async function markOutboxSynced(id: string) {
  return await prisma.syncOutbox.update({
    where: { id },
    data: {
      status: SyncStatus.SYNCED,
      processedAt: new Date(),
      lastError: null,
      errorCode: null,
    },
  });
}

/**
 * Mark outbox entry as FAILED with exponential backoff or DEAD if max attempts exceeded.
 */
export async function markOutboxFailed(
  id: string,
  error: string,
  errorCode?: string,
  maxAttempts = 10,
) {
  const existing = await prisma.syncOutbox.findUnique({
    where: { id },
    select: { attempts: true },
  });

  const attempts = (existing?.attempts ?? 0) + 1;
  const isDead = attempts >= maxAttempts || errorCode === 'VALIDATION_ERROR';

  return await prisma.syncOutbox.update({
    where: { id },
    data: {
      attempts,
      status: isDead ? SyncStatus.DEAD : SyncStatus.FAILED,
      availableAt: isDead ? new Date('2099-01-01') : getExponentialBackoffDate(attempts),
      lastError: error.slice(0, 500),
      errorCode: errorCode || 'NETWORK_ERROR',
    },
  });
}
