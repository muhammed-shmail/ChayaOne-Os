import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@cafeos/db';
import { startStaffSession } from '@/lib/staff-session';
import { verifyPassword } from '@/lib/platform-crypto';
import { resolveTenantIdFromHost } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  username: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

/**
 * POST /api/auth/login/password — staff username + password login.
 * A more secure alternative to the PIN pad for roles that reach the dashboard.
 * Verifies scrypt(password) against staff_users.passwordHash for an active staff
 * member (scoped to the host's tenant), then issues the same 12h session cookie
 * used by PIN login. Generic error on failure (no user enumeration).
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  // Usernames are stored lowercase so login is case-insensitive.
  const username = parsed.data.username.toLowerCase();
  const tenantId = await resolveTenantIdFromHost(req.headers.get('host'));

  const staff = await prisma.staffUser.findFirst({
    where: { username, active: true, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, name: true, role: true, tenantId: true, outletId: true, passwordHash: true },
  });

  if (!staff || !staff.outletId || !staff.passwordHash || !verifyPassword(parsed.data.password, staff.passwordHash)) {
    // small constant-ish delay to blunt brute force; real build adds Redis rate-limit
    await new Promise((r) => setTimeout(r, 350));
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
