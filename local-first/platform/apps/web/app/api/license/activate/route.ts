import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { LicenseService } from '@/lib/license/license-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/license/activate — Authenticates admin credentials or offline token, issues signed license.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let {
      businessId,
      adminPassphrase,
      offlineToken,
      period = '1_month',
      licenseType,
      customStartDate,
      customEndDate,
    } = body;

    // If businessId not supplied, attempt to resolve from existing Tenant in DB
    if (!businessId) {
      const tenant = await prisma.tenant.findFirst({ select: { id: true } });
      if (tenant) {
        businessId = tenant.id;
      }
    }

    if (!businessId) {
      // If still not found, generate a persistent fallback businessId
      businessId = '00000000-0000-0000-0000-000000000001';
    }

    const result = await LicenseService.activateLicense({
      businessId,
      adminPassphrase,
      offlineToken,
      period,
      licenseType,
      customStartDate,
      customEndDate,
    });

    if (!result.ok) {
      return NextResponse.json({ error: 'activation_failed', message: result.message }, { status: 401 });
    }

    const currentStatus = await LicenseService.getStatus();

    return NextResponse.json({
      ok: true,
      license: result.license,
      status: currentStatus,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'server_error', message: err?.message || 'Internal server error during license activation.' },
      { status: 500 }
    );
  }
}
