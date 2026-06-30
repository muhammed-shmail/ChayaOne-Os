import { NextResponse } from 'next/server';
import { isPushConfigured } from '@/lib/web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/staff/push/key — the VAPID public key the client subscribes with. */
export function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    key: process.env.WEB_PUSH_PUBLIC_KEY ?? null,
  });
}
