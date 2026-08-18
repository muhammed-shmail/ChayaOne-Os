import { NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { isLocalRuntime } from '@/lib/realtime';
import { getLocalWSServerSingleton } from '@/lib/realtime/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — Local server, database, and realtime health check endpoint.
 */
export async function GET() {
  const cfg = getRuntimeConfig();
  let dbStatus = 'ok';
  let printQueuePending = 0;
  let printQueueFailed = 0;
  let syncOutboxPending = 0;
  let syncOutboxFailed = 0;

  try {
    // Quick ping to PostgreSQL database
    await prisma.$queryRaw`SELECT 1`;

    // Query non-sensitive queue depth counters
    printQueuePending = await prisma.printJob.count({ where: { status: 'QUEUED' } });
    printQueueFailed = await prisma.printJob.count({ where: { status: 'FAILED' } });
    syncOutboxPending = await prisma.syncOutbox.count({ where: { status: 'PENDING' } });
    syncOutboxFailed = await prisma.syncOutbox.count({ where: { status: 'FAILED' } });
  } catch (err) {
    dbStatus = 'error';
  }

  let realtimeStatus = 'ok';
  if (isLocalRuntime()) {
    const wsServer = getLocalWSServerSingleton();
    realtimeStatus = wsServer.isRunning() ? 'ok' : 'idle';
  }

  return NextResponse.json({
    server: 'ok',
    database: dbStatus,
    realtime: realtimeStatus,
    printQueuePending,
    printQueueFailed,
    syncOutboxPending,
    syncOutboxFailed,
    runtime: cfg.mode,
  });
}
