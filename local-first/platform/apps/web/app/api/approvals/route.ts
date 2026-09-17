import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canApprove } from '@/lib/rbac';
import { requireModule } from '@/lib/modules';
import { OrderService } from '@/lib/services/order.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true; table: { select: { label: true } } };
}>;

/** shape a pending order for the approvals UI (shared by GET and the edit POSTs) */
function toPending(o: OrderWithItems) {
  return {
    id: o.id,
    number: o.number,
    table: o.table?.label ?? '—',
    channel: o.channel,
    placedAt: o.placedAt.getTime(),
    totalPaise: o.totalPaise,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.nameSnapshot,
      qty: i.qty,
      station: i.station,
      notes: i.notes,
      unitPricePaise: i.unitPricePaise,
    })),
  };
}

/** GET /api/approvals — QR orders awaiting approval for the session's outlet. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const guard = await requireModule('waiter', session.outletId);
  if (!guard.ok) return guard.response!;

  const orders = await prisma.order.findMany({
    where: { outletId: session.outletId, status: 'pending_approval' },
    orderBy: { placedAt: 'asc' },
    include: { items: { orderBy: { id: 'asc' } }, table: { select: { label: true } } },
  });

  return NextResponse.json({ orders: orders.map(toPending) });
}

/**
 * POST /api/approvals — { orderId, action: 'approve' | 'reject', reason? }.
 * approve → cut KOTs, deduct recipe stock, send to KDS, stamp approver.
 * reject  → cancel, audit the reason. Either way the QR notification is cleared.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canApprove(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const guard = await requireModule('waiter', session.outletId);
  if (!guard.ok) return guard.response!;

  const body = await req.json().catch(() => ({}));
  const { orderId, action, reason } = body;
  const VALID = ['approve', 'reject', 'update_item', 'delete_item'];
  if (!orderId || !VALID.includes(action)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    if (action === 'update_item') {
      const itemId = body.itemId as string;
      const qty = Math.round(Number(body.qty));
      if (!itemId || !Number.isFinite(qty) || qty < 1 || qty > 99) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      }
      const updated = await OrderService.updatePendingItem(orderId, itemId, qty, session.outletId, session.staffId!);
      return NextResponse.json({ ok: true, order: toPending(updated as any) });
    }

    if (action === 'delete_item') {
      const itemId = body.itemId as string;
      const why = String(reason ?? '').trim();
      if (!itemId) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      if (!why) return NextResponse.json({ error: 'reason_required', message: 'A reason is required to remove an item.' }, { status: 400 });

      const updated = await OrderService.deletePendingItem(orderId, itemId, why, session.outletId, session.staffId!);
      return NextResponse.json({ ok: true, order: toPending(updated as any) });
    }

    if (action === 'reject') {
      await OrderService.rejectOrder(orderId, session.staffId!, session.name, reason ?? null, session.outletId);
      return NextResponse.json({ ok: true, status: 'cancelled' });
    }

    if (action === 'approve') {
      await OrderService.approveOrder(orderId, session.staffId!, session.name, session.outletId);
      return NextResponse.json({ ok: true, status: 'in_kitchen', approvedBy: session.name });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err: any) {
    if (err.message === 'ORDER_NOT_FOUND') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (err.message === 'ORDER_NOT_PENDING') return NextResponse.json({ error: 'already_processed' }, { status: 409 });
    if (err.message === 'ITEM_NOT_FOUND') return NextResponse.json({ error: 'item_not_found' }, { status: 404 });
    if (err.message === 'LAST_ITEM') {
      return NextResponse.json({ error: 'last_item', message: 'This is the only item — reject the whole order instead.' }, { status: 409 });
    }
    console.error('Approvals action failed:', err);
    return NextResponse.json({ error: 'internal_error', message: err.message }, { status: 500 });
  }
}
