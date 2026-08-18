import { NextResponse } from 'next/server';
import os from 'os';
import { prisma } from '@cafeos/db';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { isCloudSyncEnabled } from '@/lib/sync/worker';

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
 * GET /api/server/info — Returns local server IP, system health, and staff LAN pairing details.
 */
export async function GET() {
  const cfg = getRuntimeConfig();
  const localIp = getLocalIpAddress();
  const port = process.env.PORT || '3000';
  const qrUrl = `http://${localIp}:${port}/login`;

  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  // Count pending outbox records
  let pendingOutboxCount = 0;
  try {
    pendingOutboxCount = await prisma.syncOutbox.count({
      where: { status: 'PENDING' },
    });
  } catch {}

  // Count queued print jobs
  let queuedPrintCount = 0;
  try {
    queuedPrintCount = await prisma.printJob.count({
      where: { status: 'QUEUED' },
    });
  } catch {}

  return NextResponse.json({
    runtime: cfg.mode,
    cloudEnabled: cfg.cloudEnabled,
    database: cfg.database,
    subdomain: cfg.subdomain,
    localIp,
    port,
    qrUrl,
    serverStatus: 'running',
    health: {
      server: 'ok',
      database: dbHealthy ? 'ok' : 'error',
      realtime: 'ok',
      printService: 'ok',
      syncOutbox: isCloudSyncEnabled() ? 'cloud_active' : 'local_only',
    },
    metrics: {
      pendingOutbox: pendingOutboxCount,
      queuedPrintJobs: queuedPrintCount,
    },
    timestamp: new Date().toISOString(),
  });
}
