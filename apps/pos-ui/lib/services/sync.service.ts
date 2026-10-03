import { prisma, SyncStatus } from '@cafeos/db';
import { processOutboxBatch, isCloudSyncEnabled } from '../sync/worker';
import { getPendingOutboxEntries } from '../outbox';

export class SyncService {
  /**
   * Checks if cloud synchronization is enabled and reachable.
   */
  static isCloudEnabled(): boolean {
    return isCloudSyncEnabled();
  }

  /**
   * Returns current pending and failed outbox queue statistics.
   */
  static async getQueueStats(outletId?: string) {
    const where = outletId ? { outletId } : {};
    const [pending, processing, synced, failed] = await Promise.all([
      prisma.syncOutbox.count({ where: { ...where, status: SyncStatus.PENDING } }),
      prisma.syncOutbox.count({ where: { ...where, status: SyncStatus.PROCESSING } }),
      prisma.syncOutbox.count({ where: { ...where, status: SyncStatus.SYNCED } }),
      prisma.syncOutbox.count({ where: { ...where, status: SyncStatus.FAILED } }),
    ]);

    return {
      cloudEnabled: isCloudSyncEnabled(),
      pending,
      processing,
      synced,
      failed,
    };
  }

  /**
   * Processes a batch of pending synchronization records towards the cloud.
   */
  static async processBatch(batchSize = 50) {
    return await processOutboxBatch(batchSize);
  }
}
