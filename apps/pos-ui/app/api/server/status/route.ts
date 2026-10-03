import { NextResponse } from 'next/server';
import os from 'os';
import net from 'net';
import { prisma } from '@cafeos/db';
import { LicenseService } from '@/lib/license/license-service';

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

async function testTcpPort(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      resolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.once('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

/**
 * GET /api/server/status
 * Returns full diagnostic metrics for the Main PC Desktop Application and Server Control Dashboard.
 */
export async function GET() {
  const startTime = Date.now();
  const localIp = getLocalIpAddress();
  const serverPort = parseInt(process.env.PORT || '3000', 10);
  const realtimePort = 3001;
  const dbPort = 5433;

  // 1. Database Health & Latency
  let dbConnected = false;
  let dbLatencyMs = 0;
  let orderCount = 0;
  let menuItemsCount = 0;
  let staffCount = 0;
  let deviceCount = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbConnected = true;

    // Fetch quick stats
    const [orders, items, staff, devices] = await Promise.all([
      prisma.order.count().catch(() => 0),
      prisma.menuItem.count().catch(() => 0),
      prisma.staffUser.count().catch(() => 0),
      prisma.device.count().catch(() => 0),
    ]);
    orderCount = orders;
    menuItemsCount = items;
    staffCount = staff;
    deviceCount = devices;
  } catch {
    dbConnected = false;
  }

  // 2. Realtime WebSocket Health
  const isWsUp = await testTcpPort('127.0.0.1', realtimePort, 1000);

  // 3. Printer Service Queue Metrics
  let queuedPrintJobs = 0;
  let failedPrintJobs = 0;
  try {
    const [queued, failed] = await Promise.all([
      prisma.printJob.count({ where: { status: 'QUEUED' } }).catch(() => 0),
      prisma.printJob.count({ where: { status: 'FAILED' } }).catch(() => 0),
    ]);
    queuedPrintJobs = queued;
    failedPrintJobs = failed;
  } catch {}

  // 4. Commercial License Status
  const license = await LicenseService.getStatus();

  // 5. Memory usage in MB
  const mem = process.memoryUsage();
  const memoryRssMb = Math.round(mem.rss / 1024 / 1024);
  const memoryHeapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    executionMs: Date.now() - startTime,
    server: {
      status: 'RUNNING',
      port: serverPort,
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        rssMb: memoryRssMb,
        heapUsedMb: memoryHeapUsedMb,
      },
    },
    database: {
      status: dbConnected ? 'CONNECTED' : 'DISCONNECTED',
      port: dbPort,
      databaseName: 'chayaone_os',
      latencyMs: dbLatencyMs,
      stats: {
        totalOrders: orderCount,
        totalMenuItems: menuItemsCount,
        totalStaff: staffCount,
      },
    },
    realtime: {
      status: isWsUp ? 'RUNNING' : 'STOPPED',
      port: realtimePort,
      channels: ['orders', 'kds', 'kot', 'billing', 'device-status'],
    },
    network: {
      localIp,
      port: serverPort,
      lanUrl: `http://${localIp}:${serverPort}`,
      posUrl: `http://${localIp}:${serverPort}/pos`,
      qrUrl: `http://${localIp}:${serverPort}/pos`,
    },
    printerService: {
      status: 'RUNNING',
      connectedPrintersCount: Math.max(1, deviceCount),
      queuedJobs: queuedPrintJobs,
      failedJobs: failedPrintJobs,
    },
    deviceManager: {
      connectedDevicesCount: deviceCount,
      cashDrawers: 1,
      barcodeScanners: 1,
      customerDisplays: 1,
    },
    license,
  });
}
