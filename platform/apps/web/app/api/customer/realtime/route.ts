import { NextRequest, NextResponse } from 'next/server';
import { resolveTable } from '@/lib/customer';
import { mintRealtimeToken, realtimeClientConfig } from '@/lib/realtime-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/customer/realtime?t=<qrToken> — PUBLIC. The QR token is the capability:
 * we resolve it to a table and hand back a Supabase Realtime token scoped to just
 * that table's channel (`outlet:<id>:tbl:<tableId>`), so a guest sees only their
 * own table's live order status — never another table's or the owner's alerts.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t');
  const table = await resolveTable(t);
  if (!table) return new NextResponse('table_not_found', { status: 404 });

  const cfg = realtimeClientConfig();
  const token = await mintRealtimeToken({ outletId: table.outlet.id, tableId: table.id });
  if (!cfg || !token) {
    return NextResponse.json({ error: 'realtime_not_configured' }, { status: 503 });
  }

  return NextResponse.json({
    url: cfg.url,
    anonKey: cfg.anonKey,
    outletId: table.outlet.id,
    tableId: table.id,
    token,
  });
}
