import type { RealtimeEvent } from '../realtime';

export type EventType = 'order.new' | 'order.updated' | 'order.pending' | 'notify';

export interface RealtimeEnvelope {
  event: EventType;
  eventId: string;
  tenantId: string;
  outletId: string;
  timestamp: string; // ISO-8601
  entityType: 'Order' | 'Notification';
  entityId: string;
  payload: RealtimeEvent;
}

export interface LocalRealtimeClaims {
  outletId: string;
  tableId?: string | null;
  role?: string;
  tenantId?: string;
  sub?: string;
}

export interface WSIncomingMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'auth';
  channel?: string;
  token?: string;
}

export interface WSOutgoingMessage {
  type: 'subscribed' | 'unsubscribed' | 'event' | 'pong' | 'error' | 'authenticated';
  channel?: string;
  envelope?: RealtimeEnvelope;
  message?: string;
  /** Backward compatibility for top-level event structure */
  payload?: RealtimeEvent;
}
