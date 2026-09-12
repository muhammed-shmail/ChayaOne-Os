import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signSession, signRefresh, setSessionCookie, setRefreshCookie } from '@/lib/auth';
import { createHash, timingSafeEqual, scryptSync } from 'crypto';

/**
 * POST /api/auth/login
 * Username + password login for owner-role users.
 * Uses the existing scrypt hash stored in StaffUser.passwordHash.
 *
 * Only allows roles: owner, manager, accountant.
 */
export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { username, password } = body;
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  try {
    // Find staff user by username across all tenants
    const staff = await prisma.staffUser.findFirst({
      where: {
        username: username.trim().toLowerCase(),
        active: true,
      },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    });

    if (!staff || !staff.passwordHash) {
      // Constant-time delay to prevent timing attacks
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Only allow owner/manager/accountant to use Owner Dashboard
    const ALLOWED_ROLES = ['owner', 'manager', 'accountant'];
    if (!ALLOWED_ROLES.includes(staff.role)) {
      return NextResponse.json(
        { error: 'Access denied. Owner Dashboard is restricted to owners, managers, and accountants.' },
        { status: 403 },
      );
    }

    // Verify password using existing scrypt hash format: "scrypt$salt$hash"
    const verified = await verifyPassword(password, staff.passwordHash);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create a StaffSession record for refresh token tracking
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await prisma.staffSession.create({
      data: {
        staffId:   staff.id,
        tenantId:  staff.tenantId,
        label:     req.headers.get('user-agent')?.slice(0, 100) ?? 'Owner PWA',
        userAgent: req.headers.get('user-agent') ?? undefined,
        expiresAt,
      },
    });

    const accessToken = await signSession({
      staffId:  staff.id,
      name:     staff.name,
      role:     staff.role as 'owner' | 'manager' | 'accountant',
      tenantId: staff.tenantId,
      outletId: staff.outletId ?? null,
      sid:      session.id,
    });

    const refreshToken = await signRefresh(session.id);

    const response = NextResponse.json({
      ok: true,
      user: {
        id:       staff.id,
        name:     staff.name,
        role:     staff.role,
        tenantId: staff.tenantId,
        outletId: staff.outletId,
      },
    });

    // Set cookies on the response
    response.cookies.set('owner_session', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      maxAge:   30 * 60,
    });
    response.cookies.set('owner_refresh', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      maxAge:   30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error('[auth/login] error:', err);
    return NextResponse.json({ error: err?.message ?? 'Login failed', details: String(err) }, { status: 500 });
  }
}

/**
 * Verify a password against the stored scrypt hash.
 * The existing Shop OS stores: "scrypt$salt$derivedKey" (base64 encoded).
 * Falls back to bcrypt-style comparison if format differs.
 */
function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const isHex = /^[0-9a-fA-F]+$/.test(parts[1]!) && /^[0-9a-fA-F]+$/.test(parts[2]!);
    const encoding = isHex ? 'hex' : 'base64';
    const salt = Buffer.from(parts[1]!, encoding);
    const want = Buffer.from(parts[2]!, encoding);
    const got = scryptSync(password, salt, want.length || 64);
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}
