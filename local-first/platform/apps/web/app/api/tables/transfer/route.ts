import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { publish, toTicket } from '@/lib/realtime';
import { createOutboxEntry } from '@/lib/outbox';
import { createPrintJob, processPrintQueueBatch } from '@/lib/print/manager';
import { routeTransferToStations } from '@/lib/print/router';
import { readKitchenWorkflow } from '@/lib/kitchenWorkflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const canTransfer = (role: string) => ['owner', 'manager', 'cashier', 'waiter'].includes(role);
const ACTIVE_STATUS = ['open', 'pending_approval', 'approved', 'in_kitchen', 'ready', 'served'] as const;

/**
 * POST /api/tables/transfer
 * Atomically transfers active running order(s) from a source table to a destination table.
 * Preserves the exact same order ID, number, items, modifiers, notes, KOT records, and bills.
 * Validates table existence, concurrency, and prevents overwriting occupied tables.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canTransfer(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { fromTableId, toTableId, orderId, reason } = body;

  if (!fromTableId || !toTableId) {
    return NextResponse.json({ error: 'missing_tables', message: 'Source and destination tables are required' }, { status: 400 });
  }

  if (fromTableId === toTableId) {
    return NextResponse.json({ error: 'same_table', message: 'Source and destination tables cannot be the same' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and verify both tables exist in this outlet
      const [fromTable, toTable] = await Promise.all([
        tx.tableMap.findFirst({ where: { id: fromTableId, outletId: session.outletId } }),
        tx.tableMap.findFirst({ where: { id: toTableId, outletId: session.outletId } }),
      ]);

      if (!fromTable || !toTable) {
        throw new Error('TABLE_NOT_FOUND');
      }

      // 2. Fetch active running order(s) on source table
      const activeOrders = await tx.order.findMany({
        where: {
          outletId: session.outletId,
          tableId: fromTableId,
          status: { in: [...ACTIVE_STATUS] },
          settledAt: null,
          ...(orderId ? { id: orderId } : {}),
        },
        include: {
          items: { where: { kotStatus: { not: 'void' } } },
          customer: { select: { name: true, phone: true } },
        },
      });

      if (activeOrders.length === 0) {
        throw new Error('NO_ACTIVE_ORDER');
      }

      // 3. Verify destination table is NOT occupied by active orders
      const destOrders = await tx.order.findMany({
        where: {
          outletId: session.outletId,
          tableId: toTableId,
          status: { in: [...ACTIVE_STATUS] },
          settledAt: null,
        },
        select: { id: true, number: true },
      });

      if (destOrders.length > 0) {
        throw new Error(`DESTINATION_OCCUPIED:${toTable.label}`);
      }

      // 4. Update the order's tableId to destination table
      const orderIds = activeOrders.map((o) => o.id);
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { tableId: toTableId },
      });

      // 5. Update TableMap state flags
      const remainingOnFrom = await tx.order.count({
        where: {
          outletId: session.outletId,
          tableId: fromTableId,
          id: { notIn: orderIds },
          status: { in: [...ACTIVE_STATUS] },
          settledAt: null,
        },
      });

      if (remainingOnFrom === 0) {
        await tx.tableMap.update({ where: { id: fromTableId }, data: { state: 'free' } });
      }
      await tx.tableMap.update({ where: { id: toTableId }, data: { state: 'seated' } });

      // 6. Record TableTransfer ledger entries
      for (const o of activeOrders) {
        await tx.tableTransfer.create({
          data: {
            outletId: session.outletId,
            orderId: o.id,
            fromTableId,
            toTableId,
            transferredBy: session.staffId,
            reason: reason?.trim() || null,
          },
        });
      }

      // 7. Record in AuditLog ledger
      for (const o of activeOrders) {
        await tx.auditLog.create({
          data: {
            outletId: session.outletId,
            actorId: session.staffId,
            action: 'table.transferred',
            entity: 'table',
            entityId: toTableId,
            before: {
              tableId: fromTableId,
              tableLabel: fromTable.label,
              orderId: o.id,
              orderNumber: o.number,
            },
            after: {
              tableId: toTableId,
              tableLabel: toTable.label,
              orderId: o.id,
              orderNumber: o.number,
              transferredBy: session.name,
              reason: reason?.trim() || null,
            },
          },
        });
      }

      // 8. Create SyncOutbox entries for offline/cloud replication
      let resolvedTenantId = session.tenantId;
      if (!resolvedTenantId) {
        const outletObj = await tx.outlet.findUnique({
          where: { id: session.outletId },
          select: { tenantId: true },
        });
        resolvedTenantId = outletObj?.tenantId ?? '00000000-0000-0000-0000-000000000000';
      }

      for (const o of activeOrders) {
        await createOutboxEntry(tx, {
          tenantId: resolvedTenantId,
          outletId: session.outletId,
          entityType: 'TableTransfer',
          entityId: o.id,
          operation: 'CREATE',
          causalGroup: `order:${o.id}`,
          payload: {
            orderId: o.id,
            orderNumber: o.number,
            fromTableId,
            fromTableLabel: fromTable.label,
            toTableId,
            toTableLabel: toTable.label,
            transferredBy: session.staffId,
            transferredByName: session.name,
            reason: reason?.trim() || null,
          },
        });
      }

      // 9. Generate dedicated KOT print job(s) for table transfer notification
      const outletRecord = await tx.outlet.findUnique({
        where: { id: session.outletId },
        select: { settings: true },
      });
      const kw = readKitchenWorkflow(outletRecord?.settings);

      if (kw.autoPrintKot || kw.mode !== 'digital') {
        for (const o of activeOrders) {
          const transferJobs = routeTransferToStations(
            {
              id: o.id,
              number: o.number,
              type: o.type,
              items: o.items,
            },
            fromTable.label,
            toTable.label,
            session.name,
            outletRecord?.settings,
          );

          for (const job of transferJobs) {
            await createPrintJob(tx, {
              tenantId: resolvedTenantId,
              outletId: session.outletId,
              jobId: `${o.id}-transfer-${job.stationId}-${Date.now()}`,
              orderId: o.id,
              printerId: job.targetDevice?.id ?? null,
              stationId: job.stationId,
              jobType: 'KOT' as any,
              payload: job.payload,
              priority: 1,
            });
          }
        }
      }

      // 10. Query updated order representations for response and realtime
      const updatedOrders = await tx.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      return { fromTable, toTable, updatedOrders };
    });

    // Process print queue batch in background (non-blocking)
    processPrintQueueBatch().catch(() => {});

    // Broadcast realtime notifications to all staff / POS / Waiter / KDS devices
    for (const order of result.updatedOrders) {
      const ticket = toTicket(order);
      await publish(session.outletId, {
        type: 'table.transferred',
        transfer: {
          orderId: order.id,
          orderNumber: order.number,
          fromTableId,
          toTableId,
          fromTableLabel: result.fromTable.label,
          toTableLabel: result.toTable.label,
          newTableStatus: 'occupied',
          transferredBy: session.name,
          timestamp: Date.now(),
          reason: reason?.trim() || null,
        },
        ticket,
      });

      // Also publish order.updated so KDS and POS update tickets in-place
      await publish(session.outletId, { type: 'order.updated', ticket });
    }

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
