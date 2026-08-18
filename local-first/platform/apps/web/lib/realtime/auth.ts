import { SignJWT, jwtVerify } from 'jose';
import type { LocalRealtimeClaims } from './types';

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

function secretKey(): Uint8Array {
  const s = process.env.JWT_SECRET || 'chayaone-local-jwt-secret-key-32-chars-long';
  return new TextEncoder().encode(s);
}

/**
 * Mint a short-lived local WebSocket authorization token.
 */
export async function mintLocalRealtimeToken(claims: {
  outletId: string;
  tableId?: string | null;
  role?: string;
  tenantId?: string;
  staffId?: string;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    typ: 'local_realtime',
    outlet_id: claims.outletId,
  };

  if (claims.tableId) payload.table_id = claims.tableId;
  if (claims.role) payload.role = claims.role;
  if (claims.tenantId) payload.tenant_id = claims.tenantId;
  if (claims.staffId) payload.sub = claims.staffId;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Verify a local WebSocket authorization token and return claims.
 */
export async function verifyLocalRealtimeToken(token: string): Promise<LocalRealtimeClaims | null> {
  try {
    const verified = await jwtVerify(token, secretKey());
    const p = verified.payload as Record<string, unknown>;

    const outletId = (p.outlet_id as string) || (p.outletId as string);
    if (!outletId) return null;

    return {
      outletId,
      tableId: (p.table_id as string) || (p.tableId as string) || null,
      role: (p.role as string) || undefined,
      tenantId: (p.tenant_id as string) || (p.tenantId as string) || undefined,
      sub: (p.sub as string) || undefined,
    };
  } catch (e) {
    return null;
  }
}
