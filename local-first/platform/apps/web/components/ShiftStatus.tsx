'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, CheckCircle2 } from 'lucide-react';
import { getGeoHeaders } from '@/lib/geo-client';
import { useConfirm } from '@/components/ui';

/**
 * Enhanced interactive on-shift status & attendance punch badge.
 *
 * Self-fetches the caller's open attendance punch (`GET /api/attendance`).
 * Supports direct clock-in ("Mark In") and clock-out ("Out") right from the badge.
 */
export function ShiftStatus({ className = '' }: { className?: string }) {
  const router = useRouter();
  const { confirm: confirmAction, ConfirmDialog } = useConfirm();
  const [clockIn, setClockIn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchAttendance = () => {
    fetch('/api/attendance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const openTime = d?.open?.clockIn;
        if (openTime && Date.now() - new Date(openTime).getTime() > 16 * 3600 * 1000) {
          setClockIn(null);
        } else {
          setClockIn(openTime ?? null);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAttendance();

    const onRefresh = () => fetchAttendance();
    window.addEventListener('attendance-refresh', onRefresh);
    return () => window.removeEventListener('attendance-refresh', onRefresh);
  }, []);

  // Clock in action
  async function markIn() {
    if (busy) return;
    setBusy(true);
    setFeedback('Clocking in...');
    try {
      const geo = await getGeoHeaders();
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...geo },
        body: JSON.stringify({ action: 'in' }),
      });
      const data = await res.json();
      if (res.ok) {
        setClockIn(data.open?.clockIn || new Date().toISOString());
        setFeedback('Clocked in!');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos-entry-sync'));
          window.dispatchEvent(new CustomEvent('attendance-refresh'));
        }
      } else {
        alert(data.message || 'Could not mark attendance — check location/Wi-Fi');
      }
    } catch {
      alert('Network error marking attendance');
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  // Clock out action
  async function markOut() {
    if (busy) return;
    const ok = await confirmAction({
      title: 'Clock Out',
      message: 'Clock out from your shift?',
      confirmText: 'Clock Out',
      isDestructive: false,
    });
    if (!ok) return;
    setBusy(true);
    setFeedback('Clocking out...');
    try {
      const geo = await getGeoHeaders();
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...geo },
        body: JSON.stringify({ action: 'out' }),
      });
      if (res.ok) {
        setClockIn(null);
        setFeedback('Clocked out');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos-entry-sync'));
          window.dispatchEvent(new CustomEvent('attendance-refresh'));
        }
      }
    } catch {
      alert('Network error clocking out');
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  const onShift = !!clockIn;
  const time = clockIn
    ? new Date(clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
      <div
        className={`inline-flex items-center rounded-full overflow-hidden shrink-0 transition ${className}`}
        style={{
          border: `1px solid ${onShift ? 'color-mix(in srgb, var(--cardamom, #10b981) 38%, var(--line, #334155))' : 'var(--line, #334155)'}`,
          background: onShift ? 'color-mix(in srgb, var(--cardamom, #10b981) 12%, var(--paper-2, #1e293b))' : 'var(--paper-2, #1e293b)',
        }}
      >
        <span
          className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-[11px] font-bold whitespace-nowrap"
          style={{ color: onShift ? 'var(--cardamom-d, #34d399)' : 'var(--ink-3, #94a3b8)' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={
              onShift
                ? { background: 'var(--cardamom, #10b981)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--cardamom, #10b981) 25%, transparent)', animation: 'pulse 2s infinite' }
                : { background: 'var(--ink-3, #94a3b8)' }
            }
          />
          {feedback || (onShift ? 'On time' : 'Off shift')}
          {time && !feedback && <span className="tnum hidden min-[380px]:inline" style={{ color: 'var(--ink-2, #cbd5e1)' }}>· {time}</span>}
        </span>

        {onShift ? (
          <button
            type="button"
            onClick={markOut}
            disabled={busy}
            aria-label="Clock out from shift"
            title="Clock out"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
            style={{
              minHeight: 30,
              borderLeft: '1px solid color-mix(in srgb, var(--cardamom, #10b981) 30%, var(--line, #334155))',
              color: 'var(--ink-2, #cbd5e1)',
            }}
          >
            <LogOut size={13} aria-hidden /> Out
          </button>
        ) : (
          <button
            type="button"
            onClick={markIn}
            disabled={busy}
            aria-label="Mark Attendance (Clock in)"
            title="Mark your attendance"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
            style={{
              minHeight: 30,
              borderLeft: '1px solid var(--line, #334155)',
              color: 'var(--cardamom-d, #34d399)',
              background: 'color-mix(in srgb, var(--cardamom, #10b981) 15%, transparent)',
            }}
          >
            <CheckCircle2 size={13} aria-hidden /> Mark In
          </button>
        )}
      </div>
      <ConfirmDialog />
    </>
  );
}
