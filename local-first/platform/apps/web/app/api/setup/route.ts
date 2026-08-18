import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, type Prisma } from '@cafeos/db';
import { readDevices } from '@/lib/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashPin(pin: string): string {
  const salt = 'chayaone-pin-salt';
  return crypto.pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('hex');
}

/**
 * GET /api/setup — Check if ChayaOne local cafe setup has been completed.
 */
export async function GET() {
  const staffCount = await prisma.staffUser.count();
  const tenant = await prisma.tenant.findFirst({
    select: { id: true, name: true, subdomain: true },
  });

  return NextResponse.json({
    isConfigured: staffCount > 0 && !!tenant,
    tenant,
  });
}

/**
 * POST /api/setup — Complete first-time cafe setup wizard.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { cafeName, subdomain, ownerName = 'Owner', ownerPin, managerPin = '4444', defaultPrinterIp } = body;

  if (!cafeName || !ownerPin) {
    return NextResponse.json({ error: 'missing_fields', message: 'Cafe name and Owner PIN are required.' }, { status: 400 });
  }

  if (!/^\d{4}$/.test(String(ownerPin))) {
    return NextResponse.json({ error: 'invalid_pin', message: 'Owner PIN must be exactly 4 digits.' }, { status: 400 });
  }

  const slug = (subdomain || cafeName).toLowerCase().replace(/[^a-z0-9]/g, '');

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
          name: `${cafeName} Main Branch`,
          settings: updatedSettings as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      await tx.outlet.update({
        where: { id: outlet.id },
        data: { settings: updatedSettings as unknown as Prisma.InputJsonValue },
      });
    }

    // 3. Upsert Owner & Manager Staff Users
    const ownerPinHash = hashPin(String(ownerPin));
    const managerPinHash = hashPin(String(managerPin));

    const existingOwner = await tx.staffUser.findFirst({
      where: { tenantId: tenant.id, role: 'owner' },
    });

    if (existingOwner) {
      await tx.staffUser.update({
        where: { id: existingOwner.id },
        data: { name: ownerName, pinHash: ownerPinHash, outletId: outlet.id },
      });
    } else {
      await tx.staffUser.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          name: ownerName,
          role: 'owner',
          pinHash: ownerPinHash,
        },
      });
    }

    const existingManager = await tx.staffUser.findFirst({
      where: { tenantId: tenant.id, role: 'manager' },
    });

    if (!existingManager) {
      await tx.staffUser.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          name: 'Manager',
          role: 'manager',
          pinHash: managerPinHash,
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    isConfigured: true,
    redirectUrl: '/pos',
  });
}
