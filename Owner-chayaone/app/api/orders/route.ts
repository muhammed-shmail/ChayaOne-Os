import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const requestedOutlet = req.nextUrl.searchParams.get('outletId');
  const outletId = requestedOutlet || session.outletId;

  const status = req.nextUrl.searchParams.get('status');

  try {
    const orders = await prisma.order.findMany({
      where: {
        outletId,
        ...(status && status !== 'all' ? { status: status as any } : {}),
      },
      orderBy: { placedAt: 'desc' },
      take: 60,
      include: {
        items: true,
        table: true,
        customer: true,
        payments: true,
      },
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
