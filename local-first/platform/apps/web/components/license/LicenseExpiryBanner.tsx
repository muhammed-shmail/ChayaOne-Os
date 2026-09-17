'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { LicenseStatusResponse } from '@cafeos/types';

interface LicenseExpiryBannerProps {
  onRenewClick?: () => void;
}

export default function LicenseExpiryBanner({ onRenewClick }: LicenseExpiryBannerProps) {
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch('/api/license/status');
        if (res.ok && mounted) {
          const data: LicenseStatusResponse = await res.json();
          setStatus(data);
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (dismissed || !status) return null;

  // Only show warning exactly when daysRemaining <= 10 and not yet expired
  const shouldShow =
    status.isConfigured &&
    !status.isExpired &&
    (status.isExpiringSoon || status.daysRemaining <= 10);

  if (!shouldShow) return null;

  const daysText =
    status.daysRemaining === 0
      ? 'today'
      : `in ${status.daysRemaining} day${status.daysRemaining === 1 ? '' : 's'}`;

  return (
    <aside
      aria-label="License Expiry Warning"
      className="w-full px-4 py-2 flex items-center justify-between gap-3 text-xs font-bold transition-all z-[800]"
      style={{
        background: 'linear-gradient(90deg, #92400e, #b45309)',
        color: '#fef3c7',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
        <span className="truncate">
          Your ChayaOne license expires {daysText}. Contact Nuro7 Team for renewal.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRenewClick && (
          <button
            type="button"
            onClick={onRenewClick}
            className="px-2.5 py-1 rounded-[8px] bg-amber-200 hover:bg-amber-100 text-amber-950 text-[11px] font-extrabold transition shadow-sm"
          >
            Renew Now
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-200 hover:text-white px-1 font-bold text-xs"
          title="Dismiss warning"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
