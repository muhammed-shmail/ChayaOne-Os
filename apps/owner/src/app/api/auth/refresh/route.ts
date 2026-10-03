import { NextRequest, NextResponse } from 'next/server';
import { verifyRefresh, signSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/auth/refresh?next=<path>
 * Rotates the access token if the refresh token is still valid.
 * Mirrors the shop's refresh endpoint but uses owner_session/owner_refresh cookies.
 */
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get('next') ?? '/dashboard';
  const refreshToken = req.cookies.get('owner_refresh')?.value;

  if (!refreshToken) {
    return redirectToLogin(req, next);
  }

  const refreshPayload = await verifyRefresh(refreshToken);
  if (!refreshPayload) {
    return redirectToLogin(req, next);
  }

  // Look up the session — check it hasn't been revoked
  const dbSession = await prisma.staffSession.findUnique({
    where: { id: refreshPayload.sid },
    include: {
      staff: {
        select: {
          id: true, name: true, role: true,
          tenantId: true, outletId: true, active: true,
        },
      },
    },
  });

  if (
    !dbSession ||
    dbSession.revokedAt ||
    dbSession.expiresAt < new Date() ||
    !dbSession.staff.active
  ) {
    return redirectToLogin(req, next);
  }

  const staff = dbSession.staff;
  const ALLOWED_ROLES = ['owner', 'manager', 'accountant'];
  if (!ALLOWED_ROLES.includes(staff.role)) {
    return redirectToLogin(req, next);
  }

  // Mint a new access token
  const accessToken = await signSession({
    staffId:  staff.id,
    name:     staff.name,
    role:     staff.role as 'owner' | 'manager' | 'accountant',
    tenantId: staff.tenantId,
    outletId: staff.outletId ?? null,
    sid:      dbSession.id,
  });

  // Slide the session expiry
  await prisma.staffSession.update({
    where: { id: dbSession.id },
    data: {
      lastSeenAt: new Date(),
      expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  }).catch(() => {/* non-fatal */});

  const url = req.nextUrl.clone();
  url.pathname = next;
  url.search = '';
  const response = NextResponse.redirect(url);

  response.cookies.set('owner_session', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   30 * 60,
  });

  return response;
}

function redirectToLogin(req: NextRequest, next: string) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(next)}`;
  const res = NextResponse.redirect(url);
  res.cookies.set('owner_session', '', { maxAge: 0, path: '/' });
  res.cookies.set('owner_refresh', '', { maxAge: 0, path: '/' });
  return res;
}
