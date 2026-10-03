import crypto from 'crypto';
import type { RealtimeEvent } from '../realtime';
import type { RealtimeEnvelope } from './types';
import { staffTopic, tableTopic } from './channels';
import { ensureLocalWebSocketServer } from './server';

export async function publishLocalRealtimeEvent(outletId: string, event: RealtimeEvent): Promise<void> {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  let entityType: 'Order' | 'Notification' | 'Staff' = 'Order';
  let entityId = '';

  if ('ticket' in event && event.ticket) {
    entityType = 'Order';
    entityId = event.ticket.id;
  } else if ('transfer' in event) {
    entityType = 'Order';
    entityId = event.transfer.orderId;
  } else if ('notification' in event) {
    entityType = 'Notification';
    entityId = event.notification.id;
  } else if ('staffId' in event) {
    entityType = 'Staff';
    entityId = (event as any).staffId;
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
    const tableId = 'ticket' in event && event.ticket ? event.ticket.tableId : null;
    if (tableId) {
      wsServer.broadcast(tableTopic(outletId, tableId), envelope);
    }
    if (event.type === 'table.transferred') {
      if (event.transfer.fromTableId && event.transfer.fromTableId !== tableId) {
        wsServer.broadcast(tableTopic(outletId, event.transfer.fromTableId), envelope);
      }
      if (event.transfer.toTableId && event.transfer.toTableId !== tableId) {
        wsServer.broadcast(tableTopic(outletId, event.transfer.toTableId), envelope);
      }
    }
  } catch (err) {
    console.error('[REALTIME ERROR] Failed to publish local realtime event:', err);
  }
}
