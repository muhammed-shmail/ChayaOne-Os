import { NextRequest, NextResponse } from 'next/server';
import { resolveTable } from '@/lib/customer';
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
  const t = req.nextUrl.searchParams.get('t');
  const table = await resolveTable(t);
  if (!table) return new NextResponse('table_not_found', { status: 404 });

  if (isLocalRuntime()) {
    try {
      const server = await ensureLocalWebSocketServer();
      const wsUrl = getWsUrl(req, server.getPort());
      const token = await mintLocalRealtimeToken({
        outletId: table.outlet.id,
        tableId: table.id,
        tenantId: table.outlet.tenantId,
      });

      return NextResponse.json({
        mode: 'local',
        url: wsUrl,
        anonKey: 'local',
        outletId: table.outlet.id,
        tableId: table.id,
        token,
      });
    } catch (e) {
      console.error('failed to initialize local realtime for customer:', e);
      return NextResponse.json({ error: 'local_realtime_error' }, { status: 500 });
    }
  }

  // Cloud Mode — Supabase
  const cfg = realtimeClientConfig();
  const token = await mintRealtimeToken({ outletId: table.outlet.id, tableId: table.id });
  if (!cfg || !token) {
    return NextResponse.json({ error: 'realtime_not_configured' }, { status: 503 });
  }

  return NextResponse.json({
    mode: 'cloud',
    url: cfg.url,
    anonKey: cfg.anonKey,
    outletId: table.outlet.id,
    tableId: table.id,
    token,
  });
}
