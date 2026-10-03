import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rollFromRefresh, setAuthCookies } from '@/lib/staff-session';
import { mintRealtimeToken, realtimeClientConfig } from '@/lib/realtime-auth';
import { isLocalRuntime } from '@/lib/realtime';
import { mintLocalRealtimeToken } from '@/lib/realtime/auth';
import { ensureLocalWebSocketServer } from '@/lib/realtime/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getWsUrl(req: NextRequest, port = 3001): string {
  const hostHeader = req.headers.get('host') || 'localhost:3000';
  const hostname = hostHeader.split(':')[0] || 'localhost';
  const proto = req.headers.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
  return `${proto}://${hostname}:${port}`;
}

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

  if (isLocalRuntime()) {
    try {
      const server = await ensureLocalWebSocketServer();
      const wsUrl = getWsUrl(req, server.getPort());
      const token = await mintLocalRealtimeToken({
        outletId,
        staffId: session?.staffId,
        role: session?.role,
        tenantId: session?.tenantId,
      });

      const res = NextResponse.json({
        mode: 'local',
        url: wsUrl,
        anonKey: 'local',
        outletId,
        token,
      });

      if (renewed) setAuthCookies(res, renewed.access, renewed.refresh);
      return res;
    } catch (e) {
      console.error('failed to initialize local realtime server:', e);
      return NextResponse.json({ error: 'local_realtime_error' }, { status: 500 });
    }
  }

  // Cloud Mode — Supabase
  const cfg = realtimeClientConfig();
  const token = await mintRealtimeToken({ outletId });
  if (!cfg || !token) {
    return NextResponse.json({ error: 'realtime_not_configured' }, { status: 503 });
  }

  const res = NextResponse.json({ mode: 'cloud', url: cfg.url, anonKey: cfg.anonKey, outletId, token });
  if (renewed) setAuthCookies(res, renewed.access, renewed.refresh);
  return res;
}
