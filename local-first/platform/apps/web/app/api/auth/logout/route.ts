import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { verifyRefresh, REFRESH_COOKIE } from '@/lib/auth';
import { clearAuthCookies } from '@/lib/staff-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revoke this device's session row (so its refresh token can't roll forward). */
async function revokeCurrent(req: NextRequest) {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  const parsed = token ? await verifyRefresh(token) : null;
  if (!parsed) return;
  await prisma.staffSession
    .updateMany({ where: { id: parsed.sid, revokedAt: null }, data: { revokedAt: new Date() } })
    .catch(() => {});
}

/** POST /api/auth/logout — clear the session + revoke the device (lock the till). */
export async function POST(req: NextRequest) {
  await revokeCurrent(req);
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}

export async function GET(req: NextRequest) {
  await revokeCurrent(req);
  const res = NextResponse.redirect(new URL('/login', req.url));
  clearAuthCookies(res);
  return res;
}
