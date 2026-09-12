import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  // Staff is tenant-scoped, outlet-filtered if applicable
  const where = outletId
    ? { tenantId: auth.session.tenantId, outletId }
    : { tenantId: auth.session.tenantId };

  try {
    const staff = await prisma.staffUser.findMany({
      where,
      select: {
        id:          true,
        outletId:    true,
        name:        true,
        role:        true,
        phone:       true,
        email:       true,
        active:      true,
        payType:     true,
        payRatePaise: true,
        createdAt:   true,
        // NEVER return pinHash, passwordHash, or any auth secrets
      },
      orderBy: { name: 'asc' },
    });

    // Get outlet names for multi-store view
    const outlets = await prisma.outlet.findMany({
      where: { id: { in: auth.authorizedOutletIds } },
      select: { id: true, name: true },
    });
    const outletMap = new Map(outlets.map((o) => [o.id, o.name]));

    const data = staff.map((s) => ({
      id:         s.id,
      storeId:    s.outletId,
      storeName:  s.outletId ? (outletMap.get(s.outletId) ?? null) : null,
      name:       s.name,
      role:       s.role,
      phone:      s.phone,
      email:      s.email,
      active:     s.active,
      payType:    s.payType,
      createdAt:  s.createdAt.toISOString(),
    }));

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    console.error('[staff]', err);
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }
}
