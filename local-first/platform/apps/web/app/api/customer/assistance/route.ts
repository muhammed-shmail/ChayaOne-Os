import { NextRequest, NextResponse } from 'next/server';
import { resolveTable } from '@/lib/customer';
import { createNotification } from '@/lib/notify';
import { publish } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/assistance
 * Public customer endpoint to call a waiter, request water/service, or request the bill.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.t) {
    return NextResponse.json({ error: 'missing_qr_token', message: 'Table token is required' }, { status: 400 });
  }

  const table = await resolveTable(body.t);
  if (!table) {
    return NextResponse.json({ error: 'table_not_found', message: 'Invalid table QR' }, { status: 404 });
  }

  const requestType: 'call_waiter' | 'assistance' | 'water' | 'bill' = body.requestType || 'call_waiter';
  const notes = body.notes ? String(body.notes).slice(0, 200) : null;
  const outletId = table.outlet.id;
  const tableLabel = table.label;

  let title = `Table ${tableLabel}: Needs Assistance`;
  let eventType: 'waiter.called' | 'bill.requested' = 'waiter.called';

  if (requestType === 'call_waiter') {
    title = `🔔 Table ${tableLabel}: Called Waiter`;
  } else if (requestType === 'water') {
    title = `💧 Table ${tableLabel}: Requested Water / Cutlery`;
  } else if (requestType === 'bill') {
    title = `🧾 Table ${tableLabel}: Requested Bill`;
    eventType = 'bill.requested';
  }

  try {
    // 1. Create Notification for Floor / Waiters & Owner monitor
    await createNotification({
      outletId,
      type: `customer.${requestType}`,
      severity: requestType === 'bill' ? 'info' : 'warn',
      title,
      body: notes || `Customer at Table ${tableLabel} requested ${requestType.replace('_', ' ')}.`,
      entity: 'TableMap',
      entityId: table.id,
      audience: 'floor',
      targetRole: 'waiter',
      meta: {
        tableId: table.id,
        tableLabel: table.label,
        requestType,
        notes,
      },
    });

    // 2. Publish Typed WebSocket Event
    const payload = {
      tableId: table.id,
      tableLabel: table.label,
      requestType,
      notes,
      at: Date.now(),
    };

    if (eventType === 'bill.requested') {
      await publish(outletId, { type: 'bill.requested', request: payload });
    } else {
      await publish(outletId, { type: 'waiter.called', request: payload });
    }

    return NextResponse.json({
      ok: true,
      message: `Your request (${requestType.replace('_', ' ')}) has been notified to the staff!`,
      tableLabel,
    });
  } catch (err: any) {
    console.error('[CUSTOMER ASSISTANCE ERROR]', err);
    return NextResponse.json({ error: 'failed_to_notify', message: err.message }, { status: 500 });
  }
}
