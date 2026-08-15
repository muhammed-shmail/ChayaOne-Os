import { NextResponse } from 'next/server';
import { prisma, type StaffRole } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/notifications — the staff notification bar feed for the current
 * staff member (their phone). Returns notifications aimed at all floor staff,
 * at their role, or at them specifically. Owner-only alerts (low stock, sales
 * drop, etc.) are excluded — those live on the dashboard bell.
 *
 * Read-state is tracked client-side (a per-device "last seen" timestamp), so
 * there's no server read endpoint here — shared 'floor' broadcasts can't carry a
 * single global readAt.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const items = await prisma.notification.findMany({
    where: {
      outletId: session.outletId,
      OR: [
        { audience: 'floor' },
        { audience: 'role', targetRole: session.role as StaffRole },
        { audience: 'user', targetStaffId: session.staffId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      severity: n.severity,
      title: n.title,
      body: n.body,
      at: n.createdAt.getTime(),
    })),
  });
}
