import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

/**
 * Cafe OS — session helpers. A signed JWT in an httpOnly cookie carries the
 * authenticated staff member + their tenant/outlet. Everything downstream
 * (order attribution, tenant scoping / RLS context) reads from here.
 *
 * Two tokens (staff "stay logged in" PWA model):
 *  - ACCESS  (`cafeos_session`)  — short-lived, verified statelessly on the edge.
 *  - REFRESH (`cafeos_refresh`)  — long-lived, bound to a StaffSession row; the
 *    refresh endpoint trades it for a fresh access token (and enforces revocation).
 */
export const SESSION_COOKIE = 'cafeos_session';
export const REFRESH_COOKIE = 'cafeos_refresh';

// Access expires fast so a remotely-revoked device loses access within this
// window; the client keep-alive refreshes well before it lapses. Refresh is a
// month, slid forward on every use, so an in-use device never gets logged out.
export const ACCESS_TTL_SECONDS = 60 * 30; // 30 minutes
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface Session extends JWTPayload {
  staffId: string;
  name: string;
  role: string;
  tenantId: string;
  outletId: string;
  sid?: string; // StaffSession id this access token was minted from
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
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

/** Read the current session from cookies (server components / route handlers). */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
