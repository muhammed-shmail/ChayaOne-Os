import { SignJWT } from 'jose';

/**
 * Cafe OS — Supabase Realtime authorization.
 *
 * The browser connects to Supabase Realtime with a short-lived JWT we mint here,
 * signed with the project's JWT secret (Settings → API → JWT Secret). Supabase
 * verifies it, and the `outlet_id` / `table_id` claims drive the RLS policy on
 * `realtime.messages` that scopes which private channel the client may read:
 *
 *   realtime.topic() =
 *     'outlet:' || (auth.jwt()->>'outlet_id')
 *       || coalesce(':tbl:' || (auth.jwt()->>'table_id'), '')
 *
 * So a staff token (outlet only) reads exactly `outlet:<id>`, and a customer
 * token (outlet + table) reads exactly `outlet:<id>:tbl:<tableId>` — preserving
 * the per-outlet / per-table isolation the old server-side SSE enforced.
 */

export type RealtimeClientConfig = {
  url: string; // https://<project-ref>.supabase.co (no trailing slash)
  anonKey: string; // public — safe to hand to the browser
};

type MintConfig = RealtimeClientConfig & { jwtSecret: string };

function readConfig(): MintConfig | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!url || !anonKey || !jwtSecret) return null;
  return { url: url.replace(/\/$/, ''), anonKey, jwtSecret };
}

/** The public bits a client needs to open a realtime connection. */
export function realtimeClientConfig(): RealtimeClientConfig | null {
  const cfg = readConfig();
  return cfg ? { url: cfg.url, anonKey: cfg.anonKey } : null;
}

const TOKEN_TTL_SECONDS = 60 * 60; // 1h; clients re-fetch on expiry/reconnect

/**
 * Mint a Supabase-compatible realtime token. `role: 'authenticated'` maps the
 * connection to the Postgres `authenticated` role the RLS policy targets.
 * Returns null when Supabase Realtime isn't configured (local dev no-op).
 */
export async function mintRealtimeToken(claims: {
  outletId: string;
  tableId?: string | null;
}): Promise<string | null> {
  const cfg = readConfig();
  if (!cfg) return null;
  const payload: Record<string, unknown> = { role: 'authenticated', outlet_id: claims.outletId };
  if (claims.tableId) payload.table_id = claims.tableId;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(cfg.jwtSecret));
}
