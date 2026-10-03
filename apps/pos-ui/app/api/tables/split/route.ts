import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { computeBill, type BillLine } from '@cafeos/core';
import { getSession } from '@/lib/auth';
import { canSplit } from '@/lib/rbac';
import { publish, toTicket } from '@/lib/realtime';
import { getOutletGst, gstBillOptions } from '@/lib/tax';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function nextOrderNumber(outletId: string): Promise<number> {
  const latest = await prisma.order.findFirst({
    where: { outletId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (latest?.number ?? 0) + 1;
}

/**
 * POST /api/tables/split
 * Atomically splits selected items/quantities from an active order into a new order or sub-bill.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canSplit(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || !body.orderId || !Array.isArray(body.itemSplits) || body.itemSplits.length === 0) {
    return NextResponse.json({ error: 'invalid_params', message: 'orderId and itemSplits array are required' }, { status: 400 });
  }

  const { orderId, itemSplits, targetTableId, reason } = body;

  try {
    const originalOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            item: { select: { gstRate: true, categoryId: true } },
          },
        },
        table: true,
      },
    });

    if (!originalOrder || originalOrder.outletId !== session.outletId) {
      return NextResponse.json({ error: 'order_not_found', message: 'Order not found' }, { status: 404 });
    }

    if (!['open', 'in_kitchen', 'ready', 'served', 'pending_approval'].includes(originalOrder.status)) {
      return NextResponse.json({ error: 'order_closed', message: 'Cannot split an already settled or cancelled order' }, { status: 400 });
    }

    let targetTable = originalOrder.table;
    if (targetTableId && targetTableId !== originalOrder.tableId) {
      const foundTarget = await prisma.tableMap.findUnique({ where: { id: targetTableId } });
      if (!foundTarget || foundTarget.outletId !== session.outletId) {
        return NextResponse.json({ error: 'target_table_not_found', message: 'Target table not found' }, { status: 404 });
      }
      targetTable = foundTarget;
    }

    const gstConfig = await getOutletGst(session.outletId);
    const gstOpts = gstBillOptions(gstConfig);
    const newNumber = await nextOrderNumber(session.outletId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the new Split Order
      const newOrder = await tx.order.create({
        data: {
          clientUuid: randomUUID(),
          number: newNumber,
          outletId: session.outletId,
          tableId: targetTable?.id ?? originalOrder.tableId,
          customerId: originalOrder.customerId,
          staffId: session.staffId,
          type: originalOrder.type,
          status: originalOrder.status,
          channel: originalOrder.channel,
          subtotalPaise: 0,
          discountPaise: 0,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
          totalPaise: 0,
        },
      });

      // 2. Process item splits
      const splitMap = new Map<string, number>();
      for (const s of itemSplits) {
        if (s.orderItemId && s.qtyToSplit > 0) {
          splitMap.set(s.orderItemId, Math.floor(Number(s.qtyToSplit)));
        }
      }

      for (const item of originalOrder.items) {
        const qtyToSplit = splitMap.get(item.id);
        if (!qtyToSplit) continue;

        if (qtyToSplit >= item.qty) {
          // Move entire line item to new order
          await tx.orderItem.update({
            where: { id: item.id },
            data: { orderId: newOrder.id },
          });
        } else {
          // Reduce original item qty
          await tx.orderItem.update({
            where: { id: item.id },
            data: { qty: item.qty - qtyToSplit },
          });
          // Create new item for split portion
          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              itemId: item.itemId,
              nameSnapshot: item.nameSnapshot,
              qty: qtyToSplit,
              unitPricePaise: item.unitPricePaise,
              modifiers: item.modifiers ?? undefined,
              notes: item.notes,
              station: item.station,
              kotStatus: item.kotStatus,
            },
          });
        }
      }

      // 3. Fetch all items for both orders and recompute bills
      const [remainingItems, newItems] = await Promise.all([
        tx.orderItem.findMany({
          where: { orderId: originalOrder.id },
          include: { item: { select: { gstRate: true } } },
        }),
        tx.orderItem.findMany({
          where: { orderId: newOrder.id },
          include: { item: { select: { gstRate: true } } },
        }),
      ]);

      const origBillLines: BillLine[] = remainingItems.map((i) => ({
        pricePaise: i.unitPricePaise,
        gstRate: i.item?.gstRate != null ? Number(i.item.gstRate) : 5,
        qty: i.qty,
      }));
      const origBill = computeBill(origBillLines, gstOpts);

      const newBillLines: BillLine[] = newItems.map((i) => ({
        pricePaise: i.unitPricePaise,
        gstRate: i.item?.gstRate != null ? Number(i.item.gstRate) : 5,
        qty: i.qty,
      }));
      const newBill = computeBill(newBillLines, gstOpts);

      // Update both orders with calculated financials
      const updatedOriginal = await tx.order.update({
        where: { id: originalOrder.id },
        data: {
          subtotalPaise: origBill.subtotalPaise,
          discountPaise: origBill.discountPaise,
          cgstPaise: origBill.cgstPaise,
          sgstPaise: origBill.sgstPaise,
          igstPaise: origBill.igstPaise,
          roundOffPaise: origBill.roundOffPaise,
          totalPaise: origBill.totalPaise,
        },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      const updatedNew = await tx.order.update({
        where: { id: newOrder.id },
        data: {
          subtotalPaise: newBill.subtotalPaise,
          discountPaise: newBill.discountPaise,
          cgstPaise: newBill.cgstPaise,
          sgstPaise: newBill.sgstPaise,
          igstPaise: newBill.igstPaise,
          roundOffPaise: newBill.roundOffPaise,
          totalPaise: newBill.totalPaise,
        },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      // Update target table state if target table was specified and different
      if (targetTableId && targetTableId !== originalOrder.tableId) {
        await tx.tableMap.update({
          where: { id: targetTableId },
          data: { state: 'seated' },
        });
      }

      // 4. Audit Log
      let validActorId: string | null = null;
      if (session.staffId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.staffId)) {
        const staffExists = await tx.staffUser.findUnique({ where: { id: session.staffId }, select: { id: true } });
        if (staffExists) validActorId = session.staffId;
      }

      await tx.auditLog.create({
        data: {
          outletId: session.outletId,
          actorId: validActorId,
          action: 'table.split',
          entity: 'Order',
          entityId: originalOrder.id,
          after: {
            originalOrderId: originalOrder.id,
            originalOrderNumber: originalOrder.number,
            newOrderId: newOrder.id,
            newOrderNumber: newNumber,
            targetTableId: targetTable?.id,
            targetTableLabel: targetTable?.label,
            splitBy: session.name,
            reason: reason || null,
          },
        },
      }).catch((e) => console.warn('[SPLIT AUDIT WARN]', e));

      return {
        updatedOriginal,
        updatedNew,
      };
    });

    // 5. Broadcast Realtime Event
    await publish(session.outletId, {
      type: 'table.split',
      split: {
        originalTableId: originalOrder.tableId ?? '',
        originalTableLabel: originalOrder.table?.label ?? '',
        originalOrderId: originalOrder.id,
        originalOrderNumber: originalOrder.number,
        newOrderId: result.updatedNew.id,
        newOrderNumber: result.updatedNew.number,
        newTableId: targetTable?.id,
        newTableLabel: targetTable?.label,
        splitBy: session.name,
        timestamp: Date.now(),
      },
      ticket: toTicket(result.updatedNew),
    });

    return NextResponse.json({
      ok: true,
      message: `Order #${originalOrder.number} split into new Order #${result.updatedNew.number}`,
      originalOrder: result.updatedOriginal,
      newOrder: result.updatedNew,
    });
  } catch (err: any) {
    console.error('[TABLE SPLIT ERROR]', err);
    return NextResponse.json({ error: 'split_failed', message: err.message || 'Could not split table order' }, { status: 500 });
  }
}
