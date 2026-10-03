import { NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const history = await prisma.systemUpdateHistory.findMany({
      orderBy: { installedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      history,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch update history' }, { status: 500 });
  }
}
