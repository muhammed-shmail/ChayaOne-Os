import { NextRequest, NextResponse } from 'next/server';
import { prisma, OrderChannel } from '@cafeos/db';
import { CreateOrderSchema } from '@cafeos/core';
import { getSession } from '@/lib/auth';
import { assertSlot, bumpUsage, SlotExceeded } from '@/lib/limits';
import { tenantBilling } from '@/lib/billing';
import { getOutletLocation, checkGeofence, readGeoFromHeaders } from '@/lib/geo';
import { OrderService } from '@/lib/services/order.service';

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

  try {
    const result = await OrderService.createOrder({
      input,
      sessionStaffId: staffId,
      sessionStaffName: session?.name ?? null,
      sessionStaffRole: session?.role ?? null,
      outletId,
      tenantId: session?.tenantId,
      channel: OrderChannel.pos,
    });

    if (result.idempotent) {
      return NextResponse.json({ order: result.order, idempotent: true });
    }

    // meter the committed order against the tenant's monthly quota (best effort)
    if (meterTenantId) {
      await bumpUsage(meterTenantId, 'orders_month').catch(() => {});
    }

    return NextResponse.json({ order: result.order, bill: result.bill }, { status: 201 });
  } catch (e: any) {
    // unique violation on clientUuid race → fetch and return idempotently
    const again = await prisma.order.findUnique({
      where: { clientUuid: input.clientUuid },
      include: { items: true, payments: true },
    });
    if (again) return NextResponse.json({ order: again, idempotent: true });

    console.error('order create failed', e);
    return NextResponse.json({ error: 'order_create_failed', message: e?.message }, { status: 500 });
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
