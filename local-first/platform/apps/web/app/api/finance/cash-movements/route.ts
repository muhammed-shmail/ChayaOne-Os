import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { formatYmdInTz, DEFAULT_TIMEZONE, readBusinessDay } from '@/lib/businessDay';
import { FinancialYearService } from '@/lib/services/financial-year.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const businessDate = searchParams.get('date');

  const whereClause: any = { outletId: session.outletId };
  if (businessDate) whereClause.businessDate = businessDate;

  try {
    const movements = await prisma.cashMovement.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ ok: true, movements });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, category, amountPaise, reason, destination, destAccount, reference } = body;

  if (!type || typeof amountPaise !== 'number' || amountPaise <= 0) {
    return NextResponse.json({ error: 'invalid_movement_data' }, { status: 400 });
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { settings: true, timezone: true },
  });
  const tz = outlet?.timezone || DEFAULT_TIMEZONE;
  const bState = readBusinessDay(outlet?.settings, new Date(), tz);
  const businessDate = bState.currentBusinessDate || formatYmdInTz(new Date(), tz);

  try {
    await FinancialYearService.assertDateNotLocked(session.tenantId, session.outletId, businessDate);

    const movement = await prisma.cashMovement.create({
      data: {
        outletId: session.outletId,
        staffId: session.staffId,
        staffName: session.name,
        businessDate,
        type, // 'inflow' | 'outflow'
        category: category || (type === 'inflow' ? 'cash_in' : 'cash_out'),
        amountPaise,
        reason: reason || null,
        destination: destination || null,
        destAccount: destAccount || null,
        reference: reference || null,
      },
    });

    return NextResponse.json({ ok: true, movement });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
