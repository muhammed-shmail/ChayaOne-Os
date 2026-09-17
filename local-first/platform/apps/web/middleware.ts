import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/auth';

/**
 * Gate the app surfaces. Runs on the edge; jose verifies JWTs without Node crypto.
 *  - /pos /kds /dashboard require a staff session.
 */
const PROTECTED = ['/pos', '/kds', '/dashboard'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    // Access token lapsed. If the device still holds a refresh cookie, bounce the
    // navigation through the refresh endpoint (Node runtime — it checks the DB for
    // revocation and mints a new access cookie) so staff aren't kicked to /login on
    // a normal 30-min expiry. No refresh cookie → genuine sign-in needed.
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '127.0.0.1:3000';
    const effectiveHost = host.startsWith('0.0.0.0') ? host.replace('0.0.0.0', '127.0.0.1') : host;
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const origin = `${proto}://${effectiveHost}`;

    const hasRefreshed = req.nextUrl.searchParams.get('refreshed') === '1';
    if (!hasRefreshed && req.cookies.get(REFRESH_COOKIE)?.value) {
      const url = new URL('/api/auth/refresh', origin);
      const target = pathname + (req.nextUrl.search ? `${req.nextUrl.search}&refreshed=1` : '?refreshed=1');
      url.search = `?next=${encodeURIComponent(target)}`;
      return NextResponse.redirect(url);
    }
    const url = new URL('/login', origin);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);

  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/pos/:path*', '/kds/:path*', '/dashboard/:path*'],
};
