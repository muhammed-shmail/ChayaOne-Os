import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { resolveTenantIdFromHost } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = await resolveTenantIdFromHost(req.headers.get('host'));
    const where = tenantId ? { tenantId } : {};

    const outlet = await prisma.outlet.findFirst({
      where,
      select: {
        name: true,
        settings: true,
        tenant: { select: { name: true } },
      },
    });

    const businessName = outlet?.tenant?.name || outlet?.name || 'ChayaOne';
    const logoUrl = (outlet?.settings as any)?.logoUrl || null;

    return NextResponse.json({
      name: businessName,
      logoUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ name: 'ChayaOne', logoUrl: null }, { status: 200 });
  }
}
