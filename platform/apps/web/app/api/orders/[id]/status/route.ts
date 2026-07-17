import { NextRequest, NextResponse } from 'next/server';
import { prisma, type KotStatus, type OrderStatus, type Prisma } from '@cafeos/db';
import { AdvanceOrderSchema } from '@cafeos/core';
import { getSession } from '@/lib/auth';
import { publish, toTicket } from '@/lib/realtime';
import { alertOrderCancelled } from '@/lib/alerts';
import { createNotification } from '@/lib/notify';
import { reverseWalletHold } from '@/lib/wallet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** kitchen lifecycle order used to derive the "next" bump when none is given */
const FLOW: OrderStatus[] = ['open', 'in_kitchen', 'ready', 'served'];
const KOT_FOR: Partial<Record<OrderStatus, KotStatus>> = {
  in_kitchen: 'preparing',
  ready: 'ready',
  served: 'served',
};

/**
 * PATCH /api/orders/:id/status — KDS bump / lifecycle advance.
 * Body may specify { status }, else we advance one step. Scoped to the staff
 * member's outlet. Publishes order.updated so every KDS reflects it live.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { status: true, outletId: true, totalPaise: true, settledAt: true } });
  if (!order || order.outletId !== session.outletId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // status: explicit from body, or the next step in the flow
  const body = await req.json().catch(() => ({}));
  let next: OrderStatus;
  const parsed = AdvanceOrderSchema.safeParse(body);
  if (parsed.success) {
    next = parsed.data.status as OrderStatus;
  } else {
    const i = FLOW.indexOf(order.status as OrderStatus);
    next = FLOW[Math.min(i + 1, FLOW.length - 1)] ?? 'served';
  }

  // settling from the dashboard queue takes payment too (mirrors the POS settle):
  // record a Payment + settledAt so collections/reports stay accurate. Guard on
  // settledAt so a re-settle can't double-charge.
  const settling = next === 'settled' && !order.settledAt;
  const rawMethod = (body as { method?: unknown }).method;
  const method = (['cash', 'upi', 'card'] as const).includes(rawMethod as 'cash' | 'upi' | 'card')
    ? (rawMethod as 'cash' | 'upi' | 'card')
    : 'cash';

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: params.id },
      data: { status: next, ...(settling ? { settledAt: new Date() } : {}) },
      include: { items: true, table: { select: { label: true } }, customer: { select: { name: true } } },
    });
    const kot = KOT_FOR[next];
    if (kot) await tx.orderItem.updateMany({ where: { orderId: params.id }, data: { kotStatus: kot } });
    if (settling) {
      await tx.payment.create({
        data: { orderId: o.id, outletId: o.outletId, method, amountPaise: o.totalPaise, status: 'success' },
      });
    }
    return o;
  });

  if (settling) {
    await prisma.auditLog.create({
      data: { outletId: order.outletId, actorId: session.staffId, action: 'order.settled', entity: 'order', entityId: params.id, after: { method, totalPaise: order.totalPaise } as Prisma.InputJsonValue },
    }).catch(() => {});
  }

  await publish(session.outletId, { type: 'order.updated', ticket: toTicket(updated) });
  if (next === 'cancelled') {
    await reverseWalletHold(params.id); // refund any provisional wallet points
    await alertOrderCancelled(session.outletId, { number: updated.number, by: session.name, totalPaise: updated.totalPaise });
  }
  // Order ready → ping the waiter who took it (their phone's notification bar).
  if (next === 'ready' && updated.staffId) {
    const where = updated.table?.label ? `Table ${updated.table.label}` : updated.type === 'takeaway' ? 'Takeaway' : '';
    await createNotification({
      outletId: session.outletId,
      type: 'order_ready',
      severity: 'info',
      title: `Order #${updated.number} is ready`,
      body: where ? `${where} — ready to serve` : 'Ready to serve',
      entity: 'order',
      entityId: updated.id,
      audience: 'user',
      targetStaffId: updated.staffId,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, status: next });
}
