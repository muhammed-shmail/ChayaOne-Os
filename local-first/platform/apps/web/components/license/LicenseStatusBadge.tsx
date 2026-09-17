'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import type { LicenseStatusResponse } from '@cafeos/types';

interface LicenseStatusBadgeProps {
  className?: string;
  onOpenRenewModal?: () => void;
}

export default function LicenseStatusBadge({
  className = '',
  onOpenRenewModal,
}: LicenseStatusBadgeProps) {
  const [data, setData] = useState<LicenseStatusResponse | null>(null);
  const [showPopover, setShowPopover] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/license/status');
        if (res.ok && mounted) {
          const json: LicenseStatusResponse = await res.json();
          setData(json);
        }
      } catch {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000); // 30s poll
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!data) return null;

  const isExpired = data.isExpired || data.status === 'EXPIRED';
  const isExpiring = data.isExpiringSoon || data.status === 'EXPIRING_SOON';

  // Badge styling
  let dotColor = '#16a34a'; // green
  let textColor = 'var(--ink-2)';
  let bg = 'color-mix(in srgb, var(--cardamom) 12%, var(--paper-3))';
  let border = '1px solid color-mix(in srgb, var(--cardamom) 25%, transparent)';
  let label = 'ChayaOne · Active';

  if (isExpired) {
    dotColor = '#dc2626'; // red
    textColor = 'var(--clay)';
    bg = 'color-mix(in srgb, var(--clay) 12%, var(--paper-3))';
    border = '1px solid color-mix(in srgb, var(--clay) 30%, transparent)';
    label = 'ChayaOne · Expired';
  } else if (isExpiring) {
    dotColor = '#eab308'; // amber
    textColor = 'var(--gold-d)';
    bg = 'color-mix(in srgb, var(--gold) 14%, var(--paper-3))';
    border = '1px solid color-mix(in srgb, var(--gold-d) 35%, transparent)';
    label = `ChayaOne · Expires in ${data.daysRemaining}d`;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition hover:opacity-90 active:scale-95"
        style={{ background: bg, border, color: textColor }}
        title="View ChayaOne License Status"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
          }}
        />
        <span>{label}</span>
      </button>

      {/* Popover */}
      {showPopover && (
        <div
          className="absolute left-0 top-full mt-2 w-72 rounded-[18px] p-4 shadow-[var(--sh-3)] z-[999] text-left border anim-fade"
          style={{
            background: 'var(--paper-2)',
            borderColor: 'var(--line)',
            color: 'var(--ink)',
          }}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line)]">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-[var(--gold)]" />
              <span>ChayaOne License</span>
            </div>
            <button
              onClick={() => setShowPopover(false)}
              className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] font-bold px-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[var(--ink-3)] font-medium">Status:</span>
              <span className="font-extrabold uppercase" style={{ color: dotColor }}>
                {data.status}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[var(--ink-3)] font-medium">Remaining:</span>
              <span className="font-bold">
                {data.daysRemaining > 0
                  ? `${data.daysRemaining} days (${data.hoursRemaining} hrs)`
                  : 'Expired'}
              </span>
            </div>

            {data.license?.expiryDate && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--ink-3)] font-medium">Expires On:</span>
                <span className="font-mono text-[11px]">
                  {new Date(data.license.expiryDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            <div className="pt-2 mt-2 border-t border-[var(--line)]">
              <span className="text-[10px] text-[var(--ink-3)] block uppercase tracking-wider font-bold mb-0.5">
                Installation ID
              </span>
              <span className="font-mono text-[10.5px] text-[var(--ink-2)] select-all break-all block bg-[var(--paper-3)] p-1.5 rounded-lg border border-[var(--line-2)]">
                {data.installationId}
              </span>
            </div>

            {onOpenRenewModal && (
              <button
                type="button"
                onClick={() => {
                  setShowPopover(false);
                  onOpenRenewModal();
                }}
                className="w-full mt-3 py-2 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-xs rounded-[10px] border border-[var(--gold-d)] shadow-[var(--sh-1)] transition"
              >
                Activate / Renew License
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
