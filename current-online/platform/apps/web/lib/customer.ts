import { cookies, headers } from 'next/headers';
import { prisma, type Prisma } from '@cafeos/db';
import { resolveTenantIdFromHost } from './tenant';
import { CUSTOMER_COOKIE, verifyCustomerSession } from './customer-auth';
import { hashPhone, normalizePhone, isValidPhone } from './phone';
import { assertSlot, bumpUsage, SlotExceeded } from './limits';
import type { PwaConfig } from './pwa';

/**
 * Customer identity for the PWA.
 *
 * Phase 2: the `cafeos_cust` cookie is now a signed session (see
 * `lib/customer-auth.ts`) issued by phone-OTP login — a raw UUID can no longer
 * impersonate a customer. When no valid session is present we still fall back to
 * the tenant's demo customer so loyalty/rewards/spin remain demonstrable for
 * guests who haven't logged in (and the app works unchanged when the owner has
 * registration disabled).
 */
export { CUSTOMER_COOKIE };

/**
 * Resolve the current customer + whether they are authenticated.
 * `authenticated` is true only for a valid signed session; the demo fallback is
 * never reported as authenticated (drives the registration gate honestly).
 */
export async function resolveCustomer(tenantId: string): Promise<{ id: string | null; authenticated: boolean }> {
  const token = cookies().get(CUSTOMER_COOKIE)?.value;
  if (token) {
    const session = await verifyCustomerSession(token);
    if (session && session.tid === tenantId) {
      const ok = await prisma.customer.findFirst({ where: { id: session.sub, tenantId }, select: { id: true } });
      if (ok) return { id: ok.id, authenticated: true };
    }
  }
  const demo = await prisma.customer.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  return { id: demo?.id ?? null, authenticated: false };
}

/** Resolve the current customer id (session if valid, else the demo customer). */
export async function resolveCustomerId(tenantId: string): Promise<string | null> {
  return (await resolveCustomer(tenantId)).id;
}

/** Resolve a table + its outlet/tenant from a scanned QR token (or a tenant-scoped fallback for the demo). */
export async function resolveTable(qrToken?: string | null) {
  if (qrToken) {
    const t = await prisma.tableMap.findUnique({
      where: { qrToken },
      include: { outlet: { select: { id: true, name: true, tenantId: true } } },
    });
    if (t) return t;
  }
  // No valid token: fall back within the host's tenant — never across tenants
  // (the previous global lookup could return another cafe's table).
  let tenantId = await resolveTenantIdFromHost(headers().get('host'));
  if (!tenantId) {
    // Single-tenant deployment (e.g. the Railway URL carries no tenant subdomain
    // and DEV_TENANT_SUBDOMAIN isn't set): use the only tenant. This mirrors the
    // PIN-login convenience fallback (app/api/auth/login/route.ts). Safe — with
    // exactly one tenant there's no cross-tenant ambiguity; with several we must
    // not guess, so bail rather than risk leaking another cafe's table.
    const tenants = await prisma.tenant.findMany({ select: { id: true }, take: 2 });
    if (tenants.length !== 1) return null;
    tenantId = tenants[0]!.id;
  }
  const recent = await prisma.order.findFirst({
    where: { status: { in: ['open', 'in_kitchen', 'ready'] }, tableId: { not: null }, outlet: { tenantId } },
    orderBy: { placedAt: 'desc' },
    select: { tableId: true },
  });
  // Prefer the tenant's most recent live order's table; otherwise any table for
  // the tenant (was hard-coded 'T6', which broke when no such table existed).
  const where = recent?.tableId ? { id: recent.tableId } : { outlet: { tenantId } };
  return prisma.tableMap.findFirst({
    where,
    orderBy: { label: 'asc' },
    include: { outlet: { select: { id: true, name: true, tenantId: true } } },
  });
}

/** The active order for a table (what the customer is waiting on), if any. */
export async function activeOrderForTable(tableId: string) {
  return prisma.order.findFirst({
    // includes the QR approval states so a just-placed order is visible to the guest
    where: { tableId, status: { in: ['pending_approval', 'approved', 'open', 'in_kitchen', 'ready', 'served'] } },
    orderBy: { placedAt: 'desc' },
    include: { items: { select: { nameSnapshot: true, qty: true, station: true } }, table: { select: { label: true } } },
  });
}

/**
 * Find-or-create a tenant customer from a phone (+ optional name) captured at the
 * POS, so a walk-in reaches the CRM. Deduped on `(tenantId, phoneHash)`; an
 * existing profile has its name (when supplied) and `lastVisit` refreshed.
 *
 * Deliberately non-blocking, unlike `customer/register` (which returns 402 on the
 * cap): a valid but capped/invalid phone returns null so the POS still completes
 * the sale. Returns the customer id, or null when no CRM row was created/linked
 * (invalid phone, or the tenant's customer slot is exhausted).
 */
export async function findOrCreateCustomerByPhone(
  tenantId: string,
  input: { name?: string | null; phone?: string | null },
): Promise<string | null> {
  const phone = normalizePhone(String(input?.phone ?? ''));
  if (!isValidPhone(phone)) return null; // name-only / junk → prints only, no CRM row
  const phoneHash = hashPhone(phone);
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 60) : null;

  const existing = await prisma.customer.findFirst({ where: { tenantId, phoneHash }, select: { id: true, name: true } });
  if (existing) {
    await prisma.customer.update({
      where: { id: existing.id },
      // keep an existing name unless the walk-in provides a new one
      data: { name: name || existing.name || undefined, phone, lastVisit: new Date() },
    });
    return existing.id;
  }

  // slot enforcement (G6): a capped tenant simply stops gaining new CRM rows —
  // it must never fail an in-progress sale, so swallow the cap and return null.
  try {
    await assertSlot(tenantId, 'customers');
  } catch (e) {
    if (e instanceof SlotExceeded) return null;
    throw e;
  }
  const now = new Date();
  const created = await prisma.customer.create({
    data: { tenantId, name, phone, phoneHash, source: 'manual', firstVisit: now, lastVisit: now },
    select: { id: true },
  });
  await bumpUsage(tenantId, 'customers').catch(() => {});
  return created.id;
}

/**
 * Award loyalty for one settled bill (configurable earn rate + optional first-order
 * bonus), appending a single `earn` ledger row and bumping the customer's
 * points/spend/visit aggregates. Call ONCE per settle — passing the combined table
 * total — so a multi-KOT table counts as one visit, not one per KOT. Must run
 * inside a transaction (shared by the order-create and table-settle paths).
 */
export async function accrueLoyaltyOnSettle(
  tx: Prisma.TransactionClient,
  args: { customerId: string; outletId: string; totalPaise: number; pwa: PwaConfig; refId: string },
): Promise<void> {
  const { customerId, outletId, totalPaise, pwa, refId } = args;
  const rate = pwa.points.earnRatePaisePerPoint; // paise per earned point
  let points = Math.floor(totalPaise / rate);
  const prior = await tx.customer.findUnique({ where: { id: customerId }, select: { visitCount: true } });
  if ((!prior || prior.visitCount === 0) && pwa.loyalty.rewards.firstOrderBonus > 0) {
    points += pwa.loyalty.rewards.firstOrderBonus;
  }
  await tx.loyaltyLedger.create({
    data: { customerId, outletId, type: 'earn', points, source: 'order', refId },
  });
  await tx.customer.update({
    where: { id: customerId },
    data: {
      points: { increment: points },
      lifetimeSpendPaise: { increment: totalPaise },
      visitCount: { increment: 1 },
      lastVisit: new Date(),
    },
  });
}
