import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeviceService } from '@/lib/services';
import type { DeviceStatus, DeviceRole } from '@cafeos/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/devices — Returns all registered client devices for the session's outlet.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const devices = await DeviceService.getDevices(session.outletId);
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

  try {
    const updated = await DeviceService.updateDevice(
      id,
      session.outletId,
      {
        name,
        status: status as DeviceStatus,
        role: role as DeviceRole,
      },
      session.staffId
    );

    return NextResponse.json({ ok: true, device: updated });
  } catch (err: any) {
    if (err?.message === 'DEVICE_NOT_FOUND') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
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

  try {
    await DeviceService.removeDevice(id, session.outletId, session.staffId);
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    if (err?.message === 'DEVICE_NOT_FOUND') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
