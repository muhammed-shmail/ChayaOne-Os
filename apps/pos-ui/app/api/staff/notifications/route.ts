import { NextRequest, NextResponse } from 'next/server';
import { prisma, type StaffRole } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canViewReminders } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/notifications — the staff notification feed for the current
 * staff member. Returns notifications aimed at all floor staff, at their role(s),
 * or at them specifically.
 *
 * REMINDERS: Reminders are strictly excluded for Waiter and Kitchen staff,
 * and only returned if the caller has reminder permission.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const effectiveRoles = (session.roles && session.roles.length > 0
    ? session.roles
    : [session.role]) as StaffRole[];

  const allowsReminders = canViewReminders(session);

  const items = await prisma.notification.findMany({
    where: {
      outletId: session.outletId,
      // Reminders never visible to regular floor / waiter staff
      ...(allowsReminders ? {} : { type: { not: 'reminder' } }),
      OR: [
        { audience: 'floor' },
        { audience: 'role', targetRole: { in: effectiveRoles } },
        { audience: 'user', targetStaffId: session.staffId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      severity: n.severity,
      title: n.title,
      body: n.body,
      entity: n.entity,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      at: n.createdAt.toISOString(),
      timestamp: n.createdAt.getTime(),
    })),
  });
}

/**
 * POST /api/staff/notifications — dismiss / mark as read a notification
 * (e.g. waiter marks customer assistance or order notification as done).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, id } = body;

  if (action === 'read' && id) {
    await prisma.notification.updateMany({
      where: { id, outletId: session.outletId },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'read_all') {
    const effectiveRoles = (session.roles && session.roles.length > 0
      ? session.roles
      : [session.role]) as StaffRole[];

    await prisma.notification.updateMany({
      where: {
        outletId: session.outletId,
        readAt: null,
        OR: [
          { audience: 'floor' },
          { audience: 'role', targetRole: { in: effectiveRoles } },
          { audience: 'user', targetStaffId: session.staffId },
        ],
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

