/**
 * Tenant-aware IndexedDB cache for the Owner Dashboard PWA.
 *
 * Cache keys are ALWAYS scoped by:
 *   tenantId + outletId + dataType + (optional) dateRange
 *
 * This prevents cross-tenant and cross-store data leakage.
 * On logout, call clearUserCache(tenantId) to invalidate sensitive data.
 */

const DB_NAME = 'chayaone-owner-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('tenantId', 'tenantId', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db!);
    };

    req.onerror = () => reject(req.error);
  });
}

interface CacheEntry {
  key:           string;
  tenantId:      string;
  outletId:      string | null;
  dataType:      string;
  data:          unknown;
  lastUpdatedAt: string;
  expiresAt:     number;  // timestamp ms
}

/**
 * Build a deterministic, tenant-scoped cache key.
 * Never use a generic key like "dashboard" — always include context.
 */
export function cacheKey(params: {
  tenantId:  string;
  outletId:  string | null;
  dataType:  string;
  suffix?:   string;
}): string {
  const parts = [
    `t:${params.tenantId}`,
    `o:${params.outletId ?? 'all'}`,
    `d:${params.dataType}`,
  ];
  if (params.suffix) parts.push(params.suffix);
  return parts.join('|');
}

/**
 * Read a cached value. Returns null if not found or expired.
 */
export async function cacheGet<T>(key: string): Promise<{
  data: T;
  lastUpdatedAt: string;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (!entry) return resolve(null);
        if (Date.now() > entry.expiresAt) return resolve(null);
        resolve({ data: entry.data as T, lastUpdatedAt: entry.lastUpdatedAt });
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Write a value to the cache.
 * @param ttlMs — time-to-live in milliseconds (default: 1 hour)
 */
export async function cacheSet<T>(
  key: string,
  params: { tenantId: string; outletId: string | null; dataType: string },
  data: T,
  ttlMs = 60 * 60 * 1000,
): Promise<void> {
  try {
    const db = await openDB();
    const entry: CacheEntry = {
      key,
      tenantId:      params.tenantId,
      outletId:      params.outletId,
      dataType:      params.dataType,
      data,
      lastUpdatedAt: new Date().toISOString(),
      expiresAt:     Date.now() + ttlMs,
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Clear all cached data for a given tenant.
 * Call this on logout to prevent one user from seeing another's data.
 */
export async function clearTenantCache(tenantId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const idx = store.index('tenantId');
      const req = idx.openCursor(IDBKeyRange.only(tenantId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Clear ALL cached data (used on full logout when tenant is unknown).
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
    });
  } catch {
    // Non-fatal
  }
}
