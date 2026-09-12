import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { getDailySalesReport, getPaymentBreakdown } from '@/lib/api/analytics';
import { getDateRange } from '@/lib/utils/dates';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');
  const type = sp.get('type') ?? 'daily'; // daily | payments | products
  const preset = sp.get('preset') as 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | null;
  const fromParam = sp.get('from');
  const toParam = sp.get('to');

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  const { from, to } = preset
    ? getDateRange(preset)
    : {
        from: fromParam ? new Date(fromParam) : (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; })(),
        to: toParam ? new Date(toParam) : new Date(),
      };

  const outletIds = outletId ? [outletId] : auth.authorizedOutletIds;

  try {
    if (type === 'daily') {
      const data = await getDailySalesReport(outletIds, from, to);
      return NextResponse.json({ data, from: from.toISOString(), to: to.toISOString() });
    }

    if (type === 'payments') {
      const data = await getPaymentBreakdown(outletIds, from, to);
      return NextResponse.json({ data, from: from.toISOString(), to: to.toISOString() });
    }

    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  } catch (err) {
    console.error('[reports]', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
