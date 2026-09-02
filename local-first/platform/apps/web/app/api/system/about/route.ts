import { NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { updateManager } from '@/lib/system/update-manager';
import { getRuntimeConfig } from '@/lib/runtime-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getRuntimeConfig();
  const updateState = updateManager.getState();
  
  let tenantName = 'ChayaOne POS';
  let outletName = 'Main Outlet';
  try {
    const tenant = await prisma.tenant.findFirst({ select: { name: true } });
    if (tenant) tenantName = tenant.name;
    const outlet = await prisma.outlet.findFirst({ select: { name: true } });
    if (outlet) outletName = outlet.name;
  } catch {
    // Ignore db read error
  }

  return NextResponse.json({
    appName: 'ChayaOne OS',
    version: updateState.currentVersion,
    build: '20260905',
    channel: updateState.channel,
    runtimeMode: cfg.mode,
    databaseEngine: 'PostgreSQL 16 (Local Embedded)',
    cafeName: tenantName,
    outletName,
    systemPlatform: process.platform,
    nodeVersion: process.version,
    copyright: '© 2026 Nuro7 / ChayaOne. All rights reserved.',
  });
}
