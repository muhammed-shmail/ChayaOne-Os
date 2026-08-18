import { NextRequest, NextResponse } from 'next/server';
import { prisma, PrintJobType } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { processPrintQueueBatch, createPrintJob } from '@/lib/print/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/print/jobs
 * Returns print queue metrics for the session outlet.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const counts = await prisma.printJob.groupBy({
    where: { outletId: session.outletId },
    by: ['status'],
    _count: { id: true },
  });

  const statusMap: Record<string, number> = {
    QUEUED: 0,
    PRINTING: 0,
    PRINTED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };

  counts.forEach((c) => {
    statusMap[c.status] = c._count.id;
  });

  const recentJobs = await prisma.printJob.findMany({
    where: { outletId: session.outletId },
    orderBy: { sequenceNo: 'desc' },
    take: 15,
    select: {
      id: true,
      jobId: true,
      orderId: true,
      stationId: true,
      jobType: true,
      status: true,
      attempts: true,
      createdAt: true,
      printedAt: true,
      lastError: true,
    },
  });

  return NextResponse.json({
    counts: statusMap,
    totalQueued: (statusMap.QUEUED ?? 0) + (statusMap.PRINTING ?? 0),
    recentJobs,
  });
}

/**
 * POST /api/print/jobs
 * Triggers an immediate print queue batch run or dispatches a manual print job.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.action === 'trigger') {
    const result = await processPrintQueueBatch(body.batchSize || 10);
    return NextResponse.json({ ok: true, result });
  }

  if (body.jobType && body.payload) {
    const jobType = body.jobType as PrintJobType;
    const job = await prisma.$transaction(async (tx) => {
      return await createPrintJob(tx, {
        tenantId: session.tenantId,
        outletId: session.outletId,
        orderId: body.orderId ?? null,
        stationId: body.stationId ?? null,
        jobType,
        payload: body.payload,
      });
    });

    // Trigger queue processing asynchronously
    processPrintQueueBatch().catch(() => {});

    return NextResponse.json({ ok: true, job });
  }

  return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
}
