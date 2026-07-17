/**
 * Cafe OS — realtime fan-out (Supabase Realtime broadcast).
 *
 * Serverless model (Vercel): every request is an isolated function, so the old
 * in-process EventEmitter bus can't work — a `publish()` in one lambda would
 * never reach a subscriber in another. Instead the order/notify handlers POST to
 * Supabase's Broadcast REST API (service-role, no persistent socket), and the
 * browsers subscribe directly to Supabase channels. See `lib/realtime-client.ts`
 * for the receive side and `lib/realtime-auth.ts` for the per-outlet auth token.
 *
 * Topics:
 *   outlet:<outletId>            — staff channel (KDS / POS / approvals / owner
 *                                  bell). Carries every event type.
 *   outlet:<outletId>:tbl:<id>   — one table's channel for the customer PWA.
 *                                  Only order events (which carry a ticket) are
 *                                  mirrored here, so a guest never sees another
 *                                  table's — or the owner's notify — traffic.
 *
 * Both are private channels; receive access is gated by RLS on
 * `realtime.messages` (see DEPLOYMENT.md). The service-role broadcast below
 * bypasses RLS, so sending always succeeds.
 */

export type TicketItem = { name: string; qty: number; station: string | null; modifiers: { name: string }[] };
export type Ticket = {
  id: string;
  number: number;
  table: string;
  tableId: string | null; // drives the per-table customer channel
  type: string;
  status: string;
  placedAt: number; // epoch ms
  items: TicketItem[];
};
export type NotifyPayload = {
  id: string; type: string; severity: string; title: string; body: string | null; at: number;
  // Targeting (Staff PWA P2) — lets the staff bar / owner bell filter live events.
  audience: string; targetRole?: string | null; targetStaffId?: string | null;
};
export type RealtimeEvent =
  | { type: 'order.new'; ticket: Ticket }
  | { type: 'order.updated'; ticket: Ticket }
  // Phase C — a QR order awaiting waiter approval. The KDS ignores this type
  // (it only reacts to order.new/updated), so nothing reaches the kitchen until
  // a waiter approves and we publish order.new.
  | { type: 'order.pending'; ticket: Ticket }
  // Phase E — an alert/notification for the owner monitor bell. Carries no
  // ticket, so it is never mirrored to a customer table channel.
  | { type: 'notify'; notification: NotifyPayload };

type RealtimeConfig = { url: string; serviceKey: string };

function readConfig(): RealtimeConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

/** True when Supabase Realtime is configured (drives graceful no-op locally). */
export function isRealtimeConfigured(): boolean {
  return readConfig() !== null;
}

export function staffTopic(outletId: string) {
  return `outlet:${outletId}`;
}
export function tableTopic(outletId: string, tableId: string) {
  return `outlet:${outletId}:tbl:${tableId}`;
}

/**
 * Broadcast one event to the outlet's staff channel (and, for order events, the
 * originating table's customer channel). Best-effort: a realtime hiccup logs and
 * returns rather than failing the order write. `await` it at call sites — a
 * fire-and-forget fetch can be frozen by the serverless runtime before it lands.
 */
export async function publish(outletId: string, event: RealtimeEvent): Promise<void> {
  const cfg = readConfig();
  if (!cfg) return; // not configured (e.g. local dev without Supabase) — no-op

  const messages: Array<{ topic: string; event: string; payload: RealtimeEvent; private: boolean }> = [
    { topic: staffTopic(outletId), event: 'message', payload: event, private: true },
  ];
  const tableId = 'ticket' in event ? event.ticket.tableId : null;
  if (tableId) {
    messages.push({ topic: tableTopic(outletId, tableId), event: 'message', payload: event, private: true });
  }

  try {
    const res = await fetch(`${cfg.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: cfg.serviceKey,
        authorization: `Bearer ${cfg.serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`realtime broadcast failed (${res.status}): ${detail.slice(0, 300)}`);
    }
  } catch (e) {
    console.error('realtime broadcast error', e);
  }
}

/** Map a Prisma order (with items + table) into the lean ticket the KDS renders. */
export function toTicket(order: {
  id: string;
  number: number;
  type: string;
  status: string;
  placedAt: Date;
  tableId?: string | null;
  table?: { label: string } | null;
  items: { nameSnapshot: string; qty: number; station: string | null; modifiers: unknown }[];
}): Ticket {
  return {
    id: order.id,
    number: order.number,
    table: order.table?.label ?? (order.type === 'takeaway' ? 'TA' : '—'),
    tableId: order.tableId ?? null,
    type: order.type,
    status: order.status,
    placedAt: order.placedAt.getTime(),
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      qty: i.qty,
      station: i.station,
      modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [],
    })),
  };
}
