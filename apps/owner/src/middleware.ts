import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/auth';

/**
 * Edge middleware — gates protected routes.
 * Runs before every request to /dashboard, /sales, /orders, etc.
 *
 * Login page and API routes are NOT gated here (API routes do their own auth).
 * The refresh endpoint itself is also public (it does its own validation).
 */

const PROTECTED = [
  '/dashboard',
  '/sales',
  '/orders',
  '/products',
  '/inventory',
  '/expenses',
  '/staff',
  '/reports',
  '/stores',
  '/settings',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate protected pages (not API routes, login, or static assets)
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    // Access token lapsed — try refresh endpoint if refresh cookie exists
    if (req.cookies.get(REFRESH_COOKIE)?.value) {
      const url = req.nextUrl.clone();
      url.pathname = '/api/auth/refresh';
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }

    // No valid tokens — redirect to login
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/sales/:path*',
    '/orders/:path*',
    '/products/:path*',
    '/inventory/:path*',
    '/expenses/:path*',
    '/staff/:path*',
    '/reports/:path*',
    '/stores/:path*',
    '/settings/:path*',
  ],
};
