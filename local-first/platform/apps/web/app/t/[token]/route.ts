import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /t/<qrToken> — the URL encoded in each table's QR sticker.
 * Bounces to the customer PWA with the table context attached.
 */
function getSafeOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '127.0.0.1:3000';
  const effectiveHost = host.startsWith('0.0.0.0') ? host.replace('0.0.0.0', '127.0.0.1') : host;
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${effectiveHost}`;
}

export function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const origin = getSafeOrigin(req);
  const url = new URL('/app', origin);
  url.search = `?t=${encodeURIComponent(params.token)}`;
  return NextResponse.redirect(url);
}

