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

  try {
    // Quick ping to PostgreSQL database
    await prisma.$queryRaw`SELECT 1`;
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
    runtime: cfg.mode,
  });
}
