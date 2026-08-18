'use client';

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { RealtimeEvent } from './realtime';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
type EventCb = (e: RealtimeEvent) => void;
type StatusCb = (s: RealtimeStatus) => void;
type TokenResp = {
  mode?: 'local' | 'cloud';
  url: string;
  anonKey: string;
  token: string;
  outletId: string;
  tableId?: string;
};

type Hub = {
  tokenUrl: string;
  topicOf: (t: TokenResp) => string;
  channel: RealtimeChannel | null;
  ws: WebSocket | null;
  status: RealtimeStatus;
  events: Set<EventCb>;
  statuses: Set<StatusCb>;
  starting: boolean;
  retryAttempt: number;
  rotate: ReturnType<typeof setInterval> | null;
  retry: ReturnType<typeof setTimeout> | null;
};

const g = globalThis as unknown as {
  __cafeRT?: { client: SupabaseClient | null; url: string | null; hubs: Map<string, Hub> };
};
const RT = g.__cafeRT ?? (g.__cafeRT = { client: null, url: null, hubs: new Map() });

const TOKEN_ROTATE_MS = 45 * 60 * 1000; // 45 min token rotation

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
  const prev = hub.status;
  hub.status = s;
  for (const cb of hub.statuses) cb(s);

  // If transitioning to connected from disconnected/connecting, trigger status callbacks
  if (s === 'connected' && prev !== 'connected') {
    hub.retryAttempt = 0;
  }
}

function scheduleRetry(key: string, hub: Hub) {
  if (hub.retry || !RT.hubs.has(key) || hub.events.size === 0) return;

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
  const delayMs = Math.min(1000 * Math.pow(2, hub.retryAttempt), 30000);
  hub.retryAttempt += 1;

  hub.retry = setTimeout(() => {
    hub.retry = null;
    if (RT.hubs.has(key) && hub.events.size > 0) start(key, hub);
  }, delayMs);
}

function teardown(hub: Hub, opts: { keepListeners: boolean }) {
  if (hub.rotate) {
    clearInterval(hub.rotate);
    hub.rotate = null;
  }

  if (hub.ws) {
    try {
      hub.ws.onopen = null;
      hub.ws.onclose = null;
      hub.ws.onerror = null;
      hub.ws.onmessage = null;
      hub.ws.close();
    } catch {
      /* ignore */
    }
    hub.ws = null;
  }

  const chan = hub.channel;
  if (chan) {
    hub.channel = null;
    try {
      RT.client?.removeChannel(chan);
    } catch {
      /* ignore */
    }
  }

  if (!opts.keepListeners) {
    hub.events.clear();
    hub.statuses.clear();
  }
}

async function start(key: string, hub: Hub) {
  if (hub.starting || hub.channel || hub.ws) return;
  hub.starting = true;
  setStatus(hub, 'connecting');

  const t = await fetchToken(hub.tokenUrl);
  if (!t || !RT.hubs.has(key)) {
    hub.starting = false;
    setStatus(hub, 'disconnected');
    scheduleRetry(key, hub);
    return;
  }

  const topic = hub.topicOf(t);
  const isLocal = t.mode === 'local' || t.url.startsWith('ws://') || t.url.startsWith('wss://');

  if (isLocal) {
    // --- Local WebSocket Transport ---
    try {
      const wsUrl = t.url.includes('?') ? `${t.url}&token=${t.token}` : `${t.url}?token=${t.token}`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        // Subscribe to channel
        socket.send(JSON.stringify({ type: 'subscribe', channel: topic }));
        hub.starting = false;
        setStatus(hub, 'connected');
      };

      socket.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'event' || msg.event) {
            // Standard event payload extraction
            const payload: RealtimeEvent = msg.payload || (msg.envelope ? msg.envelope.payload : null);
            if (payload && payload.type) {
              for (const cb of hub.events) cb(payload);
            }
          }
        } catch (e) {
          /* ignore parse error */
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        hub.ws = null;
        hub.starting = false;
        setStatus(hub, 'disconnected');
        teardown(hub, { keepListeners: true });
        scheduleRetry(key, hub);
      };

      hub.ws = socket;
    } catch (e) {
      hub.starting = false;
      setStatus(hub, 'disconnected');
      scheduleRetry(key, hub);
    }
  } else {
    // --- Cloud Supabase Transport ---
    try {
      const c = client(t.url, t.anonKey);
      c.realtime.setAuth(t.token);

      const channel = c
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'message' }, (msg) => {
          const payload = (msg as { payload?: RealtimeEvent }).payload;
          if (payload) for (const cb of hub.events) cb(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setStatus(hub, 'connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setStatus(hub, 'disconnected');
            teardown(hub, { keepListeners: true });
            scheduleRetry(key, hub);
          }
        });

      hub.channel = channel;
      hub.starting = false;

      hub.rotate = setInterval(async () => {
        const next = await fetchToken(hub.tokenUrl);
        if (next) c.realtime.setAuth(next.token);
      }, TOKEN_ROTATE_MS);
    } catch (e) {
      hub.starting = false;
      setStatus(hub, 'disconnected');
      scheduleRetry(key, hub);
    }
  }
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
      tokenUrl,
      topicOf,
      channel: null,
      ws: null,
      status: 'connecting',
      events: new Set(),
      statuses: new Set(),
      starting: false,
      retryAttempt: 0,
      rotate: null,
      retry: null,
    };
    RT.hubs.set(key, hub);
  }
  const h = hub;
  h.events.add(onEvent);
  if (onStatus) {
    h.statuses.add(onStatus);
    onStatus(h.status);
  }

  if (!h.channel && !h.ws && !h.starting) start(key, h);

  return () => {
    h.events.delete(onEvent);
    if (onStatus) h.statuses.delete(onStatus);
    if (h.events.size === 0) {
      if (h.retry) {
        clearTimeout(h.retry);
        h.retry = null;
      }
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
