import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/server/waiters
 * Returns active staff members for device pairing and QR code assignment.
 * Scoped to the session's tenant/outlet (or optional tenantId / outletId param)
 * so staff from other tenants or deleted/inactive staff are strictly excluded.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const url = new URL(req.url);
    const qpTenantId = url.searchParams.get('tenantId');
    const qpOutletId = url.searchParams.get('outletId');

    const tenantId = session?.tenantId || qpTenantId;
    const outletId = session?.outletId || qpOutletId;

    const where: any = { active: true };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (outletId) {
      where.outletId = outletId;
    }

    const staff = await prisma.staffUser.findMany({
      where,
      select: {
        id: true,
        name: true,
        role: true,
        pinHash: true,
        outletId: true,
        permissions: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    const members = staff.map((s) => {
      let assignedRoles: string[] = [s.role];
      if (s.permissions) {
        try {
          const p = typeof s.permissions === 'string' ? JSON.parse(s.permissions) : s.permissions;
          if (Array.isArray(p?.assignedRoles) && p.assignedRoles.length > 0) {
            assignedRoles = p.assignedRoles;
          }
        } catch {}
      }

      const displayRole = assignedRoles
        .map((r) => r.toUpperCase())
        .join(', ');

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        assignedRoles,
        displayRole,
        hasPin: !!s.pinHash,
        outletId: s.outletId,
        brandName: s.tenant?.name || 'ChayaOne',
      };
    });

    return NextResponse.json({
      ok: true,
      waiters: members,
    });
  } catch (err: any) {
    console.error('Error fetching waiters for QR pairing:', err);
    return NextResponse.json(
      { ok: false, error: 'failed_to_fetch_waiters', message: err?.message },
      { status: 500 }
    );
  }
}
