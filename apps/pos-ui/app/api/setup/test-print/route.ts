import { NextRequest, NextResponse } from 'next/server';
import { PrintService } from '@/lib/services/print.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/setup/test-print — Test connection and print sample ticket to thermal printer.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { ip, port = 9100 } = body;
  if (!ip || typeof ip !== 'string') {
    return NextResponse.json({ ok: false, error: 'Valid Printer IP is required' }, { status: 400 });
  }

  const result = await PrintService.testPrinterConnection(ip.trim(), Number(port) || 9100);
  return NextResponse.json(result);
}
