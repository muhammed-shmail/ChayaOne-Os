'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAGES, STAGE_ORDER, stageOf } from '@/lib/orderStatus';
import { LogOut, Download, LayoutDashboard } from '@/components/ui';
import StaffBell from '@/components/StaffBell';
import { useStaffInstall } from '@/components/staff-install';
import { isOffline } from '@/components/online';
import { kitchenName, kitchenColor, type Kitchen } from '@/lib/kitchens';
import type { KitchenWorkflowConfig } from '@/lib/kitchenWorkflow';
import { subscribeStaff } from '@/lib/realtime-client';

type Ticket = {
  id: string;
  number: number;
  table: string;
  type: string;
  status: string;
  placedAt: number;
  customerName: string | null;
  items: { name: string; qty: number; station: string | null; modifiers: { name: string }[]; notes: string | null }[];
  /** set client-side when a ticket completes — drives the auto-clear linger */
  doneAt?: number;
};

/** one consolidated prep line — the same item summed across every live table */
type Batch = {
  key: string;
  name: string;
  station: string | null;
  modifiers: { name: string }[];
  qty: number;
  oldest: number; // epoch ms of the earliest contributing ticket
  from: { table: string; type: string; qty: number }[];
};

const ACTIVE = ['open', 'in_kitchen', 'ready'];
const FS_SCALE: Record<KitchenWorkflowConfig['fontSize'], number> = { small: 0.9, medium: 1, large: 1.2, xl: 1.45 };

/** translucent chip styling from a kitchen's accent colour */
function chipStyle(color: string | null) {
  if (!color) return { background: 'var(--paper-3)', color: 'var(--ink-2)' };
  return { background: `${color}2b`, color };
}

/** sort key for "table number" ordering — takeaway sinks to the bottom */
function tblKey(t: Ticket): string {
  return t.type === 'takeaway' || !t.table || t.table === '—' ? '~~~' : t.table;
}

export default function KdsClient({ outletName, initial, kitchens, workflow, staff, staffAppEnabled = false }: { outletName: string; initial: Ticket[]; kitchens: Kitchen[]; workflow: KitchenWorkflowConfig; staff: { id: string; role: string }; staffAppEnabled?: boolean }) {
  const router = useRouter();
  const staffInstall = useStaffInstall();
  const showInstallApp = staffAppEnabled && staffInstall.available;
  const wf = workflow;
  const [tickets, setTickets] = useState<Ticket[]>(initial);
  // Petpooja-style "accept the order" step: a ticket reads as NEW until the
  // line cook acknowledges it, after which it shows as Preparing. Tickets that
  // were already past 'in_kitchen' on load are treated as accepted. When
  // Auto-Accept is on, every ticket is pre-acknowledged (no accept tap needed).
  const [acked, setAcked] = useState<Set<string>>(() =>
    wf.autoAcceptOrders
      ? new Set(initial.map((t) => t.id))
      : new Set(initial.filter((t) => t.status !== 'in_kitchen' && t.status !== 'open').map((t) => t.id)),
  );
  const [station, setStation] = useState<string>('all');
  // 'tickets' = per-order cards; 'batch' = read-only "make once" prep totals
  const [mode, setMode] = useState<'tickets' | 'batch'>('tickets');
  // filter tabs: All + every configured kitchen (falls back to the 3 defaults)
  const tabs = useMemo(() => [{ id: 'all', name: 'All' }, ...kitchens.map((k) => ({ id: k.id, name: k.name }))], [kitchens]);
  // null until mounted, so SSR and the first client render agree (no live clock
  // during hydration → no "Text content did not match" mismatch)
  const [now, setNow] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const liveRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const [inIframe, setInIframe] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.self !== window.top) {
      setInIframe(true);
    }
  }, []);

  // age-based urgency, honouring the outlet's delay threshold + highlight toggle
  const lateMs = wf.delayThresholdMin * 60_000;
  const urgency = (ageMs: number): 'fresh' | 'warn' | 'late' => {
    if (!wf.highlightDelayed) return 'fresh';
    if (ageMs > lateMs) return 'late';
    if (ageMs > lateMs / 2) return 'warn';
    return 'fresh';
  };

  // short chime when a new order lands (best-effort — the AudioContext may stay
  // suspended until the cook first taps the screen; it resumes after that)
  const chime = () => {
    if (!wf.soundNotification) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = audioRef.current ?? (audioRef.current = new AC());
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.36);
    } catch { /* audio unavailable — silent */ }
  };

  // 1s clock for the escalating timers — starts only after mount
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // auto-clear sweep: drop completed (served) tickets once they've lingered past
  // the configured delay. autoClearSec = -1 (Never) keeps them on screen.
  useEffect(() => {
    if (now === null || wf.autoClearSec <= 0) return;
    const cutoff = now - wf.autoClearSec * 1000;
    setTickets((prev) => {
      const next = prev.filter((t) => t.doneAt === undefined || t.doneAt > cutoff);
      return next.length === prev.length ? prev : next;
    });
  }, [now, wf.autoClearSec]);

  // realtime subscription (Supabase private channel for this outlet)
  useEffect(() => {
    return subscribeStaff(
      (msg) => {
        if (msg.type === 'order.new') {
          // pulse the live dot + chime
          if (liveRef.current) { liveRef.current.style.animation = 'none'; void liveRef.current.offsetWidth; liveRef.current.style.animation = ''; }
          chime();
          setTickets((prev) => (prev.some((t) => t.id === msg.ticket.id) ? prev : [...prev, msg.ticket as Ticket]));
          if (wf.autoAcceptOrders) setAcked((prev) => new Set(prev).add(msg.ticket.id));
        } else if (msg.type === 'order.updated') {
          const status = msg.ticket.status;
          setTickets((prev) => {
            const without = prev.filter((t) => t.id !== msg.ticket.id);
            if (ACTIVE.includes(status)) return [...without, msg.ticket as Ticket];
            if (status === 'cancelled') return without; // cancelled tickets just vanish
            // served / settled — linger per the auto-clear setting (0 = immediate)
            if (wf.autoClearSec === 0) return without;
            return [...without, { ...(msg.ticket as Ticket), doneAt: Date.now() }];
          });
        }
      },
      (s) => setConnected(s === 'connected'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf.autoAcceptOrders, wf.autoClearSec, wf.soundNotification]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  async function bump(id: string) {
    const t = tickets.find((x) => x.id === id);
    if (!t) return;
    const stage = stageOf(t.status, acked.has(id));

    // tapping a completed (lingering) ticket dismisses it early
    if (t.doneAt !== undefined || stage === 'served') {
      setTickets((prev) => prev.filter((x) => x.id !== id));
      return;
    }

    // Stage 1 — NEW → Preparing is just an on-screen acknowledgement; the order
    // is already 'in_kitchen' on the server, so no round-trip is needed.
    if (stage === 'new') {
      setAcked((prev) => new Set(prev).add(id));
      return;
    }

    // Read-only offline — don't advance the persisted lifecycle (the optimistic
    // update would diverge from the server). The offline banner explains why.
    if (isOffline()) return;

    // Stage 2+ — advance the persisted lifecycle. Optimistic; the server confirms.
    // Serving a ticket lingers it per the auto-clear setting instead of vanishing.
    setTickets((prev) =>
      prev
        .map((x) => {
          if (x.id !== id) return x;
          const nextStatus = x.status === 'in_kitchen' ? 'ready' : 'served';
          return nextStatus === 'served'
            ? { ...x, status: nextStatus, doneAt: wf.autoClearSec === 0 ? undefined : Date.now() }
            : { ...x, status: nextStatus };
        })
        .filter((x) => ACTIVE.includes(x.status) || x.doneAt !== undefined),
    );
    await fetch(`/api/orders/${id}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
  }

  // active (not-yet-completed) tickets drive stats + the batch view
  const activeTickets = useMemo(() => tickets.filter((t) => ACTIVE.includes(t.status)), [tickets]);

  const visible = useMemo(() => {
    const list = station === 'all' ? tickets : tickets.filter((t) => t.items.some((i) => i.station === station));
    const arr = [...list];
    switch (wf.sorting) {
      case 'newest': arr.sort((a, b) => b.placedAt - a.placedAt); break;
      case 'table': arr.sort((a, b) => tblKey(a).localeCompare(tblKey(b), undefined, { numeric: true })); break;
      case 'pickup': arr.sort((a, b) => (a.type === 'takeaway' ? 0 : 1) - (b.type === 'takeaway' ? 0 : 1) || a.placedAt - b.placedAt); break;
      // 'oldest' and 'priority' (most-delayed) both surface the longest-waiting first
      default: arr.sort((a, b) => a.placedAt - b.placedAt); break;
    }
    // completed (lingering) tickets always sink to the end — stable, so the
    // chosen order is preserved within each group
    arr.sort((a, b) => (a.doneAt ? 1 : 0) - (b.doneAt ? 1 : 0));
    return arr;
  }, [tickets, station, wf.sorting]);

  // "Make once" consolidation: sum identical items (same name + station +
  // modifiers) across every live ticket into one prep line. Read-only — the
  // cook reads a single "Chai ×12" instead of five separate tickets. Different
  // modifiers (masala vs plain) stay distinct lines; the station filter scopes
  // it to one kitchen.
  const batches = useMemo(() => {
    const map = new Map<string, Batch>();
    for (const t of activeTickets) {
      for (const it of t.items) {
        if (station !== 'all' && it.station !== station) continue;
        const mods = it.modifiers.map((m) => m.name).sort().join('+');
        const key = `${it.station ?? ''}||${it.name}||${mods}`;
        const cur = map.get(key);
        if (cur) {
          cur.qty += it.qty;
          cur.oldest = Math.min(cur.oldest, t.placedAt);
          cur.from.push({ table: t.table, type: t.type, qty: it.qty });
        } else {
          map.set(key, { key, name: it.name, station: it.station, modifiers: it.modifiers, qty: it.qty, oldest: t.placedAt, from: [{ table: t.table, type: t.type, qty: it.qty }] });
        }
      }
    }
    // most-waiting first (oldest contributing ticket)
    return [...map.values()].sort((a, b) => a.oldest - b.oldest);
  }, [activeTickets, station]);

  const stats = useMemo(() => ({
    open: activeTickets.length,
    new: activeTickets.filter((t) => stageOf(t.status, acked.has(t.id)) === 'new').length,
    ready: activeTickets.filter((t) => t.status === 'ready').length,
  }), [activeTickets, acked]);

  const themeClass = `kds-theme-${wf.theme}`;
  const rootStyle = { '--k': String(FS_SCALE[wf.fontSize]) } as React.CSSProperties;

  // Kitchen Display turned off (Printed-KOT workflow): the chef never touches a
  // screen — the cashier prints paper tickets. Show a calm status page instead
  // of the live grid, but keep the bell + logout available.
  if (!wf.kdsEnabled) {
    return (
      <div className={`kds-root ${themeClass} kds-fs-${wf.fontSize}`} style={rootStyle}>
        <div className="kds-bar">
          <div className="kds-title"><span className="kds-live" style={{ background: 'var(--ink-3)', animation: 'none' }} />Kitchen Display <em>· {outletName}</em></div>
          <div className="kds-stats">
            {inIframe && (
              <button
                className="kds-logout"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.parent !== window) {
                    window.parent.postMessage({ type: 'close-kds' }, '*');
                  }
                }}
                title="Back to Dashboard"
              >
                <LayoutDashboard size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} /> Exit KDS
              </button>
            )}
            <StaffBell role={staff.role} staffId={staff.id} triggerClassName="kds-logout" />
            <button className="kds-logout" onClick={logout} title="Log out"><LogOut size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} /> Log out</button>
          </div>
        </div>
        <div className="kds-hint" style={{ marginTop: 120 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          The Kitchen Display is turned <b>off</b> for this outlet. Orders print as
          paper <b>KOT</b> tickets at the counter — no screen needed here.
          <div style={{ marginTop: 14, fontSize: 13 }}>An owner can switch this on in <b>Settings → Kitchen</b>.</div>
        </div>
        <style>{kdsCss}</style>
      </div>
    );
  }

  return (
    <div className={`kds-root ${themeClass} kds-fs-${wf.fontSize}`} style={rootStyle}>
      <div className="kds-bar">
        <div className="kds-title">
          <span ref={liveRef} className="kds-live" />
          Kitchen Display <em>· {outletName}</em>
        </div>
        <div className="kds-filter" role="tablist" aria-label="Kitchen filter">
          {tabs.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === station} className={s.id === station ? 'on' : ''} onClick={() => setStation(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="kds-mode" role="tablist" aria-label="View mode">
          <button role="tab" aria-selected={mode === 'tickets'} className={mode === 'tickets' ? 'on' : ''} onClick={() => setMode('tickets')} title="One card per order">Tickets</button>
          <button role="tab" aria-selected={mode === 'batch'} className={mode === 'batch' ? 'on' : ''} onClick={() => setMode('batch')} title="Consolidated prep totals — make once">Batch</button>
        </div>
        <div className="kds-stats">
          <span className="kstat"><b>{stats.open}</b> open</span>
          <span className="kstat" style={{ color: STAGES.new.color }}><b style={{ color: STAGES.new.color }}>{stats.new}</b> new</span>
          <span className="kstat" style={{ color: STAGES.ready.color }}><b style={{ color: STAGES.ready.color }}>{stats.ready}</b> ready</span>
          <span className="kstat conn" style={{ color: connected ? 'var(--ok)' : 'var(--clay)' }}>{connected ? '● live' : '○ reconnecting'}</span>
          {showInstallApp && (
            <button className="kds-logout" onClick={() => staffInstall.promptInstall()} title="Install the Staff App">
              <Download size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} /> {staffInstall.iosHint ? 'Add to Home Screen' : 'Install app'}
            </button>
          )}
          {inIframe && (
            <button
              className="kds-logout"
              onClick={() => {
                if (typeof window !== 'undefined' && window.parent !== window) {
                  window.parent.postMessage({ type: 'close-kds' }, '*');
                }
              }}
              title="Back to Dashboard"
            >
              <LayoutDashboard size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} /> Exit KDS
            </button>
          )}
          <StaffBell role={staff.role} staffId={staff.id} triggerClassName="kds-logout" />
          <button className="kds-logout" onClick={logout} title="Log out"><LogOut size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} /> Log out</button>
        </div>
      </div>

      {/* colour-coded status legend (Petpooja-style key) */}
      <div className="kds-legend">
        {STAGE_ORDER.map((s) => (
          <span key={s} className="kleg">
            <span className="kleg-dot" style={{ background: STAGES[s].color }} />
            {STAGES[s].label}
          </span>
        ))}
        {wf.highlightDelayed && (
          <span className="kleg kleg-sep">
            <span className="kleg-dot" style={{ background: 'var(--clay)' }} />
            Ageing &gt; {wf.delayThresholdMin} min
          </span>
        )}
      </div>

      {mode === 'batch' ? (
        batches.length === 0 ? (
          <div className="kds-hint">
            No items to prep{station !== 'all' ? ' for this kitchen' : ''}. When orders come in, identical items
            from every table are summed here so you can <b>make them in one batch</b>.
          </div>
        ) : (
          <>
            <div className="kds-batchnote">Prep totals — identical items summed across all live tables. Read-only.</div>
            <div className="kds-batch">
              {batches.map((b) => {
                const age = now === null ? 0 : now - b.oldest;
                const secs = Math.floor(age / 1000);
                const lvl = urgency(age);
                return (
                  <div key={b.key} className={`batch ${lvl}`}>
                    <div className="batch-qty">{b.qty}<span>×</span></div>
                    <div className="batch-main">
                      <div className="batch-name">
                        {b.name}
                        {b.station && <span className="ti-stn" style={chipStyle(kitchenColor(kitchens, b.station))}>{kitchenName(kitchens, b.station)}</span>}
                      </div>
                      {b.modifiers.length > 0 && <div className="batch-mod">{b.modifiers.map((m) => m.name).join(', ')}</div>}
                      <div className="batch-from">
                        {b.from.map((f, i) => (
                          <span key={i} className="batch-chip">{f.type === 'takeaway' ? '🥡' : 'T' + f.table}<b>×{f.qty}</b></span>
                        ))}
                      </div>
                    </div>
                    <div className="batch-meta">
                      {wf.showPrepTime && <span className="batch-timer">{fmt(secs)}</span>}
                      <span className="batch-count">{b.from.length} {b.from.length === 1 ? 'ticket' : 'tickets'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : visible.length === 0 ? (
        <div className="kds-hint">
          No live tickets. Open the <b>POS</b> in another tab, send an order to the kitchen,
          and it appears here instantly. Tap a ticket to bump it.
        </div>
      ) : (
        <div className="kds-grid">
          {visible.map((t) => {
            // before mount `now` is null → age 0, so server & first client render match
            const age = now === null ? 0 : now - t.placedAt;
            const secs = Math.floor(age / 1000);
            const stage = stageOf(t.status, acked.has(t.id));
            const st = STAGES[stage];
            // age escalates the timer/border only while the food is still being made
            const lvl = stage === 'ready' || stage === 'served' ? 'fresh' : urgency(age);
            const lines = station === 'all' ? t.items : t.items.filter((i) => i.station === station);
            return (
              <button
                key={t.id}
                className={`ticket ${lvl} stage-${stage}${t.doneAt !== undefined ? ' done' : ''}`}
                onClick={() => bump(t.id)}
                style={{ borderTopColor: st.color }}
              >
                <div className="ticket-top">
                  <span className="ticket-no">#{t.number}</span>
                  {wf.showTableNumber && <span className="ticket-tbl">{t.type === 'takeaway' ? '🥡 Takeaway' : 'Table ' + t.table}</span>}
                  {wf.showPrepTime && <span className="ticket-timer">{fmt(secs)}</span>}
                </div>
                {wf.showCustomerName && t.customerName && <div className="ticket-cust">👤 {t.customerName}</div>}
                <div className="ticket-items">
                  {lines.map((l, i) => (
                    <div key={i} className="ti-line">
                      <span className="ti-qty">{l.qty}×</span>
                      <span className="ti-name">{l.name}</span>
                      {l.station && <span className="ti-stn" style={chipStyle(kitchenColor(kitchens, l.station))}>{kitchenName(kitchens, l.station)}</span>}
                      {l.modifiers.length > 0 && <span className="ti-mod">{l.modifiers.map((m) => m.name).join(', ')}</span>}
                      {wf.showNotes && l.notes && <span className="ti-note">📝 {l.notes}</span>}
                    </div>
                  ))}
                </div>
                <div className="ticket-foot">
                  <span className="ti-status" style={{ background: st.bg, color: st.color }}>
                    <span className="ti-dot" style={{ background: st.color }} />
                    {st.label}
                  </span>
                  <span className="ti-bump" style={{ color: st.color }}>{t.doneAt !== undefined ? 'Dismiss' : st.action}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: kdsCss }} />
    </div>
  );
}

function fmt(secs: number) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const kdsCss = `
/* ── theme surfaces (independent of the global light/dark toggle) ── */
.kds-root.kds-theme-dark { color-scheme: dark; --paper: #16110D; --paper-2: #211913; --paper-3: #2B201A; --ink: #F4E9DA; --ink-2: #C2AC97; --ink-3: #8A7461; --line: #34271F; --line-2: #43332A; }
.kds-root.kds-theme-light { color-scheme: light; --paper: #FBF6EE; --paper-2: #FFFFFF; --paper-3: #F1E7D7; --ink: #241A11; --ink-2: #6A5843; --ink-3: #94806B; --line: #E7DAC6; --line-2: #D6C3A8; background: radial-gradient(120% 80% at 50% -10%, #F6ECD9, transparent 60%), var(--paper); }
.kds-root.kds-theme-auto { color-scheme: light dark; --paper: #16110D; --paper-2: #211913; --paper-3: #2B201A; --ink: #F4E9DA; --ink-2: #C2AC97; --ink-3: #8A7461; --line: #34271F; --line-2: #43332A; }
@media (prefers-color-scheme: light) { .kds-root.kds-theme-auto { color-scheme: light; --paper: #FBF6EE; --paper-2: #FFFFFF; --paper-3: #F1E7D7; --ink: #241A11; --ink-2: #6A5843; --ink-3: #94806B; --line: #E7DAC6; --line-2: #D6C3A8; background: radial-gradient(120% 80% at 50% -10%, #F6ECD9, transparent 60%), var(--paper); } }
.kds-root { min-height: 100vh; background: radial-gradient(120% 80% at 50% -10%, #20160F, transparent 60%), var(--paper); color: var(--ink); padding: calc(18px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); }
.kds-root.kds-theme-light, .kds-root.kds-theme-auto { background: radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--paper-3) 60%, transparent), transparent 60%), var(--paper); }
.kds-bar { display: flex; align-items: center; gap: 12px 18px; margin-bottom: 18px; flex-wrap: wrap; }
.kds-title { font-family: var(--font-display); font-size: calc(22px * var(--k, 1)); font-weight: 700; display: flex; align-items: center; gap: 12px; }
.kds-title em { font-style: normal; color: var(--ink-3); font-size: 15px; font-family: var(--font-body); font-weight: 600; }
.kds-live { width: 11px; height: 11px; border-radius: 99px; background: #56d364; animation: kpulse 1.6s infinite; }
@keyframes kpulse { 0%{box-shadow:0 0 0 0 rgba(86,211,100,.5)} 70%{box-shadow:0 0 0 10px rgba(86,211,100,0)} 100%{box-shadow:0 0 0 0 rgba(86,211,100,0)} }
.kds-filter { display: flex; gap: 4px; background: var(--paper-2); border: 1px solid var(--line); border-radius: 999px; padding: 4px; }
.kds-filter button { padding: 8px 16px; border-radius: 999px; font-weight: 700; font-size: 13px; color: var(--ink-2); background: none; border: none; cursor: pointer; font-family: var(--font-body); }
.kds-filter button.on { background: var(--turmeric); color: #2a1607; }
.kds-stats { margin-left: auto; display: flex; gap: 16px; align-items: center; }
.kstat { font-size: 13px; color: var(--ink-3); font-weight: 600; }
.kstat b { font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-right: 3px; }
.kstat.conn { font-size: 12px; font-weight: 800; }
.kds-logout { font-family: var(--font-body); font-size: 12px; font-weight: 800; color: var(--ink-2); background: var(--paper-2); border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; cursor: pointer; transition: background .12s; }
.kds-logout:hover { background: var(--paper-3); color: var(--clay); }
.kds-legend { display: flex; align-items: center; gap: 18px; margin: -6px 0 16px; padding: 9px 14px; background: var(--paper-2); border: 1px solid var(--line); border-radius: 12px; flex-wrap: wrap; }
.kleg { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--ink-2); }
.kleg-dot { width: 10px; height: 10px; border-radius: 99px; }
.kleg-sep { margin-left: auto; color: var(--ink-3); }
.kds-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 14px; align-content: start; }
.ticket { text-align: left; background: var(--paper-2); border: 1px solid var(--line); border-top: 4px solid #56d364; border-radius: 14px; overflow: hidden; box-shadow: var(--sh-2); cursor: pointer; font-family: var(--font-body); animation: tin .3s ease both; transition: transform .12s, box-shadow .2s, opacity .3s; }
.ticket:hover { transform: translateY(-3px); }
@keyframes tin { from { opacity: 0; transform: translateY(12px); } }
/* NEW tickets pulse for attention until the kitchen accepts them */
.ticket.stage-new { animation: tin .3s ease both, newpulse 1.8s ease-in-out infinite; }
@keyframes newpulse { 0%,100% { box-shadow: var(--sh-2); } 50% { box-shadow: 0 0 0 3px rgba(59,130,246,.35), var(--sh-2); } }
.ticket.stage-served { opacity: .9; }
/* completed tickets lingering before auto-clear read as dimmed & muted */
.ticket.done { opacity: .55; filter: saturate(.7); }
/* ageing cue — a red glow when a ticket is sitting too long (stage colour still owns the border) */
.ticket.late:not(.stage-ready):not(.stage-served) { box-shadow: 0 0 0 2px rgba(195,73,47,.4), var(--sh-2); }
.ticket-top { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px dashed var(--line-2); }
.ticket-no { font-family: var(--font-display); font-weight: 800; font-size: calc(20px * var(--k, 1)); }
.ticket-tbl { font-size: calc(12px * var(--k, 1)); font-weight: 700; color: var(--ink-2); }
.ticket-timer { margin-left: auto; font-size: calc(17px * var(--k, 1)); font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.ticket.warn .ticket-timer { color: var(--turmeric); }
.ticket.late .ticket-timer { color: var(--clay); }
.ticket-cust { padding: 8px 14px 0; font-size: calc(12.5px * var(--k, 1)); font-weight: 700; color: var(--ink-2); }
.ticket-items { padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }
.ti-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.ti-qty { font-family: var(--font-display); font-weight: 800; font-size: calc(16px * var(--k, 1)); color: var(--turmeric); }
.ti-name { font-weight: 700; font-size: calc(15px * var(--k, 1)); }
.ti-stn { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 99px; }
.ti-stn.kitchen { background: rgba(195,73,47,.18); color: var(--clay-l); }
.ti-stn.bar { background: rgba(217,169,58,.18); color: var(--gold); }
.ti-stn.dessert { background: rgba(142,59,107,.22); color: #d488b4; }
.ti-mod { width: 100%; font-size: 11.5px; color: var(--ink-3); padding-left: 24px; font-style: italic; }
.ti-note { width: 100%; font-size: calc(12px * var(--k, 1)); color: var(--clay); padding-left: 24px; font-weight: 700; }
.ticket-foot { display: flex; justify-content: space-between; align-items: center; padding: 11px 14px; background: var(--paper-3); border-top: 1px solid var(--line); }
.ti-status { display: inline-flex; align-items: center; gap: 6px; font-size: calc(11px * var(--k, 1)); font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 4px 10px; border-radius: 99px; }
.ti-dot { width: 7px; height: 7px; border-radius: 99px; }
.ti-bump { font-weight: 800; font-size: calc(13px * var(--k, 1)); }
.kds-hint { margin: 80px auto; max-width: 460px; text-align: center; color: var(--ink-3); font-size: 14.5px; line-height: 1.6; }
.kds-hint b { color: var(--turmeric); }
/* view-mode toggle (Tickets / Batch) */
.kds-mode { display: flex; gap: 4px; background: var(--paper-2); border: 1px solid var(--line); border-radius: 999px; padding: 4px; }
.kds-mode button { padding: 8px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; color: var(--ink-2); background: none; border: none; cursor: pointer; font-family: var(--font-body); }
.kds-mode button.on { background: var(--clay); color: #fff; }
/* batch ("make once") consolidation view */
.kds-batchnote { font-size: 12.5px; font-weight: 700; color: var(--ink-3); margin: -6px 0 14px; }
.kds-batch { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 12px; align-content: start; }
.batch { display: flex; align-items: stretch; gap: 12px; background: var(--paper-2); border: 1px solid var(--line); border-left: 5px solid var(--turmeric); border-radius: 14px; padding: 14px; box-shadow: var(--sh-2); animation: tin .3s ease both; }
.batch.late { border-left-color: var(--clay); box-shadow: 0 0 0 2px rgba(195,73,47,.35), var(--sh-2); }
.batch-qty { font-family: var(--font-display); font-weight: 800; font-size: calc(34px * var(--k, 1)); line-height: 1; color: var(--turmeric); min-width: 54px; display: flex; align-items: center; justify-content: center; }
.batch-qty span { font-size: 18px; margin-left: 1px; color: var(--ink-3); }
.batch-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.batch-name { font-weight: 800; font-size: calc(17px * var(--k, 1)); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.batch-mod { font-size: 12px; color: var(--ink-3); font-style: italic; }
.batch-from { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
.batch-chip { font-size: 11px; font-weight: 700; color: var(--ink-2); background: var(--paper-3); border: 1px solid var(--line); border-radius: 99px; padding: 2px 8px; }
.batch-chip b { color: var(--ink); margin-left: 2px; }
.batch-meta { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 6px; }
.batch-timer { font-size: calc(16px * var(--k, 1)); font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.batch.warn .batch-timer { color: var(--turmeric); }
.batch.late .batch-timer { color: var(--clay); }
.batch-count { font-size: 11px; font-weight: 700; color: var(--ink-3); white-space: nowrap; }
`;
