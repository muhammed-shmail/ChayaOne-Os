export const DB_NAME = 'chayaone-offline-db';
export const STORE_NAME = 'offline_operations';

export interface OfflineOperation {
  clientOperationId: string;
  type: 'CREATE_ORDER' | 'UPDATE_ORDER' | 'CANCEL_ORDER';
  payload: any;
  status: 'PENDING_SYNC' | 'SYNCED' | 'SYNC_ERROR';
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export class OfflineDB {
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'clientOperationId' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB', event);
        reject('Failed to open IndexedDB');
      };
    });
  }

  public async saveOperation(op: OfflineOperation): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(op);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getPendingOperations(): Promise<OfflineOperation[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result as OfflineOperation[];
        resolve(all.filter(op => op.status === 'PENDING_SYNC' || op.status === 'SYNC_ERROR'));
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async removeOperation(clientOperationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(clientOperationId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineDB = new OfflineDB();
