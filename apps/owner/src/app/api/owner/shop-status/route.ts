import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwnerRequest } from '@/lib/api/permissions';
import { prisma } from '@/lib/db';

const HEARTBEAT_STALE_MS = 5 * 60 * 1000; // 5 minutes = offline

/**
 * GET /api/owner/shop-status
 * Returns the online/offline status of each authorized store based on
 * the last device heartbeat (Device.lastSeenAt) and pending sync count
 * from the SyncOutbox.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outletId = sp.get('outletId');

  const auth = await authorizeOwnerRequest(outletId ?? undefined);
  if (!auth.ok) return auth.response;

  const outletIds = outletId ? [outletId] : auth.authorizedOutletIds;

  try {
    const [outlets, devices, syncCounts] = await Promise.all([
      prisma.outlet.findMany({
        where: { id: { in: outletIds } },
        select: { id: true, name: true },
      }),
      prisma.device.findMany({
        where: {
          outletId: { in: outletIds },
          role: 'POS', // The main PC is the POS device
        },
        orderBy: { lastSeenAt: 'desc' },
        select: { outletId: true, lastSeenAt: true, status: true },
      }),
      prisma.syncOutbox.groupBy({
        by: ['outletId'],
        where: {
          outletId: { in: outletIds },
          status: { in: ['PENDING', 'PROCESSING', 'FAILED'] },
        },
        _count: { id: true },
      }),
    ]);

    // Map: outletId → latest device lastSeenAt
    const deviceMap = new Map<string, Date>();
    for (const d of devices) {
      const existing = deviceMap.get(d.outletId);
      if (!existing || d.lastSeenAt > existing) {
        deviceMap.set(d.outletId, d.lastSeenAt);
      }
    }

    const syncMap = new Map<string, number>();
    for (const s of syncCounts) {
      syncMap.set(s.outletId, s._count.id);
    }

    const now = Date.now();
    const data = outlets.map((o) => {
      const lastSeen = deviceMap.get(o.id);
      const isOnline = lastSeen ? (now - lastSeen.getTime()) < HEARTBEAT_STALE_MS : false;
      return {
        storeId:     o.id,
        storeName:   o.name,
        status:      lastSeen ? (isOnline ? 'online' : 'offline') : 'unknown',
        lastSeen:    lastSeen?.toISOString() ?? null,
        pendingSync: syncMap.get(o.id) ?? 0,
      };
    });

    return NextResponse.json({
      data,
      onlineCount: data.filter((d) => d.status === 'online').length,
      total:       data.length,
    });
  } catch (err) {
    console.error('[shop-status]', err);
    return NextResponse.json({ error: 'Failed to load shop status' }, { status: 500 });
  }
}
