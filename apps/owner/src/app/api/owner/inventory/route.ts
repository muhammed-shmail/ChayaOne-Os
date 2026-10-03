import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');
  const filter = sp.get('filter') ?? 'all'; // all | low | critical | out

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  const outletIds = outletId ? [outletId] : auth.authorizedOutletIds;

  try {
    const items = await prisma.stockItem.findMany({
      where: { outletId: { in: outletIds } },
      include: { outlet: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    const data = items
      .map((i) => {
        const qty = Number(i.qtyOnHand);
        const reorder = Number(i.reorderLevel);
        const status: 'ok' | 'low' | 'critical' | 'out' =
          qty <= 0 ? 'out'
          : qty <= reorder * 0.5 ? 'critical'
          : qty <= reorder ? 'low'
          : 'ok';
        return {
          id:           i.id,
          storeId:      i.outletId,
          storeName:    i.outlet.name,
          name:         i.name,
          unit:         i.unit,
          qtyOnHand:    qty,
          reorderLevel: reorder,
          avgCostPaise: i.avgCostPaise,
          status,
        };
      })
      .filter((i) => filter === 'all' || i.status === filter);

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    console.error('[inventory]', err);
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 });
  }
}
