import { NextRequest, NextResponse } from 'next/server';
import { rollFromRefresh, setAuthCookies, clearAuthCookies } from '@/lib/staff-session';

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
 * Revocation is enforced inside rollFromRefresh (edge middleware stays stateless),
 * so a remotely-revoked or expired device loses access within one access-token TTL.
 */
export async function POST(req: NextRequest) {
  const r = await rollFromRefresh(req);
  if (!r) {
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
  const r = await rollFromRefresh(req);
  if (!r) {
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
