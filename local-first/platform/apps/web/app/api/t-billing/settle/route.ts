import { NextRequest, NextResponse } from 'next/server';
import { prisma, type OrderStatus, type Prisma } from '@cafeos/db';
import { computeBill } from '@cafeos/core';
import { getSession } from '@/lib/auth';
import { publish, toTicket } from '@/lib/realtime';
import { createOutboxEntry } from '@/lib/outbox';
import { getOutletGst, gstBillOptions } from '@/lib/tax';
import { readReceiptConfig } from '@/lib/receipt';
import { createPrintJob } from '@/lib/print/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PaymentItem {
  method: 'cash' | 'upi' | 'card' | 'other';
  amountPaise: number;
  providerRef?: string;
}

/**
 * POST /api/t-billing/settle
 * Settles an existing order via the dedicated T-Billing workflow.
 * Computes taxes, applies authorized discounts, records payments (single or split),
 * assigns a persistent invoice number, prints thermal receipt, and completes the order.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orderId, discountPct, discountFlatPaise, payments, customerName, customerPhone, customerGstin } = body;

  if (!orderId) {
    return NextResponse.json({ error: 'missing_order_id' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          item: {
            select: { gstRate: true }
          }
        }
      },
      table: { select: { label: true } },
      customer: { select: { id: true, name: true, phone: true } }
    }
  });

  if (!order || order.outletId !== session.outletId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'order_cancelled' }, { status: 400 });
  }

  // RBAC validation for custom discounts: only owner or manager can apply custom discounts
  if ((discountPct > 0 || discountFlatPaise > 0) && !['owner', 'manager'].includes(session.role)) {
    return NextResponse.json({ error: 'discount_permission_denied' }, { status: 403 });
  }

  // 1. Calculate items & bill total
  const billLines = order.items.map((i) => ({
    pricePaise: i.unitPricePaise,
    modPaise: ((i.modifiers as any) || []).reduce((s: number, m: any) => s + (m.pricePaise || 0), 0),
    gstRate: Number(i.item?.gstRate ?? 5.00),
    qty: i.qty,
  }));

  const gst = await getOutletGst(session.outletId);
  const bill = computeBill(billLines, {
    discountPct: discountPct || 0,
    discountFlatPaise: discountFlatPaise || 0,
    ...gstBillOptions(gst),
  });

  // 2. Validate Payment Amounts
  const paymentList: PaymentItem[] = Array.isArray(payments) && payments.length > 0
    ? payments
    : [{ method: body.method || 'cash', amountPaise: bill.totalPaise, providerRef: body.providerRef }];

  const paidTotal = paymentList.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  if (paidTotal < bill.totalPaise) {
    return NextResponse.json({
      error: 'insufficient_payment',
      totalPaise: bill.totalPaise,
      paidPaise: paidTotal,
      remainingPaise: bill.totalPaise - paidTotal,
    }, { status: 400 });
  }

  // 3. Persistent Invoice Number Generation
  const year = new Date().getFullYear();
  const invoicePrefix = `INV-${year}-`;
  // Use order number as persistent invoice sequence if not already assigned
  const invoiceNo = `${invoicePrefix}${String(order.number).padStart(6, '0')}`;

  // 4. Update Customer if provided
  let customerId = order.customerId;
  if (customerName && customerName.trim() && customerName !== 'Walk-in Customer') {
    if (order.customerId) {
      await prisma.customer.update({
        where: { id: order.customerId },
        data: { name: customerName.trim(), phone: customerPhone?.trim() || undefined },
      }).catch(() => {});
    } else {
      const newCust = await prisma.customer.create({
        data: {
          tenantId: session.tenantId,
          name: customerName.trim(),
          phone: customerPhone?.trim() || null,
        }
      }).catch(() => null);
      if (newCust) customerId = newCust.id;
    }
  }

  // 5. Atomic DB Settlement Transaction
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // Update Order
    const o = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'settled',
        settledAt: new Date(),
        customerId,
        discountPaise: bill.discountPaise,
        cgstPaise: bill.cgstPaise,
        sgstPaise: bill.sgstPaise,
        igstPaise: bill.igstPaise,
        roundOffPaise: bill.roundOffPaise,
        totalPaise: bill.totalPaise,
      },
      include: { items: true, table: { select: { label: true } }, customer: { select: { name: true, phone: true } } },
    });

    // Mark KOT items as served
    await tx.orderItem.updateMany({
      where: { orderId: orderId },
      data: { kotStatus: 'served' },
    });

    // Create Payments
    for (const p of paymentList) {
      await tx.payment.create({
        data: {
          orderId: o.id,
          outletId: o.outletId,
          method: p.method === 'other' ? 'card' : p.method,
          amountPaise: p.amountPaise,
          providerRef: p.providerRef || null,
          status: 'success',
          meta: { invoiceNo, cashier: session.name },
        }
      });
    }

    // Write Outbox
    await createOutboxEntry(tx, {
      tenantId: session.tenantId,
      outletId: session.outletId,
      entityType: 'Order',
      entityId: o.id,
      operation: 'UPDATE',
      causalGroup: `order:${o.id}`,
      payload: {
        orderId: o.id,
        invoiceNo,
        status: 'settled',
        settledAt: o.settledAt,
        totalPaise: bill.totalPaise,
        payments: paymentList,
      },
    });

    return o;
  });

  // 6. Record Audit Log
  await prisma.auditLog.create({
    data: {
      outletId: session.outletId,
      actorId: session.staffId,
      action: 't_billing.settle',
      entity: 'order',
      entityId: orderId,
      after: {
        invoiceNo,
        totalPaise: bill.totalPaise,
        payments: paymentList,
        cashier: session.name,
      } as unknown as Prisma.InputJsonValue,
    }
  }).catch(() => {});

  // 7. Create ESC/POS PrintJob in database for Receipt Printer
  const outletInfo = await prisma.outlet.findUnique({ where: { id: session.outletId }, select: { name: true, gstin: true, settings: true } });
  const receiptConfig = readReceiptConfig(outletInfo?.settings);

  const receiptPayload = {
    invoiceNo,
    orderNumber: updatedOrder.number,
    tableName: updatedOrder.table?.label ?? (updatedOrder.type === 'takeaway' ? 'Takeaway' : 'Direct'),
    orderType: updatedOrder.type,
    customerName: updatedOrder.customer?.name ?? customerName ?? 'Walk-in Customer',
    customerPhone: updatedOrder.customer?.phone ?? customerPhone ?? '',
    customerGstin: customerGstin ?? '',
    date: new Date().toLocaleDateString('en-IN'),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    cashierName: session.name,
    outletName: outletInfo?.name ?? 'CHAYAONE CAFE',
    gstin: outletInfo?.gstin ?? undefined,
    headerNote: receiptConfig.header,
    footerNote: receiptConfig.footer,
    phone: receiptConfig.phone,
    items: updatedOrder.items.map((i) => ({
      name: i.nameSnapshot,
      qty: i.qty,
      unitPricePaise: i.unitPricePaise,
      totalPaise: i.unitPricePaise * i.qty,
    })),
    subtotalPaise: bill.subtotalPaise,
    discountPaise: bill.discountPaise,
    cgstPaise: bill.cgstPaise,
    sgstPaise: bill.sgstPaise,
    roundOffPaise: bill.roundOffPaise,
    totalPaise: bill.totalPaise,
    paymentMethod: paymentList.map(p => p.method.toUpperCase()).join(' + '),
    paidAmountPaise: paidTotal,
    changePaise: Math.max(0, paidTotal - bill.totalPaise),
  };

  await createPrintJob(prisma, {
    tenantId: session.tenantId,
    outletId: session.outletId,
    jobType: 'RECEIPT' as any,
    payload: receiptPayload,
  }).catch(() => {});

  // 8. Publish Realtime Notification
  await publish(session.outletId, { type: 'order.updated', ticket: toTicket(updatedOrder) });

  return NextResponse.json({
    ok: true,
    invoiceNo,
    order: updatedOrder,
    bill,
    payments: paymentList,
    changePaise: Math.max(0, paidTotal - bill.totalPaise),
    receipt: receiptPayload,
  });
}
