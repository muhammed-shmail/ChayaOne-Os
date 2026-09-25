import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const outlet = await prisma.outlet.findFirst({
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
