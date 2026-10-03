import { getPendingOutboxEntries, markOutboxSynced, markOutboxFailed } from '../outbox';
import { SyncStatus } from '@cafeos/db';

export interface SyncBatchResult {
  processed: number;
  synced: number;
  failed: number;
  offline: boolean;
  errors: string[];
}

let isProcessing = false;
let syncWorkerTimer: NodeJS.Timeout | null = null;

/**
 * Check if internet / cloud sync capability is active.
 */
export function isCloudSyncEnabled(): boolean {
  return process.env.CHAYAONE_CLOUD_ENABLED === 'true' && !!process.env.CHAYAONE_CLOUD_URL;
}

/**
 * Process a single batch of pending outbox records.
 */
export async function processOutboxBatch(batchSize = 50): Promise<SyncBatchResult> {
  if (isProcessing) {
    return { processed: 0, synced: 0, failed: 0, offline: false, errors: ['Worker already processing'] };
  }

  isProcessing = true;
  const result: SyncBatchResult = {
    processed: 0,
    synced: 0,
    failed: 0,
    offline: false,
    errors: [],
  };

  try {
    const entries = await getPendingOutboxEntries(batchSize);
    if (entries.length === 0) {
      return result;
    }

    result.processed = entries.length;

    // Check offline status
    if (!isCloudSyncEnabled()) {
      result.offline = true;
      // In offline / standalone local mode, outbox entries accumulate safely in PENDING status
      return result;
    }

    const cloudUrl = process.env.CHAYAONE_CLOUD_URL!.replace(/\/$/, '');
    const apiKey = process.env.CHAYAONE_CLOUD_API_KEY || 'local-dev-key';

    // Group events by causalGroup to preserve dependency order
    for (const entry of entries) {
      try {
        const response = await fetch(`${cloudUrl}/api/sync/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-Event-ID': entry.eventId,
          },
          body: JSON.stringify({
            eventId: entry.eventId,
            tenantId: entry.tenantId,
            outletId: entry.outletId,
            entityType: entry.entityType,
            entityId: entry.entityId,
            operation: entry.operation,
            sequenceNo: entry.sequenceNo.toString(),
            causalGroup: entry.causalGroup,
            payload: entry.payload,
            createdAt: entry.createdAt.toISOString(),
          }),
          signal: AbortSignal.timeout(5000), // 5s network timeout
        });

        if (response.ok || response.status === 200 || response.status === 201) {
          await markOutboxSynced(entry.id);
          result.synced++;
        } else if (response.status === 400 || response.status === 422) {
          const detail = await response.text().catch(() => 'Validation error');
          await markOutboxFailed(entry.id, detail, 'VALIDATION_ERROR');
          result.failed++;
          result.errors.push(`Entry ${entry.id} validation failed: ${detail}`);
        } else {
          const detail = await response.text().catch(() => 'Server error');
          await markOutboxFailed(entry.id, detail, 'SERVER_ERROR');
          result.failed++;
          result.errors.push(`Entry ${entry.id} server error (${response.status}): ${detail}`);
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'Network unreachable';
        await markOutboxFailed(entry.id, errorMsg, 'NETWORK_ERROR');
        result.failed++;
        result.errors.push(`Entry ${entry.id} network error: ${errorMsg}`);
      }
    }
  } catch (globalErr: any) {
    result.errors.push(`Global sync error: ${globalErr?.message || globalErr}`);
  } finally {
    isProcessing = false;
  }

  return result;
}

/**
 * Start the autonomous background Sync Worker loop.
 */
export function startSyncWorker(intervalMs = 15000) {
  if (syncWorkerTimer) return;

  syncWorkerTimer = setInterval(async () => {
    try {
      await processOutboxBatch();
    } catch (err) {
      console.error('[SYNC WORKER ERROR]', err);
    }
  }, intervalMs);
}

/**
 * Stop the background Sync Worker loop.
 */
export function stopSyncWorker() {
  if (syncWorkerTimer) {
    clearInterval(syncWorkerTimer);
    syncWorkerTimer = null;
  }
}
