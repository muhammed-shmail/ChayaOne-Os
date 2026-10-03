import { NextResponse } from 'next/server';
import os from 'os';
import { prisma } from '@cafeos/db';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { isCloudSyncEnabled } from '@/lib/sync/worker';
import { getActiveTunnelInfo } from '@/lib/tunnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  const candidates: { name: string; address: string; priority: number }[] = [];

  for (const name of Object.keys(interfaces)) {
    const lower = name.toLowerCase();
    if (lower.includes('vmware') || lower.includes('virtual') || lower.includes('vethernet') || lower.includes('wsl')) {
      continue;
    }

    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        let priority = 10;
        if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wlan') || lower.includes('wireless')) {
          priority = 100;
        } else if (lower.includes('ethernet') || lower.includes('eth') || lower.includes('en')) {
          priority = 80;
        }
        candidates.push({ name, address: iface.address, priority });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.address || '127.0.0.1';
}

/**
 * GET /api/server/info — Returns local server IP, system health, and staff LAN pairing details.
 */
export async function GET() {
  const cfg = getRuntimeConfig();
  const localIp = getLocalIpAddress();
  const port = process.env.PORT || '3000';
  const tunnel = getActiveTunnelInfo();
  const publicUrl = tunnel.publicUrl;
  const qrUrl = publicUrl ? `${publicUrl}/app?t=demo` : `http://${localIp}:${port}/login`;
  const customerQrBaseUrl = publicUrl ? `${publicUrl}/app?t=` : `http://${localIp}:${port}/app?t=`;

  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  if (!dbHealthy) {
    return NextResponse.json(
      {
        status: 'starting',
        message: 'Database is still initializing',
        dbHealthy: false,
      },
      {
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      }
    );
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
    customerQrBaseUrl,
    tunnel: {
      active: tunnel.active,
      publicUrl: tunnel.publicUrl,
      mode: tunnel.mode || 'none',
    },
    serverStatus: 'running',
    health: {
      server: 'ok',
      database: dbHealthy ? 'ok' : 'error',
      realtime: 'ok',
      printService: 'ok',
      syncOutbox: isCloudSyncEnabled() ? 'cloud_active' : 'local_only',
      tunnel: tunnel.active ? 'active' : 'offline',
    },
    metrics: {
      pendingOutbox: pendingOutboxCount,
      queuedPrintJobs: queuedPrintCount,
    },
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
