import { prisma, OrderStatus, KotStatus } from '@cafeos/db';
import { publish, toTicket } from '../realtime';

export class KDSService {
  /**
   * Fetches active kitchen display orders for an outlet, optionally filtered by kitchen station.
   */
  static async getActiveKdsOrders(outletId: string, station?: string | null) {
    const orders = await prisma.order.findMany({
      where: {
        outletId,
        status: { in: [OrderStatus.open, OrderStatus.in_kitchen, OrderStatus.ready] },
        settledAt: null,
      },
      orderBy: { placedAt: 'asc' },
      include: {
        table: { select: { label: true } },
        customer: { select: { name: true } },
        staff: { select: { name: true } },
        items: {
          where: {
            kotStatus: { not: 'void' },
            ...(station ? { station: { equals: station, mode: 'insensitive' } } : {}),
          },
        },
      },
    });

    // Filter out orders that have 0 items matching the station
    const filtered = station ? orders.filter((o) => o.items.length > 0) : orders;

    return filtered.map((o) => toTicket(o));
  }

  /**
   * Bumps an order ticket to its next status on the KDS display.
   * e.g. open/in_kitchen -> ready -> served.
   */
  static async bumpTicket(orderId: string, newStatus: OrderStatus, outletId: string, staffId?: string | null) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        table: { select: { label: true } },
        customer: { select: { name: true } },
      },
    });

    if (!order || order.outletId !== outletId) {
      throw new Error('ORDER_NOT_FOUND');
    }

    let kotStatus: KotStatus = KotStatus.queued;
    if (newStatus === OrderStatus.in_kitchen) kotStatus = KotStatus.preparing;
    if (newStatus === OrderStatus.ready) kotStatus = KotStatus.ready;
    if (newStatus === OrderStatus.served) kotStatus = KotStatus.served;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      await tx.orderItem.updateMany({
        where: { orderId },
        data: { kotStatus },
      });

      if (staffId) {
        await tx.auditLog.create({
          data: {
            outletId,
            actorId: staffId,
            action: 'kds.ticket_bumped',
            entity: 'order',
            entityId: orderId,
            after: { status: newStatus },
          },
        }).catch(() => {});
      }

      return res;
    });

    const ticket = toTicket(updated);
    await publish(outletId, { type: 'order.updated', ticket });

    return ticket;
  }
}
