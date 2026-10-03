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
    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ ok: true, expenses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { category, vendor, amountPaise, gstPaise, method, notes, reference } = body;

  if (!category || typeof amountPaise !== 'number' || amountPaise <= 0) {
    return NextResponse.json({ error: 'invalid_expense_data' }, { status: 400 });
  }

  const customDate = typeof body.businessDate === 'string' && body.businessDate.trim()
    ? body.businessDate.trim()
    : typeof body.date === 'string' && body.date.trim()
    ? body.date.trim()
    : null;

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { settings: true, timezone: true },
  });
  const tz = outlet?.timezone || DEFAULT_TIMEZONE;
  const bState = readBusinessDay(outlet?.settings, new Date(), tz);
  const businessDate = customDate || bState.currentBusinessDate || formatYmdInTz(new Date(), tz);

  try {
    await FinancialYearService.assertDateNotLocked(session.tenantId, session.outletId, businessDate);

    const expense = await prisma.expense.create({
      data: {
        outletId: session.outletId,
        businessDate,
        category,
        vendor: vendor || null,
        amountPaise,
        gstPaise: gstPaise || 0,
        method: method || 'cash',
        status: 'approved',
        approvedBy: session.name,
        createdById: session.staffId,
        notes: notes || null,
        reference: reference || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'expense.created',
        entity: 'expense',
        entityId: expense.id,
        after: {
          category: expense.category,
          vendor: expense.vendor,
          amountPaise: expense.amountPaise,
          method: expense.method,
          businessDate: expense.businessDate,
        },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, expense });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
