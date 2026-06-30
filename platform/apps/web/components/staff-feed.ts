'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Staff notification feed — a module-level singleton shared by every <StaffBell>.
 *
 * One EventSource for the whole tab (POS keeps both the mobile header and the
 * desktop rail mounted, so per-component connections would double up). Read-state
 * is a per-device "last seen" timestamp in localStorage — unread = items newer
 * than that. Survives Next HMR via globalThis.
 */
export type FeedItem = { id: string; type: string; severity: string; title: string; body: string | null; at: number };
type Principal = { role: string; staffId: string };
type State = { items: FeedItem[]; lastSeen: number };

const SEEN_KEY = 'cafeos_staff_feed_seen';
const EMPTY: State = { items: [], lastSeen: 0 };

const g = globalThis as unknown as {
  __cafeStaffFeed?: {
    state: State; principal: Principal | null; started: boolean;
    es: EventSource | null; listeners: Set<() => void>;
  };
};
const store = g.__cafeStaffFeed ?? (g.__cafeStaffFeed = {
  state: EMPTY, principal: null, started: false, es: null, listeners: new Set(),
});

function emit() { for (const l of store.listeners) l(); }
function setState(next: State) { store.state = next; emit(); }

function relevant(n: { audience?: string; targetRole?: string | null; targetStaffId?: string | null }): boolean {
  const p = store.principal;
  if (!p) return false;
  if (n.audience === 'floor') return true;
  if (n.audience === 'role') return n.targetRole === p.role;
  if (n.audience === 'user') return n.targetStaffId === p.staffId;
  return false; // 'owner' / undefined → not for the staff bar
}

function add(item: FeedItem) {
  if (store.state.items.some((x) => x.id === item.id)) return;
  const items = [item, ...store.state.items].slice(0, 40);
  setState({ items, lastSeen: store.state.lastSeen });
}

async function start(p: Principal) {
  if (store.started) return;
  store.started = true;
  store.principal = p;
  try { store.state = { items: [], lastSeen: Number(localStorage.getItem(SEEN_KEY) || '0') || 0 }; } catch { /* ignore */ }

  // initial history
  try {
    const r = await fetch('/api/staff/notifications', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      setState({ items: (d.items as FeedItem[]) ?? [], lastSeen: store.state.lastSeen });
    }
  } catch { /* offline — SSE will backfill live items */ }

  // live stream (shares the per-outlet SSE bus with the KDS / owner bell)
  try {
    const es = new EventSource('/api/stream');
    store.es = es;
    es.onmessage = (e) => {
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'notify' && relevant(msg.notification)) {
        const n = msg.notification;
        add({ id: n.id, type: n.type, severity: n.severity, title: n.title, body: n.body, at: n.at });
      } else if (msg.type === 'order.pending' && ['waiter', 'cashier', 'owner', 'manager'].includes(p.role)) {
        // QR orders awaiting approval — live, transient (the Approvals screen is
        // the source of truth; this is just the heads-up on the bar).
        const t = msg.ticket;
        add({
          id: `pending:${t.id}`, type: 'approval', severity: 'info',
          title: `Order #${t.number} awaiting approval`,
          body: t.table && t.table !== '—' ? `Table ${t.table}` : null,
          at: t.placedAt || store.state.lastSeen,
        });
      }
    };
  } catch { /* EventSource unsupported — history-only */ }
}

export function markSeen() {
  const now = Date.now();
  try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ }
  setState({ items: store.state.items, lastSeen: now });
}

function subscribe(cb: () => void) { store.listeners.add(cb); return () => store.listeners.delete(cb); }
function getSnapshot() { return store.state; }
function getServerSnapshot() { return EMPTY; }

/** Subscribe to the shared staff feed. Pass the current staff principal once. */
export function useStaffFeed(principal: Principal) {
  useEffect(() => { start(principal); }, [principal.role, principal.staffId]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const unread = state.items.reduce((c, i) => c + (i.at > state.lastSeen ? 1 : 0), 0);
  return { items: state.items, unread };
}
