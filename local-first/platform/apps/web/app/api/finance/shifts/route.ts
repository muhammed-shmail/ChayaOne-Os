import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { formatYmdInTz, DEFAULT_TIMEZONE, readBusinessDay } from '@/lib/businessDay';

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
    const shifts = await prisma.cashShift.findMany({
      where: whereClause,
      orderBy: { openedAt: 'desc' },
      include: {
        staff: { select: { id: true, name: true, role: true } },
      },
    });
    return NextResponse.json({ ok: true, shifts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'open';

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { settings: true, timezone: true },
  });
  const tz = outlet?.timezone || DEFAULT_TIMEZONE;
  const bState = readBusinessDay(outlet?.settings, new Date(), tz);
  const businessDate = bState.currentBusinessDate || formatYmdInTz(new Date(), tz);

  try {
    if (action === 'open') {
      const openingCashPaise = typeof body.openingCashPaise === 'number' ? body.openingCashPaise : 1500000;
      const shift = await prisma.cashShift.create({
        data: {
          outletId: session.outletId,
          staffId: session.staffId,
          cashierName: session.name,
          businessDate,
          status: 'open',
          openingCashPaise,
        },
      });
      return NextResponse.json({ ok: true, shift });
    }

    if (action === 'close') {
      const shiftId = body.shiftId;
      if (!shiftId) return NextResponse.json({ error: 'shift_id_required' }, { status: 400 });

      const shift = await prisma.cashShift.findUnique({ where: { id: shiftId } });
      if (!shift || shift.outletId !== session.outletId) {
        return NextResponse.json({ error: 'shift_not_found' }, { status: 404 });
      }

      const actualCashPaise = typeof body.actualCashPaise === 'number' ? body.actualCashPaise : 0;
      const expectedCashPaise = shift.expectedCashPaise || (shift.openingCashPaise + shift.cashSalesPaise);
      const cashVariancePaise = actualCashPaise - expectedCashPaise;

      const updated = await prisma.cashShift.update({
        where: { id: shiftId },
        data: {
          status: 'closed',
          closedAt: new Date(),
          actualCashPaise,
          cashVariancePaise,
          varianceReason: body.varianceReason || null,
          notes: body.notes || null,
          denominations: body.denominations || null,
        },
      });

      return NextResponse.json({ ok: true, shift: updated });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
