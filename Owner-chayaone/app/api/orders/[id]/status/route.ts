import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const newStatus = body.status || 'settled';

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: newStatus as any,
        ...(newStatus === 'settled' ? { settledAt: new Date() } : {}),
      },
    });

    if (newStatus === 'settled' && body.method) {
      await prisma.payment.create({
        data: {
          orderId: params.id,
          outletId: updated.outletId,
          amountPaise: updated.totalPaise,
          method: body.method,
          status: 'success',
        },
      });
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
