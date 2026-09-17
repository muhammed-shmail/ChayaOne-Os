import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canTransfer } from '@/lib/rbac';
import { TableService } from '@/lib/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/tables/transfer
 * Atomically transfers active running order(s) from a source table to a destination table.
 * Delegates to TableService domain service.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canTransfer(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { fromTableId, toTableId, orderId, reason } = body;

  if (!fromTableId || !toTableId) {
    return NextResponse.json({ error: 'missing_tables', message: 'Source and destination tables are required' }, { status: 400 });
  }

  if (fromTableId === toTableId) {
    return NextResponse.json({ error: 'same_table', message: 'Source and destination tables cannot be the same' }, { status: 400 });
  }

  try {
    const result = await TableService.transferTable({
      outletId: session.outletId,
      fromTableId,
      toTableId,
      staffId: session.staffId,
      staffName: session.name,
      orderId,
      reason,
    });

    const first = result.updatedOrders[0];
    return NextResponse.json({
      ok: true,
      orderId: first?.id,
      orderNumber: first?.number,
      fromTable: result.fromTable.label,
      toTable: result.toTable.label,
      transferredCount: result.updatedOrders.length,
      orders: result.updatedOrders,
    });
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg === 'TABLE_NOT_FOUND') {
      return NextResponse.json({ error: 'table_not_found', message: 'Table not found' }, { status: 404 });
    }
    if (msg === 'NO_ACTIVE_ORDER') {
      return NextResponse.json({ error: 'no_active_order', message: 'Source table has no active order' }, { status: 404 });
    }
    if (msg.startsWith('DESTINATION_OCCUPIED:')) {
      const label = msg.split(':')[1] || 'Destination';
      return NextResponse.json({ error: 'destination_occupied', message: `${label} is already occupied.` }, { status: 409 });
    }

    console.error('[TABLE TRANSFER ERROR]', err);
    return NextResponse.json({ error: 'transfer_failed', message: 'Could not transfer table' }, { status: 500 });
  }
}
