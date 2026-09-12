import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { prisma } from '@/lib/db';
import { getDateRange } from '@/lib/utils/dates';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');
  const preset = sp.get('preset') as 'today' | 'week' | 'month' | 'last_month' | null;
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, parseInt(sp.get('limit') ?? '50', 10));

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  const { from, to } = preset
    ? getDateRange(preset)
    : {
        from: fromParam ? new Date(fromParam) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })(),
        to: toParam ? new Date(toParam) : new Date(),
      };

  const outletIds = outletId ? [outletId] : auth.authorizedOutletIds;
  const skip = (page - 1) * limit;

  try {
    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          outletId: { in: outletIds },
          createdAt: { gte: from, lte: to },
        },
        include: {
          outlet: { select: { name: true } },
          vendor: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({
        where: { outletId: { in: outletIds }, createdAt: { gte: from, lte: to } },
      }),
    ]);

    const data = pos.map((p) => ({
      id:         p.id,
      storeId:    p.outletId,
      storeName:  p.outlet.name,
      vendorId:   p.vendorId,
      vendorName: p.vendor.name,
      status:     p.status,
      totalPaise: p.totalPaise,
      paidPaise:  p.paidPaise,
      invoiceNo:  p.invoiceNo,
      createdAt:  p.createdAt.toISOString(),
    }));

    return NextResponse.json({ data, total, page, limit, hasMore: skip + data.length < total });
  } catch (err) {
    console.error('[expenses]', err);
    return NextResponse.json({ error: 'Failed to load expenses' }, { status: 500 });
  }
}
