import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { prisma, type StaffRole } from '@cafeos/db';
import { getEffectiveRoles, getEffectivePermissions } from './rbac';

/**
 * Cafe OS — session helpers & live authorization revalidation.
 *
 * A signed JWT in an httpOnly cookie carries the authenticated staff member identity.
 * Server components and route handlers revalidate against live database state (< 1ms cache)
 * to guarantee that any role or permission update from the Staff Portal takes effect
 * instantly across all active sessions without 30-minute staleness.
 *
 * Two tokens (staff "stay logged in" PWA model):
 *  - ACCESS  (`cafeos_session`)  — verified statelessly on edge middleware, enriched in Node runtime.
 *  - REFRESH (`cafeos_refresh`)  — long-lived, bound to a StaffSession row.
 */
export const SESSION_COOKIE = 'cafeos_session';
export const REFRESH_COOKIE = 'cafeos_refresh';

export const ACCESS_TTL_SECONDS = 60 * 30; // 30 minutes
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface Session extends JWTPayload {
  staffId: string;
  name: string;
  role: string;
  roles?: string[];
  permissions?: any;
  effectivePermissions?: string[];
  tenantId: string;
  outletId: string;
  sid?: string; // StaffSession id this access token was minted from
}

export interface LiveStaffContext {
  id: string;
  name: string;
  role: StaffRole;
  roles: StaffRole[];
  permissions: any;
  effectivePermissions: string[];
  active: boolean;
  outletId: string | null;
  tenantId: string;
}

const staffCache = new Map<string, { data: LiveStaffContext; expiresAt: number }>();
const CACHE_TTL_MS = 5000; // 5s hot-path cache

/** Invalidate staff live context cache (called upon any role/permission/user edit) */
export function invalidateStaffCache(staffId?: string) {
  if (staffId) {
    staffCache.delete(staffId);
  } else {
    staffCache.clear();
  }
}

/** Fetches live staff state from database with short TTL caching */
export async function getLiveStaffContext(staffId: string): Promise<LiveStaffContext | null> {
  const cached = staffCache.get(staffId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const user = await prisma.staffUser.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      name: true,
      role: true,
      permissions: true,
      active: true,
      outletId: true,
      tenantId: true,
    },
  });

  if (!user) return null;

  const roles = getEffectiveRoles({ role: user.role, permissions: user.permissions });
  const effectivePermissions = getEffectivePermissions({ role: user.role, permissions: user.permissions });

  const data: LiveStaffContext = {
    id: user.id,
    name: user.name,
    role: user.role,
    roles,
    permissions: user.permissions,
    effectivePermissions,
    active: user.active,
    outletId: user.outletId,
    tenantId: user.tenantId,
  };

  staffCache.set(staffId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET || 'chayaone-local-jwt-secret-key-32-chars-long';
  return new TextEncoder().encode(s);
}

export async function signSession(payload: Omit<Session, keyof JWTPayload>): Promise<string> {
  return new SignJWT({ ...payload, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ === 'refresh') return null; // a refresh token must not pass as access
    return payload as Session;
  } catch {
    return null;
  }
}

/** Sign a refresh token bound to a StaffSession row (`sid`). */
export async function signRefresh(sid: string): Promise<string> {
  return new SignJWT({ typ: 'refresh', sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(secret());
}

/** Verify a refresh token; returns its bound StaffSession id, or null. */
export async function verifyRefresh(token: string): Promise<{ sid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ !== 'refresh' || typeof payload.sid !== 'string') return null;
    return { sid: payload.sid };
  } catch {
    return null;
  }
}

/**
 * Read current session from cookies with live DB revalidation.
 * Returns null immediately if user does not exist or has been deactivated.
 */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  try {
    const live = await getLiveStaffContext(session.staffId);
    if (!live || !live.active) {
      return null;
    }
    session.role = live.role;
    session.roles = live.roles;
    session.permissions = live.permissions;
    session.effectivePermissions = live.effectivePermissions;
    session.name = live.name;
    if (live.outletId) session.outletId = live.outletId;
  } catch (err) {
    console.warn('[AUTH] Live staff context fetch fallback:', err);
  }

  return session;
}
