import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { getOrdersForOutlets } from '@/lib/api/analytics';
import { getDateRange } from '@/lib/utils/dates';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');
  const status = sp.get('status') ?? 'all';
  const preset = sp.get('preset') as 'today' | 'yesterday' | 'week' | 'month' | null;
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)));

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  const { from, to } = preset
    ? getDateRange(preset)
    : {
        from: fromParam ? new Date(fromParam) : (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })(),
        to: toParam ? new Date(toParam) : new Date(),
      };

  const outletIds = outletId ? [outletId] : auth.authorizedOutletIds;

  try {
    const result = await getOrdersForOutlets(outletIds, from, to, status === 'all' ? undefined : status, page, limit);

    const data = result.data.map((o) => ({
      id:         o.id,
      number:     o.number,
      storeId:    o.outletId,
      storeName:  (o as { outlet?: { name?: string } }).outlet?.name,
      type:       o.type,
      status:     o.status,
      channel:    o.channel,
      table:      (o as { table?: { label?: string } }).table?.label ?? null,
      totalPaise: o.totalPaise,
      itemCount:  (o as { _count?: { items?: number } })._count?.items ?? 0,
      placedAt:   o.placedAt.toISOString(),
    }));

    return NextResponse.json({ ...result, data });
  } catch (err) {
    console.error('[orders]', err);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
