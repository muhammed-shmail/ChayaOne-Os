import { offlineDB, OfflineOperation } from './indexeddb';

export class SyncManager {
  private isSyncing = false;
  private listeners: ((status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR') => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
      window.addEventListener('offline', () => this.notify('OFFLINE'));
    }
  }

  public subscribe(listener: (status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR') => void) {
    this.listeners.push(listener);
    if (typeof window !== 'undefined') {
      this.notify(navigator.onLine ? 'ONLINE' : 'OFFLINE');
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR') {
    this.listeners.forEach(l => l(status));
  }

  public async queueOperation(type: OfflineOperation['type'], payload: any): Promise<OfflineOperation> {
    await offlineDB.init();
    
    // Idempotency: enforce clientOperationId
    const clientOperationId = payload.clientOperationId || Math.random().toString(36).substring(2, 15);
    payload.clientOperationId = clientOperationId;
    
    const op: OfflineOperation = {
      clientOperationId,
      type,
      payload,
      status: 'PENDING_SYNC',
      createdAt: Date.now(),
      retryCount: 0
    };
    
    await offlineDB.saveOperation(op);
    
    if (typeof window !== 'undefined' && navigator.onLine) {
      this.sync();
    }
    
    return op;
  }

  public async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify('SYNCING');
    
    try {
      await offlineDB.init();
      const pending = await offlineDB.getPendingOperations();
      
      if (pending.length === 0) {
        this.notify('ONLINE');
        this.isSyncing = false;
        return;
      }
      
      for (const op of pending) {
        try {
          const res = await fetch(`/api/sync/operation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op)
          });
          
          if (!res.ok) {
            const errorBody = await res.json();
            // Handle explicit conflict resolution
            if (res.status === 409) {
              console.warn(`Conflict for operation ${op.clientOperationId}:`, errorBody);
              // Explicitly marking as error to let UI resolve
              op.status = 'SYNC_ERROR';
              op.lastError = errorBody.message || 'Conflict';
              await offlineDB.saveOperation(op);
              continue;
            }
            throw new Error(`Sync failed with status ${res.status}`);
          }
          
          await offlineDB.removeOperation(op.clientOperationId);
        } catch (err: any) {
          op.retryCount += 1;
          op.status = 'SYNC_ERROR';
          op.lastError = err.message;
          await offlineDB.saveOperation(op);
        }
      }
      
      // Check if any errors remain
      const remaining = await offlineDB.getPendingOperations();
      this.notify(remaining.some(r => r.status === 'SYNC_ERROR') ? 'SYNC_ERROR' : 'ONLINE');
    } catch (err) {
      console.error('Fatal sync error:', err);
      this.notify('SYNC_ERROR');
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncManager = new SyncManager();
