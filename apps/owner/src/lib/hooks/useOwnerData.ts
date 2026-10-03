'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { cacheGet, cacheSet, cacheKey } from '@/lib/cache/idb';
import { useOnlineStatus } from './useOnlineStatus';

interface UseOwnerDataOptions<T> {
  /** URL to fetch from (owner API) */
  url:       string;
  /** Tenant-scoped cache key params */
  cacheParams: {
    tenantId:  string;
    outletId:  string | null;
    dataType:  string;
    suffix?:   string;
  };
  /** Whether to skip fetching (e.g., context not loaded yet) */
  skip?:     boolean;
  /** Auto-refresh interval in ms (0 = no auto-refresh) */
  refreshMs?: number;
}

interface UseOwnerDataResult<T> {
  data:           T | null;
  loading:        boolean;
  error:          string | null;
  isOffline:      boolean;
  isCached:       boolean;
  lastUpdatedAt:  string | null;
  refresh:        () => void;
}

/**
 * Data fetching hook with IndexedDB offline fallback.
 *
 * Behavior:
 *  ONLINE:  Fetch from API → display → save to IndexedDB cache
 *  OFFLINE: Load from IndexedDB → display with "last updated" timestamp
 *  RECONNECT: Automatically refetch latest data
 *  API FAIL: Fall back to cache if available
 */
export function useOwnerData<T>({
  url,
  cacheParams,
  skip = false,
  refreshMs = 0,
}: UseOwnerDataOptions<T>): UseOwnerDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const { isOnline, justCameOnline } = useOnlineStatus();
  const key = cacheKey(cacheParams);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (skip) return;
    setLoading(true);
    setError(null);

    if (!isOnline) {
      // Try cache
      const cached = await cacheGet<T>(key);
      if (cached) {
        setData(cached.data);
        setLastUpdatedAt(cached.lastUpdatedAt);
        setIsCached(true);
      } else {
        setError('offline');
      }
      setLoading(false);
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json: T = await res.json();
      setData(json);
      setIsCached(false);
      const now = new Date().toISOString();
      setLastUpdatedAt(now);

      // Persist to cache
      await cacheSet(key, cacheParams, json);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;

      // API failed — try cache
      const cached = await cacheGet<T>(key);
      if (cached) {
        setData(cached.data);
        setLastUpdatedAt(cached.lastUpdatedAt);
        setIsCached(true);
        setError('api_failed_using_cache');
      } else {
        setError((err as Error).message ?? 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, [url, key, isOnline, skip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch + reconnect refetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reconnect: automatically refetch
  useEffect(() => {
    if (justCameOnline) fetchData();
  }, [justCameOnline, fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshMs || skip) return;
    const id = setInterval(fetchData, refreshMs);
    return () => clearInterval(id);
  }, [fetchData, refreshMs, skip]);

  return {
    data,
    loading,
    error,
    isOffline:     !isOnline,
    isCached,
    lastUpdatedAt,
    refresh:       fetchData,
  };
}
