import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { CreateOrderSchema, computeBill, type BillLine } from '@cafeos/core';
import { getSession } from '@/lib/auth';
import { publish, toTicket } from '@/lib/realtime';
import { createOutboxEntry } from '@/lib/outbox';
import { createPrintJob, processPrintQueueBatch } from '@/lib/print/manager';
import { routeOrderToStations } from '@/lib/print/router';
import { readKitchenWorkflow } from '@/lib/kitchenWorkflow';
import { applyRecipeConsumption, emitLowStockAlerts } from '@/lib/inventory';
import { alertLargeDiscount } from '@/lib/alerts';
import { getOutletGst, gstBillOptions } from '@/lib/tax';
import { getOutletPwa } from '@/lib/pwa';
import { findOrCreateCustomerByPhone, accrueLoyaltyOnSettle } from '@/lib/customer';
import { assertSlot, bumpUsage, SlotExceeded } from '@/lib/limits';
import { tenantBilling } from '@/lib/billing';
import { getOutletLocation, checkGeofence, readGeoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/orders
 * Create an order. Idempotent on clientUuid (safe to replay from the offline
 * outbox). Computes the bill server-side (never trust client totals), writes
 * order + items + KOTs, and — if `payment` is present — settles in one
 * transaction. Returns the canonical order.
 */
export async function POST(req: NextRequest) {
  const parsed = CreateOrderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // identity comes from the SESSION, never the request body (no spoofing staff/outlet).
  // body staffId/outletId are only honoured for trusted server/offline replays without a session.
  const session = await getSession();
  const staffId = session?.staffId ?? input.staffId ?? null;
  const outletId = session?.outletId ?? input.outletId;

  // idempotency: if we've already seen this clientUuid, return the stored order
  const existing = await prisma.order.findUnique({
    where: { clientUuid: input.clientUuid },
    include: { items: true, payments: true },
  });
  if (existing) return NextResponse.json({ order: existing, idempotent: true });

  // location gate (POS): a signed-in, non-owner staffer must be at the cafe.
  // Lenient — a missing GPS fix is allowed; only a confirmed out-of-range
  // position is refused. Sessionless trusted replays (offline outbox) skip this,
  // and the owner is always exempt.
  if (session && session.role !== 'owner') {
    const loc = await getOutletLocation(outletId);
    if (loc.enabled && loc.gatePosOrders && loc.lat !== null) {
      const fence = checkGeofence(loc, readGeoFromHeaders(req.headers), { strict: false });
      if (!fence.ok) return NextResponse.json({ error: 'out_of_range', radiusM: fence.radiusM, distanceM: fence.distanceM }, { status: 403 });
    }
  }

  // slot enforcement (G6): meter session-bound orders against the monthly quota.
  // Sessionless trusted replays are not metered (already-counted offline orders).
  const meterTenantId = session?.tenantId ?? null;
  if (meterTenantId) {
    // billing wall (G7): a suspended/expired tenant cannot take new orders
    const billing = await tenantBilling(meterTenantId);
    if (billing.blocked) return NextResponse.json({ error: 'tenant_suspended', reason: billing.reason }, { status: 403 });
    try {
      await assertSlot(meterTenantId, 'orders_month');
    } catch (e) {
      if (e instanceof SlotExceeded) {
        return NextResponse.json({ error: 'slot_exceeded', metric: e.metric, limit: e.limit, upsell: true }, { status: 402 });
      }
      throw e;
    }
  }

  // --- authoritative bill (server recomputes; client total is ignored) ---
  const itemIds = input.lines.map((l) => l.itemId);
  const dbItems = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, outletId },
    include: { category: true },
  });
  const dbItemMap = new Map(dbItems.map((i) => [i.id, i]));

  const billLines: BillLine[] = input.lines.map((l) => {
    const dbItem = dbItemMap.get(l.itemId);
    const catName = dbItem?.category?.name?.toLowerCase() ?? '';
    let categoryType = 'food';
    if (
      catName.includes('beverage') ||
      catName.includes('drink') ||
      catName.includes('juice') ||
      catName.includes('coffee') ||
      catName.includes('tea') ||
      catName.includes('soda')
    ) {
      categoryType = 'beverage';
    } else if (catName.includes('combo') || catName.includes('meal')) {
      categoryType = 'combo';
    }

    const tags = dbItem?.tags ?? [];
    const taxExempt = tags.includes('tax_exempt') || tags.includes('taxexempt');
    const zeroRated = tags.includes('zero_rated') || tags.includes('zerorated');
    const nilRated = tags.includes('nil_rated') || tags.includes('nilrated');

    return {
      pricePaise: l.unitPricePaise,
      modPaise: (l.modifiers ?? []).reduce((s, m) => s + m.pricePaise, 0),
      gstRate: dbItem ? Number(dbItem.gstRate) : l.gstRate,
      qty: l.qty,
      categoryType,
      taxExempt,
      zeroRated,
      nilRated,
      hsnCode: dbItem?.hsnCode ?? null,
    };
  });

  const gst = await getOutletGst(outletId);
  const pwa = await getOutletPwa(outletId);

  // resolve the customer for loyalty/CRM: an explicit customerId (QR/PWA) wins;
  // otherwise find-or-create from a walk-in phone captured at the POS. Tenant
  // comes from the session only — never a client-sent value.
  let customerId = input.customerId ?? null;
  if (!customerId && input.customer && session?.tenantId) {
    customerId = await findOrCreateCustomerByPhone(session.tenantId, input.customer);
  }

  // Automatically detect interstate supply
  let interState = !!input.interState;
  if (!interState && customerId) {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { stateCode: true },
    });
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { address: true },
    });
    if (outlet?.stateCode && customer?.address) {
      const custAddrLower = customer.address.toLowerCase();
      const states = ["AN", "AP", "AR", "AS", "BR", "CH", "CT", "DN", "DD", "DL", "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB"];
      const matchState = states.find(
        (s) =>
          custAddrLower.includes(` ${s.toLowerCase()}`) ||
          custAddrLower.includes(`,${s.toLowerCase()}`) ||
          custAddrLower.includes(s.toLowerCase()),
      );
      if (matchState && matchState.toUpperCase() !== outlet.stateCode.toUpperCase()) {
        interState = true;
      }
    }
  }

  const bill = computeBill(billLines, {
    discountPct: input.discountPct,
    discountFlatPaise: input.discountFlatPaise,
    serviceChargePct: input.serviceChargePct,
    deliveryChargePaise: input.deliveryChargePaise,
    packagingChargePaise: input.packagingChargePaise,
    convenienceFeePaise: input.convenienceFeePaise,
    interState: interState,
    ...gstBillOptions(gst, input.type),
  });

  const settling = !!input.payment;
  const number = await nextNumber(outletId);
  // stock items consumed by this order's recipes (captured in-tx, alerted post-commit)
  let consumedStockIds: string[] = [];

  // stations needing a KOT
  const stations = Array.from(
    new Set(input.lines.map((l) => l.station).filter((s): s is string => !!s)),
  );

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientUuid: input.clientUuid,
          number,
          outletId,
          tableId: input.tableId ?? null,
          customerId,
          staffId,
          type: input.type,
          // kitchen lifecycle is independent of payment: a paid-upfront takeaway
          // still has to be made, so every new order enters the KDS queue.
          status: 'in_kitchen',
          subtotalPaise: bill.subtotalPaise,
          discountPaise: bill.discountPaise,
          cgstPaise: bill.cgstPaise,
          sgstPaise: bill.sgstPaise,
          igstPaise: bill.igstPaise,
          serviceChargePaise: bill.serviceChargePaise,
          roundOffPaise: bill.roundOffPaise,
          totalPaise: bill.totalPaise,
          settledAt: settling ? new Date() : null,
          items: {
            create: [
              ...input.lines.map((l) => ({
                itemId: l.itemId,
                nameSnapshot: l.nameSnapshot,
                qty: l.qty,
                unitPricePaise: l.unitPricePaise,
                modifiers: (l.modifiers ?? []) as Prisma.InputJsonValue,
                notes: l.notes,
                station: l.station ?? null,
                kotStatus: 'queued' as any,
              })),
              ...(input.deliveryChargePaise > 0
                ? [
                    {
                      itemId: null,
                      nameSnapshot: 'Delivery Charge',
                      qty: 1,
                      unitPricePaise: input.deliveryChargePaise,
                      modifiers: [] as any,
                      notes: null,
                      station: null,
                      kotStatus: 'served' as any,
                    },
                  ]
                : []),
              ...(input.packagingChargePaise > 0
                ? [
                    {
                      itemId: null,
                      nameSnapshot: 'Packaging Charge',
                      qty: 1,
                      unitPricePaise: input.packagingChargePaise,
                      modifiers: [] as any,
                      notes: null,
                      station: null,
                      kotStatus: 'served' as any,
                    },
                  ]
                : []),
              ...(input.convenienceFeePaise > 0
                ? [
                    {
                      itemId: null,
                      nameSnapshot: 'Convenience Fee',
                      qty: 1,
                      unitPricePaise: input.convenienceFeePaise,
                      modifiers: [] as any,
                      notes: null,
                      station: null,
                      kotStatus: 'served' as any,
                    },
                  ]
                : []),
            ],
          },
          kots: {
            create: stations.map((station, idx) => ({
              outletId,
              station,
              number: number * 10 + idx,
              status: 'queued',
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Decrement any daily limits stored in tags
      for (const line of input.lines) {
        if (!line.itemId) continue;
        const menuItem = await tx.menuItem.findFirst({
          where: { id: line.itemId, outletId },
          select: { id: true, tags: true, isAvailable: true }
        });
        if (menuItem) {
          const limitTag = menuItem.tags.find((t) => t.startsWith('limit:'));
          if (limitTag) {
            const currentLimit = parseInt(limitTag.split(':')[1] ?? '0') || 0;
            const newLimit = Math.max(0, currentLimit - line.qty);
            const otherTags = menuItem.tags.filter((t) => !t.startsWith('limit:'));
            const nextTags = [...otherTags, `limit:${newLimit}`];
            const isAvailable = newLimit > 0;
            await tx.menuItem.update({
              where: { id: menuItem.id },
              data: {
                tags: nextTags,
                isAvailable: isAvailable ? menuItem.isAvailable : false
              }
            });
          }
        }
      }

      if (input.payment) {
        await tx.payment.create({
          data: {
            orderId: created.id,
            outletId,
            method: input.payment.method,
            amountPaise: input.payment.amountPaise,
            status: 'success',
            providerRef: input.payment.providerRef,
            meta: { tipPaise: input.payment.tipPaise } as Prisma.InputJsonValue,
          },
        });

        // loyalty: configurable earn rate (default 1pt per ₹10) + optional first-order bonus,
        // on settle (append-only ledger). Defaults preserve the original behaviour exactly.
        if (customerId) {
          await accrueLoyaltyOnSettle(tx, { customerId, outletId, totalPaise: bill.totalPaise, pwa, refId: created.id });
        }
      }

      // recipe-based inventory: deduct raw materials + append the stock ledger,
      // atomically with the order. No-ops for items without a recipe.
      consumedStockIds = await applyRecipeConsumption(tx, {
        outletId,
        orderId: created.id,
        lines: input.lines.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      });

      // Step 5: Write outbox event atomically with the business transaction
      let resolvedTenantId = session?.tenantId;
      if (!resolvedTenantId) {
        const outletObj = await tx.outlet.findUnique({
          where: { id: outletId },
          select: { tenantId: true },
        });
        resolvedTenantId = outletObj?.tenantId ?? '00000000-0000-0000-0000-000000000000';
      }

      await createOutboxEntry(tx, {
        tenantId: resolvedTenantId,
        outletId,
        eventId: input.clientUuid,
        entityType: 'Order',
        entityId: created.id,
        operation: 'CREATE',
        causalGroup: `order:${created.id}`,
        payload: {
          order: created,
          bill,
          settling,
        },
      });

      // Step 6: Create PrintJob records for KOT station printers atomically
      const outletRecord = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { settings: true },
      });
      const kw = readKitchenWorkflow(outletRecord?.settings);
      
      if (kw.autoPrintKot || kw.mode !== 'digital') {
        const routedJobs = routeOrderToStations(
          {
            id: created.id,
            number,
            table: { label: input.tableId ? 'Table' : '' },
            type: input.type,
            placedAt: created.placedAt,
            items: created.items,
          },
          outletRecord?.settings,
        );

        for (const job of routedJobs) {
          await createPrintJob(tx, {
            tenantId: resolvedTenantId,
            outletId,
            jobId: `${created.id}-${job.stationId}`,
            orderId: created.id,
            printerId: job.targetDevice?.id ?? null,
            stationId: job.stationId,
            jobType: 'KOT' as any,
            payload: job.payload,
          });
        }
      }

      return created;
    });

    // Step 6: Trigger background print queue processing (non-blocking)
    processPrintQueueBatch().catch(() => {});

    // meter the committed order against the tenant's monthly quota (best effort)
    if (meterTenantId) await bumpUsage(meterTenantId, 'orders_month').catch(() => {});

    // fan out to every KDS subscribed to this outlet
    await publish(outletId, { type: 'order.new', ticket: toTicket(order) });
    // raise low-stock alerts for anything that dipped below reorder (best effort)
    await emitLowStockAlerts(outletId, consumedStockIds);
    // owner alert: unusually large discount on this ticket (percent OR flat ₹ —
    // derive an effective % from the applied amount so the threshold still fires)
    if (bill.discountPaise > 0) {
      const effPct = bill.subtotalPaise > 0 ? Math.round((bill.discountPaise / bill.subtotalPaise) * 100) : 0;
      await alertLargeDiscount(outletId, { number: order.number, discountPct: effPct, discountPaise: bill.discountPaise });
    }
    return NextResponse.json({ order, bill }, { status: 201 });
  } catch (e) {
    // unique violation on clientUuid race → fetch and return idempotently
    const again = await prisma.order.findUnique({ where: { clientUuid: input.clientUuid }, include: { items: true } });
    if (again) return NextResponse.json({ order: again, idempotent: true });
    console.error('order create failed', e);
    return NextResponse.json({ error: 'order_create_failed' }, { status: 500 });
  }
}

/** GET /api/orders?status=in_kitchen — used by the KDS (Phase 1b). */
export async function GET(req: NextRequest) {
  // scope to the caller's outlet — the queue must never surface another outlet's
  // tickets (they'd also 404 on settle, looking permanently stuck as active).
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') as
    | 'open' | 'in_kitchen' | 'ready' | 'served' | 'settled' | 'cancelled' | null;
  const orders = await prisma.order.findMany({
    where: { outletId: session.outletId, ...(status ? { status } : {}) },
    orderBy: { placedAt: 'desc' },
    take: 50,
    include: { items: true, table: true, customer: true },
  });
  return NextResponse.json({ orders });
}

async function nextNumber(outletId: string): Promise<number> {
  const last = await prisma.order.findFirst({ where: { outletId }, orderBy: { number: 'desc' }, select: { number: true } });
  return (last?.number ?? 100) + 1;
}
