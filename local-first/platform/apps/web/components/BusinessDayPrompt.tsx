'use client';

import { useEffect, useState, useCallback } from 'react';
import { Moon, Clock, ShieldCheck, Check, AlertTriangle, X, ChevronRight } from 'lucide-react';
import type { BusinessDayState } from '@/lib/businessDay';

interface StaffUserProps {
  id?: string | null;
  name?: string | null;
  role?: string | null;
}

export function BusinessDayPrompt({ currentStaff }: { currentStaff?: StaffUserProps | null }) {
  const [state, setState] = useState<BusinessDayState | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/business-day');
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
        setCanManage(data.canManage);
        if (data.shouldPrompt) {
          const now = Date.now();
          if (!snoozedUntil || now > snoozedUntil) {
            setModalOpen(true);
          }
        }
      }
    } catch {
      // safe fallback
    }
  }, [snoozedUntil]);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 60_000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  async function handleAction(action: 'extend' | 'close_day', minutes?: number) {
    if (busy) return;
    setBusy(true);
    setPinError(null);
    try {
      const res = await fetch('/api/dashboard/business-day', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          durationMinutes: minutes,
          managerPin: !canManage && managerPin ? managerPin : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.message || 'Action failed.');
        return;
      }
      setState(data.state);
      setModalOpen(false);
      setShowPinEntry(false);
      setManagerPin('');
      setToastMsg(data.message || 'Updated successfully');
      setTimeout(() => setToastMsg(null), 3500);
    } catch {
      setPinError('Connection error.');
    } finally {
      setBusy(false);
    }
  }

  function snooze() {
    setSnoozedUntil(Date.now() + 15 * 60_000);
    setModalOpen(false);
  }

  if (!modalOpen || !state) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl border text-left flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: 'var(--paper)',
          borderColor: 'var(--line-2)',
          color: 'var(--ink)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Moon size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display">Midnight Service & Day Extension</h3>
              <p className="text-xs text-ink-3">
                Current Business Date: <b className="text-turmeric">{state.currentBusinessDate || 'Today'}</b>
              </p>
            </div>
          </div>
          <button
            onClick={snooze}
            className="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-paper-3 transition"
            title="Snooze 15 min"
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner */}
        <div
          className="p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5"
          style={{
            background: 'color-mix(in srgb, var(--turmeric) 10%, var(--paper-2))',
            borderColor: 'color-mix(in srgb, var(--turmeric) 30%, transparent)',
          }}
        >
          <Clock size={16} className="text-turmeric shrink-0 mt-0.5" />
          <div>
            <b>Shop is still operating past midnight / closing time.</b>
            <p className="mt-1 text-ink-2">
              If the shop is still running, you can <b>Extend the Business Day</b> so all late-night orders remain on the <b>SAME DAY</b> ({state.currentBusinessDate}) and do not roll over to tomorrow.
            </p>
          </div>
        </div>

        {/* Roles restriction check */}
        {!canManage && !showPinEntry && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle size={15} />
              Manager / Owner Authorization Required
            </div>
            <p>
              Only roles above Cashier (Store Manager or Admin/Owner) can extend or close the business day.
            </p>
            <button
              onClick={() => setShowPinEntry(true)}
              className="btn btn-sm btn-secondary self-start mt-1 gap-1.5"
            >
              <ShieldCheck size={14} /> Enter Manager PIN to Authorize
            </button>
          </div>
        )}

        {/* Manager PIN Override for Cashiers */}
        {showPinEntry && !canManage && (
          <div className="flex flex-col gap-2 p-3.5 rounded-xl border bg-paper-2 border-line">
            <label className="text-xs font-bold flex items-center justify-between">
              <span>Enter Manager / Owner PIN:</span>
              <button onClick={() => setShowPinEntry(false)} className="text-ink-3 hover:underline text-[11px]">
                Cancel
              </button>
            </label>
            <input
              type="password"
              maxLength={8}
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
              placeholder="e.g. 1234"
              className="inp text-center tracking-widest text-lg font-mono"
              autoFocus
            />
            {pinError && <p className="text-xs text-red-500 font-medium">{pinError}</p>}
          </div>
        )}

        {/* Actions for Manager/Owner OR with Manager PIN */}
        {(canManage || (showPinEntry && managerPin.length >= 4)) && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="text-xs font-bold text-ink-3 uppercase tracking-wider">Select Day Action</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('extend', 60)}
                className="btn btn-primary py-2.5 px-3 text-xs flex flex-col items-start gap-0.5 text-left"
              >
                <span className="font-bold flex items-center gap-1">
                  <Check size={14} /> Extend +1 Hour
                </span>
                <span className="text-[10px] opacity-80">Keep running on {state.currentBusinessDate}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('extend', 120)}
                className="btn py-2.5 px-3 text-xs flex flex-col items-start gap-0.5 text-left bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
              >
                <span className="font-bold flex items-center gap-1">
                  <Clock size={14} /> Extend +2 Hours
                </span>
                <span className="text-[10px] opacity-80">Keep running on {state.currentBusinessDate}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('extend')}
                className="btn btn-secondary py-2.5 px-3 text-xs flex flex-col items-start gap-0.5 text-left"
              >
                <span className="font-bold flex items-center gap-1">
                  <Moon size={14} /> Keep Open (Same Day)
                </span>
                <span className="text-[10px] opacity-80">Active until manual day close</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('close_day')}
                className="btn py-2.5 px-3 text-xs flex flex-col items-start gap-0.5 text-left bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20"
              >
                <span className="font-bold flex items-center gap-1">
                  <X size={14} /> Close Shop & End Day
                </span>
                <span className="text-[10px] opacity-80">Finalize shift & roll to next day</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
          <span className="text-ink-3">Cutoff: Orders before {state.cutoffHour}:00 AM stay on today</span>
          <button onClick={snooze} className="text-ink-2 hover:underline">
            Snooze (15 min)
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Top Header Status Badge: Only appears / pops up within 30 minutes before closing time
 * or during night extension, keeping the header clean during normal operating hours.
 */
export function BusinessDayHeaderBadge({ className = '' }: { className?: string }) {
  const [state, setState] = useState<BusinessDayState | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [isClosingWindow, setIsClosingWindow] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchStatus = () => {
      fetch('/api/dashboard/business-day')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) {
            setState(d.state);
            setCanManage(d.canManage);
            setIsClosingWindow(!!d.isWithinClosingWindow || !!d.shouldPrompt || !!d.state?.isExtended);
          }
        })
        .catch(() => {});
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [openModal]);

  async function handleQuickExtend(minutes?: number) {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/business-day', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'extend', durationMinutes: minutes }),
      });
      const d = await res.json();
      if (d?.state) setState(d.state);
      setOpenModal(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickClose() {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/business-day', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'close_day' }),
      });
      const d = await res.json();
      if (d?.state) setState(d.state);
      setOpenModal(false);
    } finally {
      setBusy(false);
    }
  }

  // Only appear within 30 minutes before closing time or if extended
  if (!state || (!isClosingWindow && !state.isExtended)) return null;

  const isExtended = state.isExtended;

  return (
    <>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => canManage && setOpenModal(true)}
        title={canManage ? 'Manage Business Day & Night Shift' : `Active Business Day: ${state.currentBusinessDate}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition animate-in fade-in zoom-in-95 duration-200 ${
          canManage ? 'hover:scale-105 cursor-pointer active:scale-95' : 'cursor-default'
        } ${className}`}
        style={{
          background: isExtended
            ? 'color-mix(in srgb, var(--turmeric) 15%, var(--paper-2))'
            : 'color-mix(in srgb, var(--clay, #ef4444) 12%, var(--paper-2))',
          borderColor: isExtended
            ? 'color-mix(in srgb, var(--turmeric) 40%, var(--line))'
            : 'color-mix(in srgb, var(--clay, #ef4444) 35%, var(--line))',
          color: isExtended ? 'var(--turmeric)' : 'var(--clay, #ef4444)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: isExtended ? 'var(--turmeric)' : 'var(--clay, #ef4444)',
            boxShadow: isExtended
              ? '0 0 0 3px rgba(245, 158, 11, 0.25)'
              : '0 0 0 3px rgba(239, 68, 68, 0.25)',
          }}
        />
        <Moon size={12} className="shrink-0" />
        <span>{isExtended ? 'Day Extended' : 'Closing Soon · Day Active'}</span>
        {state.currentBusinessDate && (
          <span className="hidden sm:inline opacity-75 font-mono">· {state.currentBusinessDate.slice(5)}</span>
        )}
      </button>

      {openModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl border text-left flex flex-col gap-4"
            style={{ background: 'var(--paper)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
          >
            <div className="flex items-center justify-between border-b pb-3 border-line">
              <div className="flex items-center gap-2 font-bold font-display text-base">
                <Moon size={18} className="text-turmeric" />
                <span>Business Day Management (Manager/Owner)</span>
              </div>
              <button onClick={() => setOpenModal(false)} className="text-ink-3 hover:text-ink p-1">
                <X size={16} />
              </button>
            </div>

            <div className="text-xs flex flex-col gap-1.5 p-3 rounded-xl bg-paper-2 border border-line">
              <div className="flex justify-between">
                <span className="text-ink-3">Current Business Day:</span>
                <b className="text-turmeric font-mono">{state.currentBusinessDate}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Shift Status:</span>
                <span className="font-bold capitalize">{state.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Closing Time:</span>
                <span>{state.closingTime || '00:00 (Midnight)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Night Cutoff:</span>
                <span>Orders before {state.cutoffHour}:00 AM count for today</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                disabled={busy}
                onClick={() => handleQuickExtend(60)}
                className="btn btn-primary btn-sm justify-between"
              >
                <span>Extend Business Day (+1 Hour)</span>
                <ChevronRight size={14} />
              </button>
              <button
                disabled={busy}
                onClick={() => handleQuickExtend(120)}
                className="btn btn-secondary btn-sm justify-between"
              >
                <span>Extend Business Day (+2 Hours)</span>
                <ChevronRight size={14} />
              </button>
              <button
                disabled={busy}
                onClick={() => handleQuickExtend()}
                className="btn btn-secondary btn-sm justify-between"
              >
                <span>Keep Same Day Open (Until Manual Close)</span>
                <ChevronRight size={14} />
              </button>
              <button
                disabled={busy}
                onClick={handleQuickClose}
                className="btn btn-danger btn-sm justify-between mt-2"
              >
                <span>Close Business Day (Roll to Tomorrow)</span>
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
