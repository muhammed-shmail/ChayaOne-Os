import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, type Prisma } from '@cafeos/db';
import { readDevices } from '@/lib/devices';
import { ModuleService } from '@/lib/services/module.service';
import { BUSINESS_PRESETS, MODULE_REGISTRY, resolveModulesForBusinessTypes } from '@cafeos/core';
import type { BusinessTypeId, ModuleId, LicensePeriod } from '@cafeos/types';
import { LicenseService } from '@/lib/license/license-service';
import { getInstallationId } from '@/lib/license/installation';
import { hashPassword } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashPin(pin: string): string {
  const salt = 'chayaone-pin-salt';
  return crypto.pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('hex');
}

/**
 * GET /api/setup — Check if ChayaOne local cafe setup has been completed, provide presets and license status.
 */
export async function GET() {
  const staffCount = await prisma.staffUser.count().catch(() => 0);
  const tenant = await prisma.tenant.findFirst({
    select: { id: true, name: true, subdomain: true },
  }).catch(() => null);

  const licenseStatus = await LicenseService.getStatus().catch(() => null);
  const installationId = getInstallationId();

  return NextResponse.json({
    isConfigured: staffCount > 0 && !!tenant && !!licenseStatus && !licenseStatus.isExpired,
    tenant,
    installationId,
    licenseStatus,
    businessPresets: BUSINESS_PRESETS,
    moduleRegistry: MODULE_REGISTRY,
  });
}

/**
 * POST /api/setup — Complete first-time cafe setup wizard with business type, module activation, and commercial license.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    cafeName,
    subdomain,
    businessType = 'cafe',
    businessTypes,
    enabledModules,
    ownerName = 'Owner',
    ownerUsername = 'owner',
    ownerPassword,
    ownerPin,
    teamUsername = 'manager',
    teamPassword,
    managerPin = '4444',
    defaultPrinterIp,
    licensePeriod = '3_months',
    adminPassphrase,
    offlineToken,
    customStartDate,
    customEndDate,
  } = body;

  if (!cafeName) {
    return NextResponse.json({ error: 'missing_fields', message: 'Business name is required.' }, { status: 400 });
  }

  const effectiveOwnerPin = ownerPin && /^\d{4}$/.test(String(ownerPin)) ? String(ownerPin) : '1111';
  const effectiveManagerPin = managerPin && /^\d{4}$/.test(String(managerPin)) ? String(managerPin) : '4444';

  const slug = (subdomain || cafeName).toLowerCase().replace(/[^a-z0-9]/g, '') || 'chayaone';

  let createdTenantId = '';
  let createdOutletId = '';

  await prisma.$transaction(async (tx) => {
    // 1. Find or create Tenant
    let tenant = await tx.tenant.findFirst({ where: { subdomain: slug } });
    if (!tenant) {
      tenant = await tx.tenant.create({
        data: {
          name: cafeName,
          subdomain: slug,
          plan: 'pro',
        },
      });
    } else {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { name: cafeName },
      });
    }

    createdTenantId = tenant.id;

    // 2. Find or create Outlet
    let outlet = await tx.outlet.findFirst({ where: { tenantId: tenant.id } });
    const currentSettings = (outlet?.settings as Record<string, unknown>) ?? {};

    // Configure default printer IP if provided
    let devices = readDevices(currentSettings);
    if (defaultPrinterIp && defaultPrinterIp.trim()) {
      devices = [
        {
          id: 'dev-kitchen-1',
          name: 'Main Kitchen Printer',
          type: 'kot_printer',
          connection: 'network',
          target: `${defaultPrinterIp.trim()}:9100`,
          station: 'kitchen',
          copies: 1,
          isDefault: true,
        },
        {
          id: 'dev-receipt-1',
          name: 'POS Receipt Printer',
          type: 'receipt_printer',
          connection: 'network',
          target: `${defaultPrinterIp.trim()}:9100`,
          station: null,
          copies: 1,
          isDefault: true,
        },
      ];
    }

    const updatedSettings = {
      ...currentSettings,
      devices,
      kitchenWorkflow: {
        kdsEnabled: true,
        mode: 'hybrid',
        autoPrintKot: true,
        kotCopies: 1,
      },
    };

    if (!outlet) {
      outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: `${cafeName} Main Outlet`,
          settings: updatedSettings as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      await tx.outlet.update({
        where: { id: outlet.id },
        data: { settings: updatedSettings as unknown as Prisma.InputJsonValue },
      });
    }

    createdOutletId = outlet.id;

    // 3. Upsert Owner & Manager Staff Users
    const ownerPinHash = hashPin(effectiveOwnerPin);
    const managerPinHash = hashPin(effectiveManagerPin);
    const ownerPwHash = ownerPassword ? hashPassword(ownerPassword) : hashPassword('cafe1234');
    const teamPwHash = teamPassword ? hashPassword(teamPassword) : hashPassword('manager1234');

    const cleanOwnerUsername = (ownerUsername || 'owner').toLowerCase().trim();
    const cleanTeamUsername = (teamUsername || 'manager').toLowerCase().trim();

    const existingOwner = await tx.staffUser.findFirst({
      where: { tenantId: tenant.id, role: 'owner' },
    });

    if (existingOwner) {
      await tx.staffUser.update({
        where: { id: existingOwner.id },
        data: {
          name: ownerName,
          username: cleanOwnerUsername,
          passwordHash: ownerPwHash,
          pinHash: ownerPinHash,
          outletId: outlet.id,
          active: true,
        },
      });
    } else {
      await tx.staffUser.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          name: ownerName,
          username: cleanOwnerUsername,
          passwordHash: ownerPwHash,
          role: 'owner',
          pinHash: ownerPinHash,
          active: true,
        },
      });
    }

    const existingManager = await tx.staffUser.findFirst({
      where: { tenantId: tenant.id, role: 'manager' },
    });

    if (existingManager) {
      await tx.staffUser.update({
        where: { id: existingManager.id },
        data: {
          username: cleanTeamUsername,
          passwordHash: teamPwHash,
          pinHash: managerPinHash,
          outletId: outlet.id,
          active: true,
        },
      });
    } else {
      await tx.staffUser.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          name: 'Manager',
          username: cleanTeamUsername,
          passwordHash: teamPwHash,
          role: 'manager',
          pinHash: managerPinHash,
          active: true,
        },
      });
    }
  });

  // 4. Apply Multi-Business Preset & Modules via ModuleService
  const activeBusinessTypes: BusinessTypeId[] =
    Array.isArray(businessTypes) && businessTypes.length > 0
      ? businessTypes
      : [businessType as BusinessTypeId];

  const resolvedModules =
    Array.isArray(enabledModules) && enabledModules.length > 0
      ? (enabledModules as ModuleId[])
      : resolveModulesForBusinessTypes(activeBusinessTypes);

  if (createdOutletId) {
    await ModuleService.updateConfig(createdOutletId, {
      businessType: activeBusinessTypes[0] || 'cafe',
      enabledModules: resolvedModules,
    }).catch((err) => console.warn('[SETUP] Error applying modules:', err));
  }

  // 5. Activate License if credentials provided
  let licenseResult = null;
  if (adminPassphrase || offlineToken) {
    licenseResult = await LicenseService.activateLicense({
      businessId: createdTenantId,
      adminPassphrase,
      offlineToken,
      period: (licensePeriod || '3_months') as LicensePeriod,
      customStartDate,
      customEndDate,
      activatedBy: 'setup_wizard',
    });
  }

  return NextResponse.json({
    ok: true,
    isConfigured: true,
    tenantId: createdTenantId,
    outletId: createdOutletId,
    license: licenseResult?.license || null,
    redirectUrl: '/pos',
  });
}
