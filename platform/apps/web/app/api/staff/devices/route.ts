import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A device counts as "online" if its session was seen within this window. The
// staff app's keep-alive refreshes lastSeenAt every ~15 min (and on focus), so
// this is just over that — an active device stays green, a closed one drops off.
const PRESENCE_WINDOW_MS = 16 * 60 * 1000;

/**
 * GET /api/staff/devices — owner/manager view of logged-in staff devices and
 * live presence (derived from StaffSession.lastSeenAt). Grouped by staff.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const now = Date.now();
  const rows = await prisma.staffSession.findMany({
    where: { tenantId: session.tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true, staffId: true, label: true, createdAt: true, lastSeenAt: true,
      staff: { select: { name: true, role: true } },
    },
  });

  // group sessions by staff
  const byStaff = new Map<string, {
    staffId: string; name: string; role: string; online: boolean; lastSeenMs: number;
    devices: { id: string; label: string | null; lastSeenMs: number; createdMs: number; online: boolean; current: boolean }[];
  }>();

  for (const r of rows) {
    const lastSeenMs = r.lastSeenAt.getTime();
    const online = now - lastSeenMs < PRESENCE_WINDOW_MS;
    const device = {
      id: r.id, label: r.label, lastSeenMs, createdMs: r.createdAt.getTime(),
      online, current: r.id === session.sid,
    };
    const g = byStaff.get(r.staffId);
    if (g) {
      g.devices.push(device);
      g.online = g.online || online;
      g.lastSeenMs = Math.max(g.lastSeenMs, lastSeenMs);
    } else {
      byStaff.set(r.staffId, {
        staffId: r.staffId, name: r.staff.name, role: r.staff.role,
        online, lastSeenMs, devices: [device],
      });
    }
  }

  const staff = Array.from(byStaff.values()).sort((a, b) =>
    (Number(b.online) - Number(a.online)) || (b.lastSeenMs - a.lastSeenMs),
  );

  return NextResponse.json({ staff, onlineCount: staff.filter((s) => s.online).length });
}

/** POST /api/staff/devices — { action: 'revoke', sessionId } remote-logout a device. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { action, sessionId } = await req.json().catch(() => ({}));
  if (action !== 'revoke' || !sessionId) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  // Scope to this tenant so an owner can't revoke another tenant's device.
  const res = await prisma.staffSession.updateMany({
    where: { id: sessionId, tenantId: session.tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Stop that device receiving push too, and leave an audit trail. Best-effort.
  await prisma.pushSubscription.deleteMany({ where: { sessionId } }).catch(() => {});
  await prisma.auditLog
    .create({ data: { outletId: session.outletId, actorId: session.staffId, action: 'staff.device_revoked', entity: 'staff_session', entityId: sessionId } })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
