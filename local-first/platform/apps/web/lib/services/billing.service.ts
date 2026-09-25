import { prisma, type Prisma, OrderStatus, TableState, PayMethod, PayStatus, PrintJobType } from '@cafeos/db';
import { publish, toTicket } from '../realtime';
import { createOutboxEntry } from '../outbox';
import { createPrintJob, processPrintQueueBatch } from '../print/manager';
import { readReceiptConfig } from '../receipt';
import { readUpiConfig } from '../print/upi';
import { resolveReceiptPrinter } from '../print/router';
import { accrueLoyaltyOnSettle } from '../customer';
import { getOutletPwa } from '../pwa';

export interface SettlePaymentLine {
  method: PayMethod;
  amountPaise: number;
  providerRef?: string | null;
}

export interface SettleBillParams {
  orderId: string;
  outletId: string;
  payments: SettlePaymentLine[];
  staffId: string | null;
  staffName?: string | null;
  tipPaise?: number;
}

export class BillingService {
  /**
   * Settles an order bill with one or more payments (Cash, Card, UPI, etc.).
   * Atomically closes the order, frees the table if appropriate, queues a thermal receipt print job,
   * accrues customer loyalty points, and broadcasts realtime events.
   */
  static async settleBill(params: SettleBillParams) {
    const { orderId, outletId, payments, staffId, staffName } = params;

    if (!payments || payments.length === 0) {
      throw new Error('PAYMENTS_REQUIRED');
    }

    const totalPaidPaise = payments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
    if (totalPaidPaise <= 0) {
      throw new Error('INVALID_PAYMENT_AMOUNT');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          table: { select: { id: true, label: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      if (!order || order.outletId !== outletId) {
        throw new Error('ORDER_NOT_FOUND');
      }

      if (order.status === OrderStatus.settled) {
        throw new Error('ORDER_ALREADY_SETTLED');
      }
      if (order.status === OrderStatus.cancelled) {
        throw new Error('ORDER_CANCELLED');
      }

      // Check amount: totalPaid must be >= totalPaise
      if (totalPaidPaise < order.totalPaise) {
        throw new Error(`INSUFFICIENT_PAYMENT: Paid ${totalPaidPaise} < Total ${order.totalPaise}`);
      }

      // 2. Mark order as settled
      const settledOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.settled,
          settledAt: new Date(),
        },
        include: {
          items: true,
          table: { select: { id: true, label: true } },
          customer: { select: { id: true, name: true, phone: true } },
          payments: true,
        },
      });

      // 3. Create Payment records
      const createdPayments: any[] = [];
      for (const p of payments) {
        const payRow = await tx.payment.create({
          data: {
            orderId,
            outletId,
            method: p.method,
            amountPaise: p.amountPaise,
            status: PayStatus.success,
            providerRef: p.providerRef ?? null,
          },
        });
        createdPayments.push(payRow);
      }

      // 4. Free table if no other active orders remain on it
      if (order.tableId) {
        const remainingActive = await tx.order.count({
          where: {
            outletId,
            tableId: order.tableId,
            id: { not: orderId },
            status: { in: [OrderStatus.open, OrderStatus.in_kitchen, OrderStatus.ready, OrderStatus.served] },
            settledAt: null,
          },
        });

        if (remainingActive === 0) {
          await tx.tableMap.update({
            where: { id: order.tableId },
            data: { state: TableState.free },
          });
        }
      }

      // 5. Fetch outlet details for receipt & print
      const outlet = await tx.outlet.findUnique({
        where: { id: outletId },
        select: {
          id: true,
          name: true,
          tenantId: true,
          gstin: true,
          address: true,
          settings: true,
        },
      });
      const resolvedTenantId = outlet?.tenantId ?? '00000000-0000-0000-0000-000000000000';

      // 6. Queue thermal receipt print job
      const receiptConfig = readReceiptConfig(outlet?.settings);
      const upiConfig = readUpiConfig(outlet?.settings, outlet?.name || 'CHAYA CAFE');

      let staffStation: string | null = null;
      if (staffId) {
        const staffObj = await tx.staffUser.findUnique({ where: { id: staffId }, select: { permissions: true } }).catch(() => null);
        staffStation = (staffObj?.permissions as any)?.station || null;
      }
      const receiptPrinter = resolveReceiptPrinter(outlet?.settings, staffStation);

      const receiptPayload = {
        storeName: outlet?.name || 'CHAYA CAFE',
        gstin: outlet?.gstin ?? undefined,
        address: typeof outlet?.address === 'string' ? outlet.address : undefined,
        orderNumber: order.number,
        invoiceNumber: `INV-${order.number}`,
        table: order.table?.label,
        waiter: staffName ?? undefined,
        cashier: staffName ?? undefined,
        station: staffStation ?? undefined,
        customerName: order.customer?.name ?? undefined,
        customerPhone: order.customer?.phone ?? undefined,
        placedAt: order.placedAt.toISOString(),
        settledAt: new Date().toISOString(),
        items: order.items.map((i) => ({
          name: i.nameSnapshot,
          qty: i.qty,
          pricePaise: i.unitPricePaise,
          totalPaise: i.unitPricePaise * i.qty,
        })),
        subtotalPaise: order.subtotalPaise,
        discountPaise: order.discountPaise,
        cgstPaise: order.cgstPaise,
        sgstPaise: order.sgstPaise,
        igstPaise: order.igstPaise,
        serviceChargePaise: order.serviceChargePaise,
        roundOffPaise: order.roundOffPaise,
        totalPaise: order.totalPaise,
        payments: createdPayments.map((p) => ({
          method: p.method,
          amountPaise: p.amountPaise,
        })),
        receiptConfig,
        upiConfig,
      };

      await createPrintJob(tx, {
        tenantId: resolvedTenantId,
        outletId,
        orderId: order.id,
        printerId: receiptPrinter?.id ?? null,
        stationId: staffStation ?? undefined,
        jobType: PrintJobType.RECEIPT,
        payload: receiptPayload,
        priority: 2, // High priority for customer bill
      });

      // 7. Accrue loyalty points if customer attached
      if (order.customerId) {
        const pwa = await getOutletPwa(outletId);
        await accrueLoyaltyOnSettle(tx, {
          customerId: order.customerId,
          outletId,
          totalPaise: order.totalPaise,
          pwa,
          refId: order.id,
        });
      }

      // 8. Outbox replication entry
      await createOutboxEntry(tx, {
        tenantId: resolvedTenantId,
        outletId,
        entityType: 'Payment',
        entityId: order.id,
        operation: 'CREATE',
        causalGroup: `order:${order.id}`,
        payload: {
          orderId: order.id,
          orderNumber: order.number,
          totalPaise: order.totalPaise,
          payments: createdPayments,
          settledAt: settledOrder.settledAt,
        },
      });

      // 9. Audit log entry
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: staffId,
          action: 'order.settled',
          entity: 'order',
          entityId: order.id,
          after: {
            orderNumber: order.number,
            totalPaise: order.totalPaise,
            totalPaidPaise,
            paymentMethods: payments.map((p) => p.method),
          } as Prisma.InputJsonValue,
        },
      });

      return { order: settledOrder, payments: createdPayments };
    });

    // Background jobs
    processPrintQueueBatch().catch(() => {});

    // Broadcast realtime event
    const ticket = toTicket(result.order);
    await publish(outletId, { type: 'order.updated', ticket });
    if (result.order.tableId) {
      await publish(outletId, { type: 'table.updated', tableId: result.order.tableId, state: 'free' });
    }

    return result;
  }
}
