import { NextRequest, NextResponse } from 'next/server';
import { prisma, DeviceStatus, DeviceRole, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/devices — Returns all registered client devices for the session's outlet.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const devices = await prisma.device.findMany({
    where: { outletId: session.outletId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      deviceId: true,
      name: true,
      role: true,
      status: true,
      ipAddress: true,
      userAgent: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ devices });
}

/**
 * PATCH /api/devices — Update device parameters or toggle status (e.g., DISABLE device).
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, name, status, role } = body;

  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || device.outletId !== session.outletId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const data: Prisma.DeviceUpdateInput = {};
  if (name && typeof name === 'string') data.name = name.trim();
  if (status && ['ONLINE', 'OFFLINE', 'DISABLED', 'PENDING_PAIRING'].includes(status)) {
    data.status = status as DeviceStatus;
    if (status === 'DISABLED') {
      data.deviceToken = null; // Revoke token immediately
    }
  }
  if (role && ['POS', 'KDS', 'WAITER', 'STAFF', 'DISPLAY'].includes(role)) {
    data.role = role as DeviceRole;
  }

  const updated = await prisma.device.update({
    where: { id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      outletId: session.outletId,
      actorId: session.staffId,
      action: status === 'DISABLED' ? 'device.disabled' : 'device.updated',
      entity: 'device',
      entityId: id,
      after: { name: updated.name, status: updated.status, role: updated.role } as Prisma.InputJsonValue,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, device: updated });
}

/**
 * DELETE /api/devices — Revoke & remove device registration.
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body;

  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || device.outletId !== session.outletId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await prisma.device.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      outletId: session.outletId,
      actorId: session.staffId,
      action: 'device.revoked',
      entity: 'device',
      entityId: id,
      after: { name: device.name, deviceId: device.deviceId } as Prisma.InputJsonValue,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, id });
}
