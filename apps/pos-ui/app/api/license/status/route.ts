import { NextResponse } from 'next/server';
import { LicenseService } from '@/lib/license/license-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/license/status — Returns current license status, days remaining, warnings, and hardware installation ID.
 */
export async function GET() {
  try {
    const status = await LicenseService.getStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'failed_to_check_license', message: err?.message || 'Error checking license status.' },
      { status: 500 }
    );
  }
}
