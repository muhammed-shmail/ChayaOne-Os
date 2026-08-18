import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { prisma, DeviceRole } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { generatePairingCode } from '@/lib/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * GET /api/devices/pairing
 * Returns active pairing code for the staff session outlet.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const activeCode = await prisma.devicePairingCode.findFirst({
    where: {
      outletId: session.outletId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  const localIp = getLocalIpAddress();
  const port = process.env.PORT || '3000';

  return NextResponse.json({
    activeCode: activeCode
      ? {
          code: activeCode.code,
          targetRole: activeCode.targetRole,
          expiresAt: activeCode.expiresAt,
          pairingUrl: `http://${localIp}:${port}/pair?code=${activeCode.code}`,
        }
      : null,
  });
}

/**
 * POST /api/devices/pairing
 * Generates a new 6-digit pairing code for adding a client device.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetRole = (['POS', 'KDS', 'WAITER', 'STAFF', 'DISPLAY'].includes(body.targetRole)
    ? body.targetRole
    : 'POS') as DeviceRole;

  const pairingCode = await generatePairingCode({
    tenantId: session.tenantId,
    outletId: session.outletId,
    targetRole,
  });

  const localIp = getLocalIpAddress();
  const port = process.env.PORT || '3000';

  return NextResponse.json({
    ok: true,
    code: pairingCode.code,
    targetRole: pairingCode.targetRole,
    expiresAt: pairingCode.expiresAt,
    pairingUrl: `http://${localIp}:${port}/pair?code=${pairingCode.code}`,
  });
}
