import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/auth/logout
 * Revokes the StaffSession and clears auth cookies.
 */
export async function POST() {
  const session = await getSession();

  // Revoke the session record if we have a session ID
  if (session?.sid) {
    await prisma.staffSession.update({
      where: { id: session.sid },
      data: { revokedAt: new Date() },
    }).catch(() => {
      // Session may already be gone — non-fatal
    });
  }

  const response = NextResponse.json({ ok: true });

  // Clear both cookies
  response.cookies.set('owner_session', '', { maxAge: 0, path: '/' });
  response.cookies.set('owner_refresh', '', { maxAge: 0, path: '/' });

  return response;
}
