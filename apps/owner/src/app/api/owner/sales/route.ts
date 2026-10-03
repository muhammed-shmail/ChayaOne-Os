import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { getSalesForOutlets } from '@/lib/api/analytics';
import { getDateRange } from '@/lib/utils/dates';

/**
 * GET /api/owner/sales
 * Query params:
 *   outletId  — specific store (optional, must be authorized)
 *   from      — ISO date string
 *   to        — ISO date string
 *   preset    — today | yesterday | week | month | last_month
 *   page      — pagination (default: 1)
 *   limit     — page size (default: 50, max: 100)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');
  const preset = sp.get('preset') as 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | null;
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)));

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  const { from, to } = preset
    ? getDateRange(preset)
    : {
        from: fromParam ? new Date(fromParam) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })(),
        to:   toParam ? new Date(toParam) : new Date(),
      };

  const outletIds = outletId ? [outletId] : auth.authorizedOutletIds;

  try {
    const result = await getSalesForOutlets(outletIds, from, to, page, limit);

    // Shape the response
    const data = result.data.map((o) => ({
      id:         o.id,
      number:     o.number,
      storeId:    o.outletId,
      storeName:  (o as { outlet?: { name?: string } }).outlet?.name,
      table:      (o as { table?: { label?: string } }).table?.label ?? null,
      totalPaise: o.totalPaise,
      channel:    o.channel,
      status:     o.status,
      placedAt:   o.placedAt.toISOString(),
      settledAt:  o.settledAt?.toISOString() ?? null,
      payments:   (o as { payments: Array<{ method: string; amountPaise: number; status: string }> }).payments.map((p) => ({
        method:      p.method,
        amountPaise: p.amountPaise,
        status:      p.status,
      })),
    }));

    return NextResponse.json({ ...result, data });
  } catch (err) {
    console.error('[sales]', err);
    return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 });
  }
}
