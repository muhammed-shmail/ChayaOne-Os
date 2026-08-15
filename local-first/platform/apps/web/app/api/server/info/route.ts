import { NextResponse } from 'next/server';
import { getRuntimeConfig } from '@/lib/runtime-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/server/info — Safe, non-sensitive server state information.
 */
export async function GET() {
  const cfg = getRuntimeConfig();

  return NextResponse.json({
    runtime: cfg.mode,
    cloudEnabled: cfg.cloudEnabled,
    database: cfg.database,
    subdomain: cfg.subdomain,
    serverStatus: 'running',
    timestamp: new Date().toISOString(),
  });
}
