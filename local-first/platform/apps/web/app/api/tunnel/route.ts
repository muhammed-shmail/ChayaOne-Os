import { NextResponse } from 'next/server';
import { getActiveTunnelInfo } from '@/lib/tunnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const tunnel = getActiveTunnelInfo();
  return NextResponse.json({
    active: tunnel.active,
    publicUrl: tunnel.publicUrl,
    dashboardUrl: tunnel.publicUrl ? `${tunnel.publicUrl}/dashboard` : null,
    posUrl: tunnel.publicUrl ? `${tunnel.publicUrl}/pos` : null,
    loginUrl: tunnel.publicUrl ? `${tunnel.publicUrl}/login` : null,
    qrOrderUrl: tunnel.qrOrderUrl,
    mode: tunnel.mode,
    startedAt: tunnel.startedAt,
  });
}
