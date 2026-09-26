import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

/**
 * ChayaOne Owner Dashboard — session helpers.
 *
 * Uses the same JWT/scrypt pattern as the Shop OS but with distinct cookie
 * names so the two apps can coexist on different domains without collision.
 *
 * Cookie names:
 *   ACCESS  : owner_session   (30 min)
 *   REFRESH : owner_refresh   (30 days, slid on each use)
 *
 * Session payload carries the minimum needed for server-side authorization:
 *   staffId   — StaffUser.id
 *   tenantId  — Tenant.id  (= organization)
 *   outletId  — Outlet.id | null  (null = tenant-wide owner)
 *   role      — StaffRole (owner | manager | accountant)
 *   name      — display name
 *   sid       — StaffSession.id (refresh token anchor)
 */

export const SESSION_COOKIE  = 'owner_session';
export const REFRESH_COOKIE  = 'owner_refresh';

export const ACCESS_TTL_SECONDS  = 60 * 30;             // 30 min
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;  // 30 days

export const OWNER_ROLES = ['owner', 'manager', 'cashier', 'accountant'] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export interface OwnerSession extends JWTPayload {
  staffId:  string;
  name:     string;
  role:     OwnerRole;
  tenantId: string;
  /** null means the user has tenant-wide access (all outlets). */
  outletId: string | null;
  sid?:     string;
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET ?? process.env.OWNER_JWT_SECRET ?? 'chayaone-owner-fallback-secret-at-least-32-chars-long';
  return new TextEncoder().encode(s);
}

export async function signSession(
  payload: Omit<OwnerSession, keyof JWTPayload>,
): Promise<string> {
  return new SignJWT({ ...payload, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<OwnerSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ === 'refresh') return null;
    return payload as OwnerSession;
  } catch {
    return null;
  }
}

export async function signRefresh(sid: string): Promise<string> {
  return new SignJWT({ typ: 'refresh', sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyRefresh(token: string): Promise<{ sid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ !== 'refresh' || typeof payload.sid !== 'string') return null;
    return { sid: payload.sid };
  } catch {
    return null;
  }
}

/** Read current session from cookies (server components / route handlers). */
export async function getSession(): Promise<OwnerSession | null> {
  let token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) {
    token = cookies().get('cafeos_session')?.value;
  }
  if (!token) return null;
  return verifySession(token);
}

/** Set the access-token cookie (httpOnly, SameSite=Lax). */
export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  });
}

/** Set the refresh-token cookie (httpOnly, longer TTL). */
export function setRefreshCookie(token: string) {
  cookies().set(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

/** Clear both cookies on logout. */
export function clearSessionCookies() {
  cookies().set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  cookies().set(REFRESH_COOKIE, '', { maxAge: 0, path: '/' });
}
