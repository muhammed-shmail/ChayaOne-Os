'use client';

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { RealtimeEvent } from './realtime';

/**
 * Cafe OS — realtime receive side (Supabase Realtime).
 *
 * Replaces the old EventSource('/api/stream'). A component calls subscribeStaff /
 * subscribeCustomerTable with a handler; we fetch a scoped token from the server,
 * open the matching private Supabase channel, and forward each broadcast payload
 * (the same RealtimeEvent the code already switches on) to the handler.
 *
 * Multiplexed: one shared Supabase client + one channel per topic, fanned out to
 * every listener (the KDS page, the POS page, the staff bell all share the outlet
 * channel). Mirrors the globalThis singleton trick in components/staff-feed.ts so
 * Next HMR doesn't stack duplicate sockets.
 */

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
type EventCb = (e: RealtimeEvent) => void;
type StatusCb = (s: RealtimeStatus) => void;
type TokenResp = { url: string; anonKey: string; token: string; outletId: string; tableId?: string };

type Hub = {
  tokenUrl: string;
  topicOf: (t: TokenResp) => string;
  channel: RealtimeChannel | null;
  status: RealtimeStatus;
  events: Set<EventCb>;
  statuses: Set<StatusCb>;
  starting: boolean;
  rotate: ReturnType<typeof setInterval> | null;
  retry: ReturnType<typeof setTimeout> | null;
};

const g = globalThis as unknown as {
  __cafeRT?: { client: SupabaseClient | null; url: string | null; hubs: Map<string, Hub> };
};
const RT = g.__cafeRT ?? (g.__cafeRT = { client: null, url: null, hubs: new Map() });

const TOKEN_ROTATE_MS = 45 * 60 * 1000; // refresh before the 1h token TTL lapses

async function fetchToken(tokenUrl: string): Promise<TokenResp | null> {
  try {
    const r = await fetch(tokenUrl, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as TokenResp;
  } catch {
    return null;
  }
}

function client(url: string, anonKey: string): SupabaseClient {
  if (!RT.client || RT.url !== url) {
    RT.client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    RT.url = url;
  }
  return RT.client;
}

function setStatus(hub: Hub, s: RealtimeStatus) {
  hub.status = s;
  for (const cb of hub.statuses) cb(s);
}

async function start(key: string, hub: Hub) {
  if (hub.starting || hub.channel) return;
  hub.starting = true;
  setStatus(hub, 'connecting');

  const t = await fetchToken(hub.tokenUrl);
  if (!t || !RT.hubs.has(key)) {
    hub.starting = false;
    setStatus(hub, 'disconnected');
    scheduleRetry(key, hub);
    return;
  }

  const c = client(t.url, t.anonKey);
  // The private-channel authorizer reads this token's claims (outlet_id/table_id).
  c.realtime.setAuth(t.token);

  const channel = c
    .channel(hub.topicOf(t), { config: { private: true } })
    .on('broadcast', { event: 'message' }, (msg) => {
      const payload = (msg as { payload?: RealtimeEvent }).payload;
      if (payload) for (const cb of hub.events) cb(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setStatus(hub, 'connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setStatus(hub, 'disconnected');
        // token may have lapsed / socket dropped — tear down and rejoin with a
        // fresh token after a short backoff (folds in the old self-healing
        // EventSource reconnect the dashboard used to hand-roll).
        teardown(hub, { keepListeners: true });
        scheduleRetry(key, hub);
      }
    });

  hub.channel = channel;
  hub.starting = false;

  // proactively rotate the token before it expires so a long-open channel stays
  // authorized without a visible drop.
  hub.rotate = setInterval(async () => {
    const next = await fetchToken(hub.tokenUrl);
    if (next) c.realtime.setAuth(next.token);
  }, TOKEN_ROTATE_MS);
}

function scheduleRetry(key: string, hub: Hub) {
  if (hub.retry || !RT.hubs.has(key) || hub.events.size === 0) return;
  hub.retry = setTimeout(() => {
    hub.retry = null;
    if (RT.hubs.has(key) && hub.events.size > 0) start(key, hub);
  }, 3000);
}

function teardown(hub: Hub, opts: { keepListeners: boolean }) {
  if (hub.rotate) { clearInterval(hub.rotate); hub.rotate = null; }
  const chan = hub.channel;
  if (chan) {
    hub.channel = null;
    try { RT.client?.removeChannel(chan); } catch { /* ignore */ }
  }
  if (!opts.keepListeners) { hub.events.clear(); hub.statuses.clear(); }
}

function join(
  key: string,
  tokenUrl: string,
  topicOf: (t: TokenResp) => string,
  onEvent: EventCb,
  onStatus?: StatusCb,
): () => void {
  let hub = RT.hubs.get(key);
  if (!hub) {
    hub = {
      tokenUrl, topicOf, channel: null, status: 'connecting',
      events: new Set(), statuses: new Set(), starting: false, rotate: null, retry: null,
    };
    RT.hubs.set(key, hub);
  }
  const h = hub;
  h.events.add(onEvent);
  if (onStatus) { h.statuses.add(onStatus); onStatus(h.status); }

  if (!h.channel && !h.starting) start(key, h);

  return () => {
    h.events.delete(onEvent);
    if (onStatus) h.statuses.delete(onStatus);
    if (h.events.size === 0) {
      if (h.retry) { clearTimeout(h.retry); h.retry = null; }
      teardown(h, { keepListeners: false });
      RT.hubs.delete(key);
    }
  };
}

/** Subscribe to the current staff member's outlet channel. Returns an unsubscribe fn. */
export function subscribeStaff(onEvent: EventCb, onStatus?: StatusCb): () => void {
  return join('staff', '/api/realtime/token', (t) => `outlet:${t.outletId}`, onEvent, onStatus);
}

/** Subscribe a customer to just their table's channel, resolved from the QR token. */
export function subscribeCustomerTable(qrToken: string, onEvent: EventCb, onStatus?: StatusCb): () => void {
  const url = `/api/customer/realtime?t=${encodeURIComponent(qrToken)}`;
  return join(`cust:${qrToken}`, url, (t) => `outlet:${t.outletId}:tbl:${t.tableId}`, onEvent, onStatus);
}
