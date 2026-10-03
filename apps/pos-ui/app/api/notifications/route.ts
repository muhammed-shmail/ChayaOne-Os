import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canViewReminders } from '@/lib/rbac';
import { publish } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/notifications?unread=1 — the owner/manager alert and reminder feed for this outlet. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // STRICT AUTHORIZATION: Reminders and owner notifications are restricted.
  // Waiters and unauthorized staff are rejected with 403.
  if (!canViewReminders(session)) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Administrative notifications and reminders are restricted to Owner and Manager' },
      { status: 403 }
    );
  }

  const onlyUnread = req.nextUrl.searchParams.get('unread') === '1';
  // Owner monitor bell = owner-audience alerts only. Staff-targeted notifications
  // (order ready, broadcasts) live on the staff bar, not here.
  const base = { outletId: session.outletId, audience: 'owner' };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { ...base, ...(onlyUnread ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.notification.count({ where: { ...base, readAt: null } }),
  ]);

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      severity: n.severity,
      title: n.title,
      body: n.body,
      entity: n.entity,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      at: n.createdAt.toISOString(),
      meta: n.meta,
    })),
  });
}

/** POST /api/notifications — { action: 'read', id } | { action: 'read_all' } | { action: 'create_reminder' }. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!canViewReminders(session)) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Unauthorized to modify administrative notifications' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { action, id } = body;

  if (action === 'read' && id) {
    await prisma.notification.updateMany({
      where: { id, outletId: session.outletId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'read_all') {
    await prisma.notification.updateMany({
      where: { outletId: session.outletId, audience: 'owner', readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'create_reminder') {
    const title = String(body.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

    const noteBody = body.body ? String(body.body).trim() : null;
    const severity = ['info', 'warn', 'critical'].includes(body.severity) ? body.severity : 'info';
    const dueDate = body.dueDate ? new Date(body.dueDate).toISOString() : null;

    const notif = await prisma.notification.create({
      data: {
        outletId: session.outletId,
        type: 'reminder',
        severity,
        title,
        body: noteBody,
        audience: 'owner',
        meta: {
          dueDate,
          createdById: session.staffId,
          createdByName: session.name,
          reminder: true,
        },
      },
    });

    await publish(session.outletId, {
      type: 'notify',
      notification: {
        id: notif.id,
        type: 'reminder',
        severity: notif.severity,
        title: notif.title,
        body: notif.body,
        at: notif.createdAt.getTime(),
        audience: 'owner',
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, reminder: notif });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

