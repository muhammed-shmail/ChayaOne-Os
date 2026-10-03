import type { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import {
  signSession, signRefresh, verifyRefresh,
  SESSION_COOKIE, REFRESH_COOKIE, ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS,
} from '@/lib/auth';

/**
 * Persistent staff login plumbing (the PWA "stay logged in" model).
 * Shared by the login routes (mint a new device) and the refresh route
 * (roll the access token forward on an existing device).
 */

export type StaffPrincipal = {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  outletId: string;
};

/** A short, human-friendly device label derived from the User-Agent. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const os =
    /Android/i.test(ua) ? 'Android' :
    /iPhone/i.test(ua) ? 'iPhone' :
    /iPad/i.test(ua) ? 'iPad' :
    /Windows/i.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/i.test(ua) ? 'Mac' :
    /Linux/i.test(ua) ? 'Linux' : 'Device';
  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\//i.test(ua) ? 'Opera' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${browser}`;
}

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

/** Set both auth cookies on a response. */
export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  res.cookies.set(SESSION_COOKIE, accessToken, cookieOpts(ACCESS_TTL_SECONDS));
  res.cookies.set(REFRESH_COOKIE, refreshToken, cookieOpts(REFRESH_TTL_SECONDS));
}

/** Clear both auth cookies (logout / failed refresh). */
export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/**
 * Create a new device session for `staff`, then set both cookies on `res`.
 * Returns the new StaffSession id.
 */
export async function startStaffSession(
  res: NextResponse,
  staff: StaffPrincipal,
  userAgent: string | null,
): Promise<string> {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
  const row = await prisma.staffSession.create({
    data: {
      tenantId: staff.tenantId,
      staffId: staff.id,
      label: deviceLabel(userAgent),
      userAgent: userAgent ?? undefined,
      expiresAt,
    },
    select: { id: true },
  });

  const accessToken = await signSession({
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
    tenantId: staff.tenantId,
    outletId: staff.outletId,
    sid: row.id,
  });
  const refreshToken = await signRefresh(row.id);
  setAuthCookies(res, accessToken, refreshToken);
  return row.id;
}

export type RolledSession = {
  access: string;
  refresh: string;
  principal: StaffPrincipal & { sid: string };
};

/**
 * Trade a valid refresh cookie for a fresh access+refresh token pair, enforcing
 * revocation/expiry against the StaffSession row (the one stateful check) and
 * sliding the 30-day window forward. Returns null when there's no usable refresh
 * cookie (genuinely signed out / revoked / expired device).
 *
 * Shared by:
 *  - /api/auth/refresh — the client keep-alive + middleware silent-refresh.
 *  - /api/realtime/token — so a client re-fetching its Supabase Realtime token
 *    after a lapsed 30-min access token gets re-authorized (and a fresh access
 *    cookie) instead of being stranded Offline.
 */
export async function rollFromRefresh(req: NextRequest): Promise<RolledSession | null> {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  const parsed = token ? await verifyRefresh(token) : null;
  if (!parsed) return null;

  const row = await prisma.staffSession.findUnique({
    where: { id: parsed.sid },
    select: {
      revokedAt: true, expiresAt: true,
      staff: { select: { id: true, name: true, role: true, tenantId: true, outletId: true, active: true } },
    },
  });

  const now = new Date();
  if (!row || row.revokedAt || row.expiresAt <= now) return null;
  const s = row.staff;
  if (!s.active || !s.outletId) return null;

  // slide the window forward + record presence (powers the live online dot)
  await prisma.staffSession.update({
    where: { id: parsed.sid },
    data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000) },
  });

  const access = await signSession({
    staffId: s.id, name: s.name, role: s.role, tenantId: s.tenantId, outletId: s.outletId, sid: parsed.sid,
  });
  const refresh = await signRefresh(parsed.sid);
  return {
    access,
    refresh,
    principal: { id: s.id, name: s.name, role: s.role, tenantId: s.tenantId, outletId: s.outletId, sid: parsed.sid },
  };
}
