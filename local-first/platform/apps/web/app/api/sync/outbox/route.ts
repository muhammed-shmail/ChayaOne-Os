import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { processOutboxBatch, isCloudSyncEnabled } from '@/lib/sync/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/outbox
 * Returns current outbox metrics (pending, synced, failed, dead) and system sync status.
 */
export async function GET() {
  const counts = await prisma.syncOutbox.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const statusMap: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SYNCED: 0,
    FAILED: 0,
    DEAD: 0,
  };

  counts.forEach((c) => {
    statusMap[c.status] = c._count.id;
  });

  const recentEvents = await prisma.syncOutbox.findMany({
    orderBy: { sequenceNo: 'desc' },
    take: 10,
    select: {
      id: true,
      eventId: true,
      entityType: true,
      entityId: true,
      operation: true,
      status: true,
      attempts: true,
      createdAt: true,
      processedAt: true,
      lastError: true,
    },
  });

  return NextResponse.json({
    cloudSyncEnabled: isCloudSyncEnabled(),
    counts: statusMap,
    totalQueued: (statusMap.PENDING ?? 0) + (statusMap.FAILED ?? 0),
    recentEvents,
  });
}

/**
 * POST /api/sync/outbox
 * Triggers an immediate sync worker batch drain.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const batchSize = body.batchSize || 50;

  const result = await processOutboxBatch(batchSize);

  return NextResponse.json({
    ok: true,
    result,
  });
}
