import { NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/server/waiters
 * Returns active staff members (waiters, captains, cashiers, managers)
 * for device pairing and QR code assignment.
 */
export async function GET() {
  try {
    const staff = await prisma.staffUser.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        role: true,
        pinHash: true,
        outletId: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    const members = staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      hasPin: !!s.pinHash,
      outletId: s.outletId,
      brandName: s.tenant?.name || 'ChayaOne',
    }));

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
