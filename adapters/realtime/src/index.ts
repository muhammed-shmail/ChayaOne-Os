/**
 * @cafeos/realtime — Typed realtime contracts & event helpers.
 */
import type {
  RealtimeEvent,
  TableTransferPayload,
  TableMergePayload,
  TableSplitPayload,
  WaiterCallPayload,
  NotifyPayload,
  Ticket,
} from '@cafeos/types';

export * from '@cafeos/types';

export type EventType =
  | 'order.new'
  | 'order.updated'
  | 'order.pending'
  | 'table.transferred'
  | 'table.merged'
  | 'table.split'
  | 'table.updated'
  | 'waiter.called'
  | 'bill.requested'
  | 'notify';

export interface RealtimeEnvelope {
  event: EventType;
  eventId: string;
  tenantId: string;
  outletId: string;
  timestamp: string; // ISO-8601
  entityType: 'Order' | 'Notification' | 'TableMap';
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
  payload?: RealtimeEvent;
}

export function staffTopic(outletId: string): string {
  return `outlet:${outletId}`;
}

export function tableTopic(outletId: string, tableId: string): string {
  return `outlet:${outletId}:tbl:${tableId}`;
}
