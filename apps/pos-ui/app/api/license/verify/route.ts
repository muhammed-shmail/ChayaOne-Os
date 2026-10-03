import { NextResponse } from 'next/server';
import { LicenseService } from '@/lib/license/license-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/license/verify — Re-verifies local license and refreshes clock/monotonic watermark.
 */
export async function POST() {
  try {
    LicenseService.invalidateCache();
    const status = await LicenseService.getStatus();
    return NextResponse.json({
      ok: !status.isExpired && !status.clockTampered,
      status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'verification_failed', message: err?.message || 'Failed to verify license.' },
      { status: 500 }
    );
  }
}
