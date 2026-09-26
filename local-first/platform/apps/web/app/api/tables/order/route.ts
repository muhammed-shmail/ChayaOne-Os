import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma, PrintJobType } from '@cafeos/db';
import { computeBill, type BillLine } from '@cafeos/core';
import { getSession, type Session } from '@/lib/auth';
import { canSettle, canVoid } from '@/lib/rbac';
import { publish, toTicket } from '@/lib/realtime';
import { reverseRecipeConsumption } from '@/lib/inventory';
import { getOutletGst, gstBillOptions } from '@/lib/tax';
import { getOutletPwa } from '@/lib/pwa';
import { findOrCreateCustomerByPhone, accrueLoyaltyOnSettle } from '@/lib/customer';
import { createPrintJob, processPrintQueueBatch } from '@/lib/print/manager';
import { resolveReceiptPrinter } from '@/lib/print/router';
import { readReceiptConfig } from '@/lib/receipt';
import { readUpiConfig } from '@/lib/print/upi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** order statuses that count as "running" (occupying the table) */
const ACTIVE_STATUS = ['open', 'in_kitchen', 'ready', 'served'] as const;

/**
 * GET /api/tables/order?tableId=… — the table's running (unsettled) orders,
 * merged into one bill view for the POS table-actions panel. Voided lines are
 * excluded from both the line list and the totals.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tableId = req.nextUrl.searchParams.get('tableId');
  if (!tableId) return NextResponse.json({ error: 'missing_table' }, { status: 400 });

  const table = await prisma.tableMap.findFirst({ where: { id: tableId, outletId: session.outletId }, select: { id: true, label: true, state: true } });
  if (!table) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { tableId, outletId: session.outletId, status: { in: [...ACTIVE_STATUS] }, settledAt: null },
    orderBy: { placedAt: 'asc' },
    include: {
      items: { where: { kotStatus: { not: 'void' } }, orderBy: { id: 'asc' } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  const allLines = orders.flatMap((o) =>
    o.items.map((i) => ({
      id: i.id,
      orderId: o.id,
      name: i.nameSnapshot,
      qty: i.qty,
      unitPricePaise: i.unitPricePaise,
      linePaise: i.qty * i.unitPricePaise,
      station: i.station,
      kotStatus: i.kotStatus,
    })),
  );

  const totals = {
    subtotalPaise: orders.reduce((s, o) => s + o.subtotalPaise, 0),
    discountPaise: orders.reduce((s, o) => s + o.discountPaise, 0),
    cgstPaise: orders.reduce((s, o) => s + o.cgstPaise, 0),
    sgstPaise: orders.reduce((s, o) => s + o.sgstPaise, 0),
    igstPaise: orders.reduce((s, o) => s + o.igstPaise, 0),
    serviceChargePaise: orders.reduce((s, o) => s + o.serviceChargePaise, 0),
    roundOffPaise: orders.reduce((s, o) => s + o.roundOffPaise, 0),
    totalPaise: orders.reduce((s, o) => s + o.totalPaise, 0),
  };

  const billPrintedAudit = orders.length > 0 && orders[0]?.placedAt
    ? await prisma.auditLog.findFirst({
        where: {
          outletId: session.outletId,
          action: 'bill.printed',
          entity: 'table',
          entityId: tableId,
          createdAt: { gte: orders[0].placedAt },
        },
        select: { id: true },
      }).catch(() => null)
    : null;
  const isBillPrinted = Boolean(billPrintedAudit) || table.state === 'free';
  const activeCustomer = orders.find((o) => o.customer)?.customer ?? null;

  return NextResponse.json({
    table: { id: table.id, label: table.label },
    count: orders.length,
    orders: orders.map((o) => ({ id: o.id, number: o.number, totalPaise: o.totalPaise, placedAt: o.placedAt })),
    customer: activeCustomer ? { id: activeCustomer.id, name: activeCustomer.name, phone: activeCustomer.phone } : null,
    lines: allLines,
    totals,
    billPrinted: isBillPrinted,
  });
}

/**
 * Dispatches a bill print job directly to the physical thermal printer assigned to the waiter's station.
 * Sends ESC/POS directly to the LAN printer over TCP 9100 without showing any browser print popups.
 */
async function dispatchStationBillPrint(
  session: Session,
  tableId: string,
  orderId?: string | null,
  requestedStation?: string | null,
  staffName?: string | null,
) {
  // 1. Resolve waiter's station
  let waiterStation = requestedStation || (session.permissions as any)?.station || null;
  if (!waiterStation && session.staffId) {
    const staffObj = await prisma.staffUser
      .findUnique({ where: { id: session.staffId }, select: { permissions: true } })
      .catch(() => null);
    waiterStation = (staffObj?.permissions as any)?.station || null;
  }

  // 2. Fetch orders for this table
  let orders = await prisma.order.findMany({
    where: {
      tableId,
      outletId: session.outletId,
      status: { in: [...ACTIVE_STATUS] },
      settledAt: null,
    },
    include: { items: true, table: true, customer: true },
    orderBy: { placedAt: 'asc' },
  });

  if (orders.length === 0 && orderId) {
    const single = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true, customer: true },
    });
    if (single && single.outletId === session.outletId) {
      orders = [single];
    }
  }

  if (orders.length === 0) {
    return { ok: false, error: 'no_active_orders', printerName: null, station: waiterStation };
  }

  // 3. Fetch outlet info & settings
  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { name: true, gstin: true, address: true, timezone: true, settings: true, tenantId: true },
  });

  // 4. Resolve printer assigned to the waiter's station (P1, P2, P3, or dynamic new station)
  const targetPrinter = resolveReceiptPrinter(outlet?.settings, waiterStation);
  console.log(`[PRINT] Waiter billing print dispatch: Waiter station "${waiterStation}" ➔ Station Printer "${targetPrinter?.name || 'Default'}" (ID: ${targetPrinter?.id || 'none'})`);

  // 5. Build ESC/POS bill preview payload
  const items = orders.flatMap((o) =>
    o.items.map((i) => ({
      name: i.nameSnapshot,
      qty: i.qty,
      pricePaise: i.unitPricePaise,
      totalPaise: i.unitPricePaise * i.qty,
      notes: i.notes ?? undefined,
      modifiers: Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [],
    }))
  );

  const subtotalPaise = orders.reduce((s, o) => s + (o.subtotalPaise || 0), 0);
  const discountPaise = orders.reduce((s, o) => s + (o.discountPaise || 0), 0);
  const cgstPaise = orders.reduce((s, o) => s + (o.cgstPaise || 0), 0);
  const sgstPaise = orders.reduce((s, o) => s + (o.sgstPaise || 0), 0);
  const igstPaise = orders.reduce((s, o) => s + (o.igstPaise || 0), 0);
  const serviceChargePaise = orders.reduce((s, o) => s + (o.serviceChargePaise || 0), 0);
  const roundOffPaise = orders.reduce((s, o) => s + (o.roundOffPaise || 0), 0);
  const totalPaise = orders.reduce((s, o) => s + (o.totalPaise || 0), 0);
  const orderNumbers = orders.map((o) => o.number).join(', ');
  const tableLabel = orders[0]?.table?.label || '';
  const receiptConfig = readReceiptConfig(outlet?.settings);
  const upiConfig = readUpiConfig(outlet?.settings, outlet?.name || 'Cafe');

  const billPayload = {
    storeName: outlet?.name || 'Chaya Cafe',
    gstin: outlet?.gstin ?? undefined,
    address: typeof outlet?.address === 'string' ? outlet.address : undefined,
    orderNumber: orderNumbers,
    invoiceNumber: `BILL-${orderNumbers}`,
    table: tableLabel,
    waiter: staffName || session.name,
    cashier: session.name,
    station: waiterStation ?? undefined,
    customerName: orders[0]?.customer?.name ?? undefined,
    customerPhone: orders[0]?.customer?.phone ?? undefined,
    placedAt: orders[0]?.placedAt ? new Date(orders[0].placedAt).toISOString() : new Date().toISOString(),
    settledAt: new Date().toISOString(),
    items,
    subtotalPaise,
    discountPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    serviceChargePaise,
    roundOffPaise,
    totalPaise,
    isBillPreview: true,
    gstEnabled: (cgstPaise + sgstPaise + igstPaise > 0) || Boolean((outlet?.settings as any)?.gst?.enabled),
    receiptConfig,
    upiConfig,
  };

  // 6. Create print job & trigger batch worker
  const resolvedTenantId = outlet?.tenantId ?? session.tenantId ?? '00000000-0000-0000-0000-000000000000';
  const createdJob = await createPrintJob(prisma, {
    tenantId: resolvedTenantId,
    outletId: session.outletId,
    orderId: orders[0]?.id ?? null,
    printerId: targetPrinter?.id ?? null,
    stationId: waiterStation ?? undefined,
    jobType: PrintJobType.BILL_PREVIEW,
    payload: billPayload,
    priority: 2,
  });

  // Trigger LAN network direct printing (no browser popup!)
  processPrintQueueBatch().catch((err) => console.error('[PRINT] Print queue batch error:', err));

  return {
    ok: true,
    jobId: createdJob.id,
    printerName: targetPrinter?.name ?? null,
    station: waiterStation ?? null,
  };
}

/**
 * POST /api/tables/order
 *   { action: 'settle', tableId, method } — settle every running order on the table.
 *   { action: 'void_item', orderId, itemId } — void a single sent line: recompute
 *       the order bill, restore stock, audit, and refresh the KDS. If the order
 *       has no active items left it is cancelled (freeing the table).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'update_customer') {
    const { tableId, customer } = body;
    if (!tableId) return NextResponse.json({ error: 'missing_table' }, { status: 400 });
    let linkedCustId: string | null = null;
    if (customer && session.tenantId) {
      linkedCustId = await findOrCreateCustomerByPhone(session.tenantId, customer);
    }
    if (linkedCustId) {
      await prisma.order.updateMany({
        where: { tableId, outletId: session.outletId, status: { in: [...ACTIVE_STATUS] }, settledAt: null },
        data: { customerId: linkedCustId },
      });
    }
    return NextResponse.json({ ok: true, customerId: linkedCustId });
  }

  if (action === 'print_bill') {
    const { tableId, orderId, waiterStation, staffName, customer } = body;
    if (!tableId) return NextResponse.json({ error: 'missing_table' }, { status: 400 });

    // Link or create customer if provided with bill print
    if (customer && session.tenantId) {
      const linkedCustId = await findOrCreateCustomerByPhone(session.tenantId, customer);
      if (linkedCustId) {
        await prisma.order.updateMany({
          where: { tableId, outletId: session.outletId, status: { in: [...ACTIVE_STATUS] }, settledAt: null },
          data: { customerId: linkedCustId },
        });
      }
    }

    // 1. Direct Station Printing: Send bill directly to waiter's station printer (LAN ESC/POS, no browser popup)
    const printResult = await dispatchStationBillPrint(
      session,
      tableId,
      orderId,
      waiterStation,
      staffName
    );

    // 2. Free table on print bill
    await prisma.tableMap.update({
      where: { id: tableId },
      data: { state: 'free' },
    }).catch(() => {});

    await prisma.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'bill.printed',
        entity: 'table',
        entityId: tableId,
        after: { orderId: orderId ?? null, printResult } as Prisma.InputJsonValue,
      },
    }).catch(() => {});

    await publish(session.outletId, {
      type: 'table.updated',
      tableId,
      state: 'free',
    });

    return NextResponse.json({
      ok: true,
      state: 'free',
      billPrinted: true,
      printerName: printResult.printerName,
      station: printResult.station,
    });
  }

  if (action === 'void_item') {
    if (!canVoid(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return voidItem(session, body);
  }

  if (action === 'request_bill' || action === 'cancel_bill_request') {
    const { tableId, waiterStation, staffName } = body;
    if (!tableId) return NextResponse.json({ error: 'missing_table' }, { status: 400 });
    const targetState = action === 'request_bill' ? 'billed' : 'seated';

    let printResult: any = null;
    if (action === 'request_bill') {
      // Direct Station Printing: Send bill to waiter's station printer on bill request
      printResult = await dispatchStationBillPrint(
        session,
        tableId,
        null,
        waiterStation,
        staffName
      );
    }

    await prisma.tableMap.update({
      where: { id: tableId },
      data: { state: targetState },
    }).catch(() => {});

    await publish(session.outletId, {
      type: 'table.updated',
      tableId,
      state: targetState,
    });

    return NextResponse.json({
      ok: true,
      state: targetState,
      billPrinted: action === 'request_bill' ? printResult?.ok : undefined,
      printerName: printResult?.printerName,
      station: printResult?.station,
    });
  }

  // ---- settle ----
  if (!canSettle(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { tableId, method } = body;
  if (action !== 'settle' || !tableId) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const pay = (['cash', 'upi', 'card'] as const).includes(method) ? method : 'cash';

  const orders = await prisma.order.findMany({
    where: { tableId, outletId: session.outletId, status: { in: [...ACTIVE_STATUS] }, settledAt: null },
    select: { id: true, totalPaise: true, customerId: true },
  });
  if (orders.length === 0) return NextResponse.json({ error: 'nothing_to_settle' }, { status: 409 });

  // optional walk-in captured at the POS table panel → find-or-create the CRM
  // customer (tenant from the session), so their order history + loyalty attach.
  let customerId: string | null = null;
  if (body.customer && session.tenantId) {
    customerId = await findOrCreateCustomerByPhone(session.tenantId, body.customer);
  }
  // otherwise honour a customer attached when the order was placed (Send-to-KOT
  // captured them), so loyalty still accrues without re-entering at settle.
  if (!customerId) {
    customerId = orders.find((o) => o.customerId)?.customerId ?? null;
  }

  let total = 0;
  for (const o of orders) {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: { orderId: o.id, outletId: session.outletId, method: pay, amountPaise: o.totalPaise, status: 'success' },
      });
      return tx.order.update({
        where: { id: o.id },
        data: { status: 'settled', settledAt: new Date(), ...(customerId ? { customerId } : {}) },
        include: { items: true, table: { select: { label: true } } },
      });
    });
    total += o.totalPaise;
    await publish(session.outletId, { type: 'order.updated', ticket: toTicket(updated) });
  }

  // accrue loyalty ONCE on the combined table total (not per KOT) so a multi-order
  // table counts as a single visit with points on the full bill.
  if (customerId) {
    const pwa = await getOutletPwa(session.outletId);
    await prisma.$transaction((tx) =>
      accrueLoyaltyOnSettle(tx, { customerId: customerId!, outletId: session.outletId, totalPaise: total, pwa, refId: orders[0]!.id }),
    );
  }

  // Free the table in the database
  await prisma.tableMap.update({
    where: { id: tableId },
    data: { state: 'free' },
  }).catch(() => {});

  // Broadcast table.updated so all floor screens clear occupancy immediately
  await publish(session.outletId, {
    type: 'table.updated',
    tableId,
    state: 'free',
  });

  await prisma.auditLog.create({
    data: { outletId: session.outletId, actorId: session.staffId, action: 'table.settled', entity: 'table', entityId: tableId, after: { method: pay, totalPaise: total, orders: orders.length } as Prisma.InputJsonValue },
  }).catch(() => {});

  return NextResponse.json({ ok: true, settled: orders.length, totalPaise: total, method: pay });
}

/** Void one sent line from an order and recompute everything from the survivors. */
async function voidItem(session: { outletId: string; staffId: string | null }, body: { orderId?: string; itemId?: string }) {
  const { orderId, itemId } = body;
  if (!orderId || !itemId) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, outletId: session.outletId, status: { in: [...ACTIVE_STATUS] }, settledAt: null },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });

  const target = order.items.find((i) => i.id === itemId && i.kotStatus !== 'void');
  if (!target) return NextResponse.json({ error: 'item_not_found' }, { status: 404 });

  // survivors = active lines after this void
  const survivors = order.items.filter((i) => i.id !== itemId && i.kotStatus !== 'void');

  // GST rate isn't snapshotted on OrderItem → source it from the menu item
  const itemIds = survivors.map((s) => s.itemId).filter((id): id is string => !!id);
  const gstByItem = new Map<string, number>();
  if (itemIds.length) {
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, gstRate: true } });
    for (const m of menuItems) gstByItem.set(m.id, Number(m.gstRate));
  }

  const billLines: BillLine[] = survivors.map((s) => ({
    pricePaise: s.unitPricePaise,
    modPaise: Array.isArray(s.modifiers) ? (s.modifiers as { pricePaise: number }[]).reduce((sum, m) => sum + (m.pricePaise ?? 0), 0) : 0,
    gstRate: (s.itemId && gstByItem.get(s.itemId)) || 0,
    qty: s.qty,
  }));

  // preserve the order's original discount / service-charge / inter-state shape
  const taxableBase = order.subtotalPaise - order.discountPaise;
  const discountPct = order.subtotalPaise > 0 ? (order.discountPaise / order.subtotalPaise) * 100 : 0;
  const serviceChargePct = taxableBase > 0 ? (order.serviceChargePaise / taxableBase) * 100 : 0;
  const interState = order.igstPaise > 0;
  const gst = await getOutletGst(order.outletId);
  const bill = computeBill(billLines, { discountPct, serviceChargePct, interState, ...gstBillOptions(gst) });

  const noneLeft = survivors.length === 0;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({ where: { id: itemId }, data: { kotStatus: 'void' } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotalPaise: bill.subtotalPaise,
        discountPaise: bill.discountPaise,
        cgstPaise: bill.cgstPaise,
        sgstPaise: bill.sgstPaise,
        igstPaise: bill.igstPaise,
        serviceChargePaise: bill.serviceChargePaise,
        roundOffPaise: bill.roundOffPaise,
        totalPaise: bill.totalPaise,
        ...(noneLeft ? { status: 'cancelled' } : {}),
      },
    });
    // restore the raw materials this line had consumed
    await reverseRecipeConsumption(tx, { outletId: session.outletId, orderId, lines: [{ itemId: target.itemId, qty: target.qty }] });
    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { where: { kotStatus: { not: 'void' } } }, table: { select: { label: true } } },
    });
  });

  await prisma.auditLog.create({
    data: {
      outletId: session.outletId, actorId: session.staffId, action: 'order.item_voided', entity: 'order_item', entityId: itemId,
      after: { orderId, name: target.nameSnapshot, qty: target.qty, cancelled: noneLeft } as Prisma.InputJsonValue,
    },
  }).catch(() => {});

  // refresh the KDS — ticket without the voided line, or gone if cancelled
  await publish(session.outletId, { type: 'order.updated', ticket: toTicket(updated) });

  return NextResponse.json({ ok: true, cancelled: noneLeft, totalPaise: updated.totalPaise });
}
