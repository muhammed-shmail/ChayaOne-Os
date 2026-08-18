import crypto from 'crypto';
import type { RealtimeEvent } from '../realtime';
import type { RealtimeEnvelope } from './types';
import { staffTopic, tableTopic } from './channels';
import { ensureLocalWebSocketServer } from './server';

export async function publishLocalRealtimeEvent(outletId: string, event: RealtimeEvent): Promise<void> {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  let entityType: 'Order' | 'Notification' = 'Order';
  let entityId = '';

  if ('ticket' in event) {
    entityType = 'Order';
    entityId = event.ticket.id;
  } else if ('notification' in event) {
    entityType = 'Notification';
    entityId = event.notification.id;
  }

  const envelope: RealtimeEnvelope = {
    event: event.type,
    eventId,
    tenantId: 'local-tenant',
    outletId,
    timestamp,
    entityType,
    entityId,
    payload: event,
  };

  try {
    const wsServer = await ensureLocalWebSocketServer();

    // 1. Broadcast to staff channel (KDS / POS / Approvals / Staff feed)
    wsServer.broadcast(staffTopic(outletId), envelope);

    // 2. Broadcast to per-table customer channel if tableId is present
    const tableId = 'ticket' in event ? event.ticket.tableId : null;
    if (tableId) {
      wsServer.broadcast(tableTopic(outletId, tableId), envelope);
    }
  } catch (err) {
    console.error('[REALTIME ERROR] Failed to publish local realtime event:', err);
  }
}
