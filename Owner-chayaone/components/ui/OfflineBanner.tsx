'use client';

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { WifiOff, RefreshCw } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/dates';

interface OfflineBannerProps {
  lastUpdatedAt?: string | null;
  className?: string;
  onRetry?: () => void;
}

export function OfflineBanner({ lastUpdatedAt, className = '', onRetry }: OfflineBannerProps) {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 ${className}`}>
      <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">You are offline</p>
        {lastUpdatedAt && (
          <p className="mt-0.5 text-xs text-amber-600">
            Showing data from {formatDateTime(lastUpdatedAt)}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Small inline indicator for cached data state */
export function CacheIndicator({
  isCached = true,
  lastUpdatedAt,
}: {
  isCached?: boolean;
  lastUpdatedAt: string | null;
}) {
  if (!isCached || !lastUpdatedAt) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
      <RefreshCw className="h-3 w-3" />
      Cached · {formatDateTime(lastUpdatedAt)}
    </span>
  );
}
