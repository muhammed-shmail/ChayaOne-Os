/**
 * Cafe OS — realtime fan-out abstraction.
 *
 * Supports two operational modes:
 * 1. LOCAL MODE (CHAYAONE_RUNTIME_MODE !== 'cloud'): Node.js WebSocket server on Main PC.
 * 2. CLOUD MODE (CHAYAONE_RUNTIME_MODE === 'cloud'): Supabase Realtime broadcast REST API.
 */

import { publishLocalRealtimeEvent } from './realtime/publisher';

export type TicketItem = { name: string; qty: number; station: string | null; modifiers: { name: string }[]; notes: string | null };
export type Ticket = {
  id: string;
  number: number;
  table: string;
  tableId: string | null; // drives the per-table customer channel
  type: string;
  status: string;
  placedAt: number; // epoch ms
  /** guest name when a customer is attached — the KDS shows it if configured */
  customerName: string | null;
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
  | { type: 'order.pending'; ticket: Ticket }
  | { type: 'notify'; notification: NotifyPayload };

type RealtimeConfig = { url: string; serviceKey: string };

function readCloudConfig(): RealtimeConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

export function isLocalRuntime(): boolean {
  const mode = process.env.CHAYAONE_RUNTIME_MODE;
  if (mode === 'cloud') return false;
  // Default to local runtime if explicitly set or if cloud config is absent
  return mode === 'local' || !readCloudConfig();
}

/** True when either Local Realtime or Cloud Realtime is active. */
export function isRealtimeConfigured(): boolean {
  return true; // Always active in Local-First architecture
}

export function staffTopic(outletId: string) {
  return `outlet:${outletId}`;
}
export function tableTopic(outletId: string, tableId: string) {
  return `outlet:${outletId}:tbl:${tableId}`;
}

/**
 * Broadcast one event to the outlet's staff channel (and, for order events, the
 * originating table's customer channel).
 */
export async function publish(outletId: string, event: RealtimeEvent): Promise<void> {
  if (isLocalRuntime()) {
    await publishLocalRealtimeEvent(outletId, event);
    return;
  }

  // Cloud Mode — Supabase Broadcast REST API
  const cfg = readCloudConfig();
  if (!cfg) return;

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
  customer?: { name: string | null } | null;
  items: { nameSnapshot: string; qty: number; station: string | null; modifiers: unknown; notes?: string | null }[];
}): Ticket {
  return {
    id: order.id,
    number: order.number,
    table: order.table?.label ?? (order.type === 'takeaway' ? 'TA' : '—'),
    tableId: order.tableId ?? null,
    type: order.type,
    status: order.status,
    placedAt: order.placedAt.getTime(),
    customerName: order.customer?.name ?? null,
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      qty: i.qty,
      station: i.station,
      modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [],
      notes: i.notes ?? null,
    })),
  };
}
