'use client';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
type EventCb = (e: any) => void;
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
  channel: string | null;
  ws: WebSocket | null;
  status: RealtimeStatus;
  events: Set<EventCb>;
  statuses: Set<StatusCb>;
  starting: boolean;
  retryAttempt: number;
  retry: ReturnType<typeof setTimeout> | null;
};

const g = globalThis as unknown as {
  __waiterRT?: { hubs: Map<string, Hub> };
};
const RT = g.__waiterRT ?? (g.__waiterRT = { hubs: new Map() });

async function fetchToken(tokenUrl: string): Promise<TokenResp | null> {
  try {
    const r = await fetch(tokenUrl, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as TokenResp;
  } catch {
    return null;
  }
}

function setStatus(hub: Hub, s: RealtimeStatus) {
  const prev = hub.status;
  hub.status = s;
  for (const cb of hub.statuses) cb(s);
  if (s === 'connected' && prev !== 'connected') {
    hub.retryAttempt = 0;
  }
}

function scheduleRetry(key: string, hub: Hub) {
  if (hub.retry || !RT.hubs.has(key) || hub.events.size === 0) return;
  const delayMs = Math.min(1000 * Math.pow(2, hub.retryAttempt), 15000);
  hub.retryAttempt += 1;

  hub.retry = setTimeout(() => {
    hub.retry = null;
    if (RT.hubs.has(key) && hub.events.size > 0) start(key, hub);
  }, delayMs);
}

function teardown(hub: Hub, opts: { keepListeners: boolean }) {
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

  if (!opts.keepListeners) {
    hub.events.clear();
    hub.statuses.clear();
  }
}

async function start(key: string, hub: Hub) {
  if (hub.starting || hub.ws) return;
  hub.starting = true;
  setStatus(hub, 'connecting');

  const t = await fetchToken(hub.tokenUrl);
  if (!t || !RT.hubs.has(key)) {
    hub.starting = false;
    setStatus(hub, 'disconnected');
    scheduleRetry(key, hub);
    return;
  }

  const topic = `outlet:${t.outletId}`;
  hub.channel = topic;

  try {
    const wsUrl = t.url.includes('?') ? `${t.url}&token=${t.token}` : `${t.url}?token=${t.token}`;
    const socket = new WebSocket(wsUrl);

    const seenEventIds = new Set<string>();
    const recordEventId = (eventId?: string | null): boolean => {
      if (!eventId) return true;
      if (seenEventIds.has(eventId)) return false;
      seenEventIds.add(eventId);
      if (seenEventIds.size > 1000) {
        const first = seenEventIds.values().next().value;
        if (first) seenEventIds.delete(first);
      }
      return true;
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'subscribe', channel: topic }));
      hub.starting = false;
      setStatus(hub, 'connected');
    };

    socket.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'pong') return;

        const eventId = msg.envelope?.eventId || msg.eventId;
        if (!recordEventId(eventId)) return;

        if (msg.type === 'event' || msg.event) {
          const payload = msg.payload || (msg.envelope ? msg.envelope.payload : null);
          if (payload && payload.type) {
            for (const cb of hub.events) cb(payload);
          }
        }
      } catch {
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
  } catch {
    hub.starting = false;
    setStatus(hub, 'disconnected');
    scheduleRetry(key, hub);
  }
}

export function subscribeStaff(onEvent: EventCb, onStatus?: StatusCb): () => void {
  if (typeof window === 'undefined') return () => {};

  const key = 'waiter-staff';
  let hub = RT.hubs.get(key);
  if (!hub) {
    hub = {
      tokenUrl: '/api/realtime/token',
      channel: null,
      ws: null,
      status: 'connecting',
      events: new Set(),
      statuses: new Set(),
      starting: false,
      retryAttempt: 0,
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

  if (!h.ws && !h.starting) start(key, h);

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
