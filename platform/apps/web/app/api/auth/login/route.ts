import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@cafeos/db';
import { startStaffSession } from '@/lib/staff-session';
import { resolveTenantIdFromHost } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

/**
 * POST /api/auth/login — staff PIN login (fast POS auth).
 * Matches the sha256(pin) against staff_users.pinHash for an active staff member,
 * issues a 12h session cookie. Generic error on failure (no user enumeration).
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_pin_format' }, { status: 400 });

  const pinHash = createHash('sha256').update(parsed.data.pin).digest('hex');

  // Scope the PIN lookup to the tenant for this host (kaava.chayaone.com → that
  // tenant). PINs are only unique within a tenant, so a global lookup would
  // collide across cafes. When the host resolves no tenant (e.g. local dev
  // without DEV_TENANT_SUBDOMAIN) we fall back to a global lookup for convenience.
  const tenantId = await resolveTenantIdFromHost(req.headers.get('host'));

  const staff = await prisma.staffUser.findFirst({
    where: { pinHash, active: true, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, name: true, role: true, tenantId: true, outletId: true },
  });

  if (!staff || !staff.outletId) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  // The PIN pad must never log in owners/managers. Owners/managers sign in
  // with username + password (via tapping the logo). Any PIN attempt for an owner/manager
  // is treated as an invalid PIN.
  if (staff.role === 'owner' || staff.role === 'manager') {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, staff: { name: staff.name, role: staff.role } });
  // Start a persistent device session (short access cookie + 30d refresh cookie).
  await startStaffSession(
    res,
    { id: staff.id, name: staff.name, role: staff.role, tenantId: staff.tenantId, outletId: staff.outletId },
    req.headers.get('user-agent'),
  );
  return res;
}
