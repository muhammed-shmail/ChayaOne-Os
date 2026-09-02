import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { publish, toTicket } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const canMerge = (role: string) => ['owner', 'manager', 'cashier', 'waiter'].includes(role);

/**
 * POST /api/tables/merge
 * Atomically merges active orders from a source table into a destination table.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canMerge(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || !body.sourceTableId || !body.destTableId) {
    return NextResponse.json({ error: 'missing_params', message: 'sourceTableId and destTableId are required' }, { status: 400 });
  }

  const { sourceTableId, destTableId, reason } = body;
  if (sourceTableId === destTableId) {
    return NextResponse.json({ error: 'invalid_target', message: 'Cannot merge a table into itself' }, { status: 400 });
  }

  try {
    const [sourceTable, destTable] = await Promise.all([
      prisma.tableMap.findUnique({
        where: { id: sourceTableId },
        include: {
          orders: {
            where: { status: { in: ['open', 'in_kitchen', 'ready', 'served', 'pending_approval'] } },
            include: { items: true },
          },
        },
      }),
      prisma.tableMap.findUnique({
        where: { id: destTableId },
        include: {
          orders: {
            where: { status: { in: ['open', 'in_kitchen', 'ready', 'served', 'pending_approval'] } },
            include: { items: true },
          },
        },
      }),
    ]);

    if (!sourceTable || sourceTable.outletId !== session.outletId) {
      return NextResponse.json({ error: 'source_not_found', message: 'Source table not found' }, { status: 404 });
    }
    if (!destTable || destTable.outletId !== session.outletId) {
      return NextResponse.json({ error: 'dest_not_found', message: 'Destination table not found' }, { status: 404 });
    }

    if (sourceTable.orders.length === 0) {
      return NextResponse.json({ error: 'no_active_orders', message: `Table ${sourceTable.label} has no active orders to merge` }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Move all source active orders to dest table
      await tx.order.updateMany({
        where: {
          tableId: sourceTableId,
          status: { in: ['open', 'in_kitchen', 'ready', 'served', 'pending_approval'] },
        },
        data: {
          tableId: destTableId,
        },
      });

      // 2. Update Table states: source becomes free, dest becomes seated
      await tx.tableMap.update({
        where: { id: sourceTableId },
        data: { state: 'free' },
      });

      await tx.tableMap.update({
        where: { id: destTableId },
        data: { state: 'seated' },
      });

      // 3. Create AuditLog entry
      await tx.auditLog.create({
        data: {
          outletId: session.outletId,
          actorId: session.staffId,
          action: 'table.merged',
          entity: 'TableMap',
          entityId: destTableId,
          after: {
            sourceTableId,
            sourceTableLabel: sourceTable.label,
            destTableId,
            destTableLabel: destTable.label,
            mergedOrdersCount: sourceTable.orders.length,
            mergedBy: session.name,
            reason: reason || null,
          },
        },
      });

      // 4. Fetch updated destination orders with items
      const updatedDestOrders = await tx.order.findMany({
        where: {
          tableId: destTableId,
          status: { in: ['open', 'in_kitchen', 'ready', 'served', 'pending_approval'] },
        },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
        orderBy: { placedAt: 'asc' },
      });

      return {
        updatedDestOrders,
        primaryOrder: updatedDestOrders[0],
      };
    });

    // 5. Broadcast Realtime Event
    const primaryOrder = result.primaryOrder;
    await publish(session.outletId, {
      type: 'table.merged',
      merge: {
        sourceTableId,
        sourceTableLabel: sourceTable.label,
        destTableId,
        destTableLabel: destTable.label,
        destOrderId: primaryOrder ? primaryOrder.id : destTableId,
        destOrderNumber: primaryOrder ? primaryOrder.number : 0,
        mergedBy: session.name,
        timestamp: Date.now(),
      },
      ticket: primaryOrder ? toTicket(primaryOrder) : undefined,
    });

    return NextResponse.json({
      ok: true,
      message: `Table ${sourceTable.label} merged into Table ${destTable.label}`,
      sourceTable: { id: sourceTable.id, label: sourceTable.label, state: 'free' },
      destTable: { id: destTable.id, label: destTable.label, state: 'seated' },
      orders: result.updatedDestOrders,
    });
  } catch (err: any) {
    console.error('[TABLE MERGE ERROR]', err);
    return NextResponse.json({ error: 'merge_failed', message: err.message || 'Could not merge tables' }, { status: 500 });
  }
}
