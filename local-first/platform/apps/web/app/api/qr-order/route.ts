import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, type Prisma, OrderChannel, OrderType } from '@cafeos/db';
import { resolveTable, resolveCustomerId } from '@/lib/customer';
import { createNotification } from '@/lib/notify';
import { getOutletPwa, walletPointsToPaise, paiseToPoints } from '@/lib/pwa';
import { tenantBilling } from '@/lib/billing';
import { getOutletLocation, checkGeofence, readGeoFromHeaders } from '@/lib/geo';
import { requireModule } from '@/lib/modules';
import { OrderService } from '@/lib/services/order.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/qr-order — PUBLIC customer ordering from the table QR.
 *
 * Unlike the POS route, a QR order does NOT go straight to the kitchen. It is
 * created as `pending_approval` (channel = qr) and a waiter must approve it
 * (see /api/approvals) before any KOT is cut or stock is consumed. Prices are
 * recomputed server-side from the menu — the client only sends item ids + qty.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'empty_order' }, { status: 400 });
  }

  const table = await resolveTable(body.t ?? null);
  if (!table) return NextResponse.json({ error: 'table_not_found' }, { status: 404 });
  const outletId = table.outlet.id;
  const tenantId = table.outlet.tenantId;

  // Module check: Customer QR Ordering must be enabled
  const guard = await requireModule('customer_qr', outletId);
  if (!guard.ok) return guard.response!;

  // billing wall (G7): suspended/expired tenants can't accept QR orders
  const billing = await tenantBilling(tenantId);
  if (billing.blocked) return NextResponse.json({ error: 'tenant_suspended' }, { status: 403 });

  // location gate: the customer must be at the cafe (lenient — a missing GPS fix
  // is allowed; only a position GPS confirms is out of range is refused).
  const loc = await getOutletLocation(outletId);
  if (loc.enabled && loc.gateQrOrders && loc.lat !== null) {
    const fence = checkGeofence(loc, readGeoFromHeaders(req.headers), { strict: false });
    if (!fence.ok) return NextResponse.json({ error: 'out_of_range', radiusM: fence.radiusM, distanceM: fence.distanceM }, { status: 403 });
  }

  // resolve requested items from the DB (never trust client prices)
  const wanted = new Map<string, number>();
  for (const l of body.lines) {
    const id = String(l.itemId ?? '');
    const qty = Math.max(0, Math.min(99, Math.floor(Number(l.qty ?? 0))));
    if (id && qty > 0) wanted.set(id, (wanted.get(id) ?? 0) + qty);
  }
  if (wanted.size === 0) return NextResponse.json({ error: 'empty_order' }, { status: 400 });

  const items = await prisma.menuItem.findMany({
    where: { id: { in: [...wanted.keys()] }, outletId, isAvailable: true },
  });
  if (items.length === 0) return NextResponse.json({ error: 'no_valid_items' }, { status: 400 });

  const customerId = await resolveCustomerId(tenantId);
  const subtotal = items.reduce((s, it) => s + it.pricePaise * wanted.get(it.id)!, 0);

  // Optional wallet redemption: spend points as a ₹ discount. computeBill only
  // takes a percentage, so we convert the clamped ₹ amount into an equivalent
  // discountPct (its pro-rata distribution keeps per-line tax correct). The
  // points are a PROVISIONAL hold — burned now, reversed if the order is
  // cancelled/rejected (lib/wallet.ts). Defaults (wallet off) = no change.
  const pwaCfg = await getOutletPwa(outletId);
  let walletPointsUsed = 0;
  let walletDiscountPaise = 0;
  if (pwaCfg.wallet.enabled && customerId && Number(body.walletPoints) > 0) {
    const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { points: true } });
    const have = cust?.points ?? 0;
    const maxByBill = paiseToPoints(Math.floor((subtotal * pwaCfg.wallet.maxRedeemPctOfBill) / 100), pwaCfg);
    let use = Math.max(0, Math.min(Math.floor(Number(body.walletPoints)), have, maxByBill));
    if (use < pwaCfg.wallet.minPointsToRedeem) use = 0;
    if (use > 0) {
      walletDiscountPaise = Math.min(subtotal, walletPointsToPaise(use, pwaCfg));
      walletPointsUsed = use;
    }
  }
  const discountPct = subtotal > 0 && walletDiscountPaise > 0 ? (walletDiscountPaise / subtotal) * 100 : 0;

  const clientUuid = (typeof body.clientUuid === 'string' && body.clientUuid) || crypto.randomUUID();

  // Create order via domain service
  const orderLines = items.map((it) => ({
    itemId: it.id,
    nameSnapshot: it.name,
    qty: wanted.get(it.id)!,
    unitPricePaise: it.pricePaise,
    gstRate: Number(it.gstRate),
    modifiers: [],
    station: it.station ?? null,
    notes: typeof body.note === 'string' ? body.note.slice(0, 280) : undefined,
  }));

  const result = await OrderService.createOrder({
    input: {
      clientUuid,
      outletId,
      type: OrderType.dine_in,
      tableId: table.id,
      customerId,
      lines: orderLines,
      discountPct,
      discountFlatPaise: walletDiscountPaise,
      serviceChargePct: 0,
      deliveryChargePaise: 0,
      packagingChargePaise: 0,
      convenienceFeePaise: 0,
      interState: false,
    },
    sessionStaffId: null,
    outletId,
    tenantId,
    channel: OrderChannel.qr,
  });

  if (result.idempotent) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      order: {
        id: result.order.id,
        number: result.order.number,
        status: result.order.status,
        totalPaise: result.order.totalPaise,
        discountPaise: result.order.discountPaise,
        walletPointsUsed: 0,
      },
    });
  }

  // burn the held points atomically (re-check balance to avoid overspend)
  if (walletPointsUsed > 0 && customerId) {
    const fresh = await prisma.customer.findUnique({ where: { id: customerId }, select: { points: true } });
    if ((fresh?.points ?? 0) >= walletPointsUsed) {
      await prisma.$transaction([
        prisma.customer.update({ where: { id: customerId }, data: { points: { decrement: walletPointsUsed } } }),
        prisma.loyaltyLedger.create({
          data: {
            customerId,
            outletId,
            type: 'burn',
            points: walletPointsUsed,
            source: 'wallet',
            refId: result.order.id,
          },
        }),
      ]);
    }
  }

  // notify the approval dashboard + write the audit trail
  await createNotification({
    outletId,
    type: 'qr_order',
    severity: 'info',
    title: `New QR order #${result.order.number}`,
    body: `Table ${table.label} · ${orderLines.reduce((s, l) => s + l.qty, 0)} items · awaiting approval`,
    entity: 'order',
    entityId: result.order.id,
    meta: { number: result.order.number, totalPaise: result.order.totalPaise } as Prisma.InputJsonValue,
  });

  return NextResponse.json({
    ok: true,
    order: {
      id: result.order.id,
      number: result.order.number,
      status: result.order.status,
      totalPaise: result.order.totalPaise,
      discountPaise: result.order.discountPaise,
      walletPointsUsed,
    },
  }, { status: 201 });
}
