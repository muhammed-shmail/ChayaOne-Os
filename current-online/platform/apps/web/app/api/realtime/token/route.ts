import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rollFromRefresh, setAuthCookies } from '@/lib/staff-session';
import { mintRealtimeToken, realtimeClientConfig } from '@/lib/realtime-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/realtime/token — hand the current staff member a short-lived Supabase
 * Realtime token scoped to their outlet, plus the public url/anonKey to connect.
 * The KDS / POS / approvals / dashboard clients call this, then subscribe to the
 * private `outlet:<id>` channel (see lib/realtime-client.ts).
 *
 * Auth mirrors the retired /api/stream: the access token is short (30 min) but
 * clients re-fetch this on channel expiry, so we accept a valid refresh cookie
 * when the access token has lapsed and hand back a fresh access cookie — without
 * this, a lapsed token would strand the live feed on "Offline".
 */
export async function GET(req: NextRequest) {
  let outletId: string | null = null;
  let renewed: { access: string; refresh: string } | null = null;

  const session = await getSession();
  if (session) {
    outletId = session.outletId;
  } else {
    const rolled = await rollFromRefresh(req);
    if (rolled) {
      outletId = rolled.principal.outletId;
      renewed = { access: rolled.access, refresh: rolled.refresh };
    }
  }
  if (!outletId) return new NextResponse('unauthorized', { status: 401 });

  const cfg = realtimeClientConfig();
  const token = await mintRealtimeToken({ outletId });
  if (!cfg || !token) {
    return NextResponse.json({ error: 'realtime_not_configured' }, { status: 503 });
  }

  const res = NextResponse.json({ url: cfg.url, anonKey: cfg.anonKey, outletId, token });
  if (renewed) setAuthCookies(res, renewed.access, renewed.refresh);
  return res;
}
