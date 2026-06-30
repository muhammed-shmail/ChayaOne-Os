import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import {
  verifyRefresh, signSession, signRefresh,
  REFRESH_COOKIE, REFRESH_TTL_SECONDS,
} from '@/lib/auth';
import { setAuthCookies, clearAuthCookies } from '@/lib/staff-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Trade a refresh token for a fresh access token (the staff "stay logged in" loop).
 *
 *  - POST → client keep-alive (the staff PWA pings this periodically); returns JSON.
 *  - GET  → middleware silent-refresh: when the access cookie has lapsed but a
 *           refresh cookie is present, middleware bounces a navigation here; we
 *           mint a new access cookie and 302 back to `?next=…`.
 *
 * This is the ONLY place revocation is enforced (edge middleware stays stateless),
 * so a remotely-revoked or expired device loses access within one access-token TTL.
 */
type RollResult = { ok: false } | { ok: true; access: string; refresh: string };

async function roll(req: NextRequest): Promise<RollResult> {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  const parsed = token ? await verifyRefresh(token) : null;
  if (!parsed) return { ok: false };

  const row = await prisma.staffSession.findUnique({
    where: { id: parsed.sid },
    select: {
      revokedAt: true, expiresAt: true,
      staff: { select: { id: true, name: true, role: true, tenantId: true, outletId: true, active: true } },
    },
  });

  const now = new Date();
  if (!row || row.revokedAt || row.expiresAt <= now) return { ok: false };
  const s = row.staff;
  if (!s.active || !s.outletId) return { ok: false };

  // slide the window forward + record presence (powers the live online dot)
  await prisma.staffSession.update({
    where: { id: parsed.sid },
    data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000) },
  });

  const access = await signSession({
    staffId: s.id, name: s.name, role: s.role, tenantId: s.tenantId, outletId: s.outletId, sid: parsed.sid,
  });
  const refresh = await signRefresh(parsed.sid);
  return { ok: true, access, refresh };
}

export async function POST(req: NextRequest) {
  const r = await roll(req);
  if (!r.ok) {
    const res = NextResponse.json({ error: 'session_expired' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, r.access, r.refresh);
  return res;
}

/** Only same-origin absolute paths are allowed as a redirect target. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/pos';
  return raw;
}

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const r = await roll(req);
  if (!r.ok) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(next)}`;
    const res = NextResponse.redirect(url);
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.redirect(new URL(next, req.url));
  setAuthCookies(res, r.access, r.refresh);
  return res;
}
