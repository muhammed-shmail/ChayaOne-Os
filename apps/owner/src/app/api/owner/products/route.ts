import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)));

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  const outletIds = outletId ? [outletId] : auth.authorizedOutletIds;
  const skip = (page - 1) * limit;

  try {
    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where: { outletId: { in: outletIds } },
        include: {
          outlet:   { select: { name: true } },
          category: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.menuItem.count({ where: { outletId: { in: outletIds } } }),
    ]);

    const data = items.map((i) => ({
      id:          i.id,
      storeId:     i.outletId,
      storeName:   i.outlet.name,
      categoryId:  i.categoryId,
      category:    i.category?.name ?? null,
      name:        i.name,
      description: i.description,
      pricePaise:  i.pricePaise,
      gstRate:     Number(i.gstRate),
      isAvailable: i.isAvailable,
      tags:        i.tags,
    }));

    return NextResponse.json({ data, total, page, limit, hasMore: skip + data.length < total });
  } catch (err) {
    console.error('[products]', err);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
