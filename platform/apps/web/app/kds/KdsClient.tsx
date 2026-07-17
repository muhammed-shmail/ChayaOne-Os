'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAGES, STAGE_ORDER, stageOf, urgencyOf } from '@/lib/orderStatus';
import { LogOut, Download } from '@/components/ui';
import StaffBell from '@/components/StaffBell';
import { useStaffInstall } from '@/components/staff-install';
import { isOffline } from '@/components/online';
import { kitchenName, kitchenColor, type Kitchen } from '@/lib/kitchens';
import { subscribeStaff } from '@/lib/realtime-client';

type Ticket = {
  id: string;
  number: number;
  table: string;
  type: string;
  status: string;
  placedAt: number;
  items: { name: string; qty: number; station: string | null; modifiers: { name: string }[] }[];
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

/** translucent chip styling from a kitchen's accent colour */
function chipStyle(color: string | null) {
  if (!color) return { background: 'var(--paper-3)', color: 'var(--ink-2)' };
  return { background: `${color}2b`, color };
}

export default function KdsClient({ outletName, initial, kitchens, staff, staffAppEnabled = false }: { outletName: string; initial: Ticket[]; kitchens: Kitchen[]; staff: { id: string; role: string }; staffAppEnabled?: boolean }) {
  const router = useRouter();
  const staffInstall = useStaffInstall();
  const showInstallApp = staffAppEnabled && staffInstall.available;
  const [tickets, setTickets] = useState<Ticket[]>(initial);
  // Petpooja-style "accept the order" step: a ticket reads as NEW until the
  // line cook acknowledges it, after which it shows as Preparing. Tickets that
  // were already past 'in_kitchen' on load are treated as accepted.
  const [acked, setAcked] = useState<Set<string>>(
    () => new Set(initial.filter((t) => t.status !== 'in_kitchen' && t.status !== 'open').map((t) => t.id)),
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

  // 1s clock for the escalating timers — starts only after mount
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // realtime subscription (Supabase private channel for this outlet)
  useEffect(() => {
    return subscribeStaff(
      (msg) => {
        if (msg.type === 'order.new') {
          // pulse the live dot
          if (liveRef.current) { liveRef.current.style.animation = 'none'; void liveRef.current.offsetWidth; liveRef.current.style.animation = ''; }
          setTickets((prev) => (prev.some((t) => t.id === msg.ticket.id) ? prev : [...prev, msg.ticket]));
        } else if (msg.type === 'order.updated') {
          setTickets((prev) => {
            const stillActive = ACTIVE.includes(msg.ticket.status);
            const without = prev.filter((t) => t.id !== msg.ticket.id);
            return stillActive ? [...without, msg.ticket] : without;
          });
        }
      },
      (s) => setConnected(s === 'connected'),
    );
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  async function bump(id: string) {
    const t = tickets.find((x) => x.id === id);
    if (!t) return;
    const stage = stageOf(t.status, acked.has(id));

    // Stage 1 — NEW → Preparing is just an on-screen acknowledgement; the order
    // is already 'in_kitchen' on the server, so no round-trip is needed.
    if (stage === 'new') {
      setAcked((prev) => new Set(prev).add(id));
      return;
    }

    // Read-only offline — don't advance the persisted lifecycle (the optimistic
    // update would diverge from the server). The offline banner explains why.
    if (isOffline()) return;

    // Stage 2+ — advance the persisted lifecycle. Optimistic; SSE confirms.
    setTickets((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, status: x.status === 'in_kitchen' ? 'ready' : 'served' } : x))
        .filter((x) => ACTIVE.includes(x.status)),
    );
    await fetch(`/api/orders/${id}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
  }

  const visible = useMemo(() => {
    const list = station === 'all' ? tickets : tickets.filter((t) => t.items.some((i) => i.station === station));
    return [...list].sort((a, b) => a.placedAt - b.placedAt);
  }, [tickets, station]);

  // "Make once" consolidation: sum identical items (same name + station +
  // modifiers) across every live ticket into one prep line. Read-only — the
  // cook reads a single "Chai ×12" instead of five separate tickets. Different
  // modifiers (masala vs plain) stay distinct lines; the station filter scopes
  // it to one kitchen.
  const batches = useMemo(() => {
    const map = new Map<string, Batch>();
    for (const t of tickets) {
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
  }, [tickets, station]);

  const stats = useMemo(() => ({
    open: tickets.length,
    new: tickets.filter((t) => stageOf(t.status, acked.has(t.id)) === 'new').length,
    ready: tickets.filter((t) => t.status === 'ready').length,
  }), [tickets, acked]);

  return (
    <div data-skin="roast" className="kds-root">
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
        <span className="kleg kleg-sep">
          <span className="kleg-dot" style={{ background: 'var(--clay)' }} />
          Ageing &gt; 5 min
        </span>
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
                const lvl = urgencyOf(age);
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
                      <span className="batch-timer">{fmt(secs)}</span>
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
            const lvl = stage === 'ready' ? 'fresh' : urgencyOf(age);
            const lines = station === 'all' ? t.items : t.items.filter((i) => i.station === station);
            return (
              <button
                key={t.id}
                className={`ticket ${lvl} stage-${stage}`}
                onClick={() => bump(t.id)}
                style={{ borderTopColor: st.color }}
              >
                <div className="ticket-top">
                  <span className="ticket-no">#{t.number}</span>
                  <span className="ticket-tbl">{t.type === 'takeaway' ? '🥡 Takeaway' : 'Table ' + t.table}</span>
                  <span className="ticket-timer">{fmt(secs)}</span>
                </div>
                <div className="ticket-items">
                  {lines.map((l, i) => (
                    <div key={i} className="ti-line">
                      <span className="ti-qty">{l.qty}×</span>
                      <span className="ti-name">{l.name}</span>
                      {l.station && <span className="ti-stn" style={chipStyle(kitchenColor(kitchens, l.station))}>{kitchenName(kitchens, l.station)}</span>}
                      {l.modifiers.length > 0 && <span className="ti-mod">{l.modifiers.map((m) => m.name).join(', ')}</span>}
                    </div>
                  ))}
                </div>
                <div className="ticket-foot">
                  <span className="ti-status" style={{ background: st.bg, color: st.color }}>
                    <span className="ti-dot" style={{ background: st.color }} />
                    {st.label}
                  </span>
                  <span className="ti-bump" style={{ color: st.color }}>{st.action}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style>{kdsCss}</style>
    </div>
  );
}

function fmt(secs: number) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const kdsCss = `
.kds-root { min-height: 100vh; background: radial-gradient(120% 80% at 50% -10%, #20160F, transparent 60%), var(--paper); color: var(--ink); padding: calc(18px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); }
.kds-bar { display: flex; align-items: center; gap: 12px 18px; margin-bottom: 18px; flex-wrap: wrap; }
.kds-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 12px; }
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
.ticket { text-align: left; background: var(--paper-2); border: 1px solid var(--line); border-top: 4px solid #56d364; border-radius: 14px; overflow: hidden; box-shadow: var(--sh-2); cursor: pointer; font-family: var(--font-body); animation: tin .3s ease both; transition: transform .12s, box-shadow .2s; }
.ticket:hover { transform: translateY(-3px); }
@keyframes tin { from { opacity: 0; transform: translateY(12px); } }
/* NEW tickets pulse for attention until the kitchen accepts them */
.ticket.stage-new { animation: tin .3s ease both, newpulse 1.8s ease-in-out infinite; }
@keyframes newpulse { 0%,100% { box-shadow: var(--sh-2); } 50% { box-shadow: 0 0 0 3px rgba(59,130,246,.35), var(--sh-2); } }
.ticket.stage-served { opacity: .9; }
/* ageing cue — a red glow when a ticket is sitting too long (stage colour still owns the border) */
.ticket.late:not(.stage-ready):not(.stage-served) { box-shadow: 0 0 0 2px rgba(195,73,47,.4), var(--sh-2); }
.ticket-top { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px dashed var(--line-2); }
.ticket-no { font-family: var(--font-display); font-weight: 800; font-size: 20px; }
.ticket-tbl { font-size: 12px; font-weight: 700; color: var(--ink-2); }
.ticket-timer { margin-left: auto; font-size: 17px; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.ticket.warn .ticket-timer { color: var(--turmeric); }
.ticket.late .ticket-timer { color: var(--clay); }
.ticket-items { padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }
.ti-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.ti-qty { font-family: var(--font-display); font-weight: 800; font-size: 16px; color: var(--turmeric); }
.ti-name { font-weight: 700; font-size: 15px; }
.ti-stn { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 99px; }
.ti-stn.kitchen { background: rgba(195,73,47,.18); color: var(--clay-l); }
.ti-stn.bar { background: rgba(217,169,58,.18); color: var(--gold); }
.ti-stn.dessert { background: rgba(142,59,107,.22); color: #d488b4; }
.ti-mod { width: 100%; font-size: 11.5px; color: var(--ink-3); padding-left: 24px; font-style: italic; }
.ticket-foot { display: flex; justify-content: space-between; align-items: center; padding: 11px 14px; background: var(--paper-3); border-top: 1px solid var(--line); }
.ti-status { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 4px 10px; border-radius: 99px; }
.ti-dot { width: 7px; height: 7px; border-radius: 99px; }
.ti-bump { font-weight: 800; font-size: 13px; }
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
.batch-qty { font-family: var(--font-display); font-weight: 800; font-size: 34px; line-height: 1; color: var(--turmeric); min-width: 54px; display: flex; align-items: center; justify-content: center; }
.batch-qty span { font-size: 18px; margin-left: 1px; color: var(--ink-3); }
.batch-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.batch-name { font-weight: 800; font-size: 17px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.batch-mod { font-size: 12px; color: var(--ink-3); font-style: italic; }
.batch-from { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
.batch-chip { font-size: 11px; font-weight: 700; color: var(--ink-2); background: var(--paper-3); border: 1px solid var(--line); border-radius: 99px; padding: 2px 8px; }
.batch-chip b { color: var(--ink); margin-left: 2px; }
.batch-meta { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 6px; }
.batch-timer { font-size: 16px; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.batch.warn .batch-timer { color: var(--turmeric); }
.batch.late .batch-timer { color: var(--clay); }
.batch-count { font-size: 11px; font-weight: 700; color: var(--ink-3); white-space: nowrap; }
`;
