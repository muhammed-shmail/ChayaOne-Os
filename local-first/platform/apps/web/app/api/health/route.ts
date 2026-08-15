import { NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getRuntimeConfig } from '@/lib/runtime-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — Local server & database health check endpoint.
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

  return NextResponse.json({
    server: 'ok',
    database: dbStatus,
    runtime: cfg.mode,
  });
}
