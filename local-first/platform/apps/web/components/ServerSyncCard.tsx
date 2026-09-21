'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Settings, Wifi, WifiOff, Trash2, CheckCircle2 } from 'lucide-react';

interface ServerSyncCardProps {
  className?: string;
  onManualSync?: () => Promise<void> | void;
  compact?: boolean;
}

export function ServerSyncCard({ className = '', onManualSync, compact = false }: ServerSyncCardProps) {
  const [serverIp, setServerIp] = useState<string>('');
  const [serverPort, setServerPort] = useState<string>('3000');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);


  // Detect server address from AndroidBridge or window.location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const bridge = (window as any).AndroidBridge;
      const ip = bridge?.getServerIp?.() || window.location.hostname;
      const port = bridge?.getServerPort?.() || window.location.port || '3000';
      setServerIp(ip);
      setServerPort(port);
    }
  }, []);

  const triggerSync = useCallback(async (isAutomatic = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // 1. Ping server to verify connectivity
      const res = await fetch('/api/server/info', { cache: 'no-store' })
        .then((r) => r.ok)
        .catch(() => false);

      // Fallback check root if /api/server/info doesn't respond
      const alive = res ? true : await fetch('/', { method: 'HEAD', cache: 'no-store' }).then(() => true).catch(() => false);

      setIsOnline(alive);

      if (alive) {
        // 2. Trigger parent or internal sync
        if (onManualSync) {
          await onManualSync();
        }
        // Broadcast custom events for POS, Tables, Attendance to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos-sync-now'));
          window.dispatchEvent(new CustomEvent('attendance-refresh'));
        }

        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeStr);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onManualSync]);

  // 1. Periodic Time-based Server Check & Auto-Sync (Every 12 seconds)
  useEffect(() => {
    let wasOffline = false;
    const interval = setInterval(async () => {
      try {
        const ping = await fetch('/api/server/info', { cache: 'no-store' })
          .then((r) => r.ok)
          .catch(() => false);
        
        setIsOnline(ping);

        // "IF ANY CASE CONNECT": When transitioning from offline to online, auto-sync immediately!
        if (ping && wasOffline) {
          wasOffline = false;
          triggerSync(true);
        } else if (!ping) {
          wasOffline = true;
        }
      } catch {
        wasOffline = true;
        setIsOnline(false);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [triggerSync]);

  // 2. Automatic Sync on Each Entry (Listens for order creation, payments, table updates)
  useEffect(() => {
    const handleEntrySync = () => {
      triggerSync(true);
    };

    window.addEventListener('pos-entry-sync', handleEntrySync);
    return () => window.removeEventListener('pos-entry-sync', handleEntrySync);
  }, [triggerSync]);

  // Open native Android settings or web settings
  const handleOpenSettings = () => {
    if (typeof window !== 'undefined') {
      const bridge = (window as any).AndroidBridge;
      if (bridge?.openSettings) {
        bridge.openSettings();
      } else {
        window.location.href = '/setup';
      }
    }
  };

  // Cache removal mechanism to maintain silky-smooth operations
  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      const bridge = (window as any).AndroidBridge;
      if (bridge?.clearAppCache) {
        bridge.clearAppCache();
      }
      // Clean stale browser storage entries
      try {
        const keysToKeep = ['token', 'user', 'session', 'staff_user'];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !keysToKeep.some((k) => key.toLowerCase().includes(k))) {
            // prune temporary caches
            if (key.startsWith('cache_') || key.startsWith('tmp_')) {
              localStorage.removeItem(key);
            }
          }
        }
      } catch {}
      setCacheMessage('Cache cleaned!');
      setTimeout(() => setCacheMessage(null), 2500);
    }
  };

  const displayHost = serverIp ? `${serverIp}:${serverPort}` : 'Connecting...';

  return (
    <div
      className={`rounded-xl ${compact ? 'p-2 gap-1.5' : 'p-2.5 sm:p-3 gap-2 sm:gap-2.5'} border flex flex-col transition ${className}`}
      style={{
        background: 'var(--paper-3, #1e293b)',
        borderColor: isOnline ? 'color-mix(in srgb, var(--cardamom, #10b981) 40%, var(--line, #334155))' : 'color-mix(in srgb, var(--clay, #ef4444) 40%, var(--line, #334155))',
      }}
    >
      {/* Header: Status & IP */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`${compact ? 'w-2 h-2' : 'w-2 sm:w-2.5 h-2 sm:h-2.5'} rounded-full shrink-0`}
            style={{
              background: isOnline ? 'var(--cardamom, #10b981)' : 'var(--clay, #ef4444)',
              boxShadow: isOnline
                ? '0 0 0 2px color-mix(in srgb, var(--cardamom, #10b981) 25%, transparent)'
                : '0 0 0 2px color-mix(in srgb, var(--clay, #ef4444) 25%, transparent)',
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className={`${compact ? 'text-[11px]' : 'text-[11px] sm:text-[12px]'} font-extrabold truncate leading-tight`} style={{ color: 'var(--ink, #ffffff)' }}>
              {displayHost}
            </span>
            <span className={`${compact ? 'text-[8.5px]' : 'text-[9px] sm:text-[10px]'} font-medium leading-none`} style={{ color: 'var(--ink-3, #94a3b8)' }}>
              {isOnline ? 'Main PC Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        {/* Sync Status Badge */}
        <span
          className={`${compact ? 'text-[8.5px] px-1.5 py-0.5' : 'text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5'} font-semibold rounded-md shrink-0`}
          style={{
            background: isOnline ? 'color-mix(in srgb, var(--cardamom, #10b981) 15%, var(--paper, #0f172a))' : 'color-mix(in srgb, var(--clay, #ef4444) 15%, var(--paper, #0f172a))',
            color: isOnline ? 'var(--cardamom-d, #34d399)' : 'var(--clay, #f87171)',
          }}
        >
          {isSyncing ? 'Syncing...' : isOnline ? `Synced ${lastSyncTime}` : 'Offline'}
        </span>
      </div>

      {/* Remote Link moved to Settings → App Cores & Extensions */}

      {/* Action Buttons Row */}
      <div className={`grid grid-cols-3 ${compact ? 'gap-1 pt-0.5' : 'gap-1.5 pt-1'}`}>
        {/* Sync Now Button */}
        <button
          type="button"
          onClick={() => triggerSync(false)}
          disabled={isSyncing}
          aria-label="Sync with Server"
          title="Sync orders and data with Main PC"
          className={`inline-flex items-center justify-center gap-1 ${compact ? 'py-1 px-1 rounded-lg text-[9.5px]' : 'py-1.5 sm:py-2 px-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px]'} font-bold transition active:scale-95 disabled:opacity-50`}
          style={{
            background: 'var(--ink, #0f172a)',
            color: 'var(--paper-2, #ffffff)',
            border: '1px solid var(--line, #334155)',
          }}
        >
          <RefreshCw size={compact ? 11 : 12} className={isSyncing ? 'animate-spin' : ''} aria-hidden />
          <span>Sync</span>
        </button>

        {/* Server Reconfigure / Settings Button */}
        <button
          type="button"
          onClick={handleOpenSettings}
          aria-label="Server Settings / Scan QR"
          title="Configure Server or Scan QR"
          className={`inline-flex items-center justify-center gap-1 ${compact ? 'py-1 px-1 rounded-lg text-[9.5px]' : 'py-1.5 sm:py-2 px-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px]'} font-bold transition active:scale-95`}
          style={{
            background: 'var(--paper-2, #1e293b)',
            color: 'var(--ink, #ffffff)',
            border: '1px solid var(--line, #334155)',
          }}
        >
          <Settings size={compact ? 11 : 12} aria-hidden />
          <span>Setup</span>
        </button>

        {/* Auto Cache Clean Button */}
        <button
          type="button"
          onClick={handleClearCache}
          aria-label="Clear App Cache"
          title="Smooth App Operations"
          className={`inline-flex items-center justify-center gap-1 ${compact ? 'py-1 px-1 rounded-lg text-[9.5px]' : 'py-1.5 sm:py-2 px-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px]'} font-bold transition active:scale-95`}
          style={{
            background: 'var(--paper-2, #1e293b)',
            color: 'var(--ink-2, #cbd5e1)',
            border: '1px solid var(--line, #334155)',
          }}
        >
          <Trash2 size={compact ? 11 : 12} aria-hidden />
          <span>Cache</span>
        </button>
      </div>

      {cacheMessage && (
        <div className="text-[9px] text-center font-bold text-emerald-400">
          ✓ {cacheMessage}
        </div>
      )}
    </div>
  );
}
