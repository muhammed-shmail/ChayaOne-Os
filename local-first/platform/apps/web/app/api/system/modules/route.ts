import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getModuleConfig, getModuleStatePayload } from '@/lib/modules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const outletId = session?.outletId;

  // If owner/manager requests, return full administrative payload including all module metadata and presets
  if (session && (session.role === 'owner' || session.role === 'manager')) {
    const payload = await getModuleStatePayload(outletId);
    return NextResponse.json(payload);
  }

  // Otherwise return active config
  const config = await getModuleConfig(outletId);
  return NextResponse.json({
    businessType: config.businessType,
    enabledModules: config.enabledModules,
    version: config.version,
  });
}
