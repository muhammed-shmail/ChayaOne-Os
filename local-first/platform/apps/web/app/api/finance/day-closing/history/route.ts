import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/day-closing/history
 * Query parameters:
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 * - search: string
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search')?.trim().toLowerCase();

  const whereClause: any = {
    outletId: session.outletId,
  };

  if (startDate && endDate) {
    whereClause.businessDate = {
      gte: startDate,
      lte: endDate,
    };
  } else if (startDate) {
    whereClause.businessDate = { gte: startDate };
  } else if (endDate) {
    whereClause.businessDate = { lte: endDate };
  }

  try {
    const records = await prisma.dayClosing.findMany({
      where: whereClause,
      orderBy: { businessDate: 'desc' },
      include: {
        closedBy: { select: { id: true, name: true, role: true } },
      },
    });

    const filtered = search
      ? records.filter(
          (r) =>
            r.closingNumber.toLowerCase().includes(search) ||
            r.businessDate.includes(search) ||
            (r.closedByName && r.closedByName.toLowerCase().includes(search))
        )
      : records;

    const formatted = filtered.map((r) => ({
      id: r.id,
      date: r.businessDate,
      closingId: r.closingNumber,
      totalSalesPaise: r.grossSalesPaise,
      netSalesPaise: r.netSalesPaise,
      cashPaise: r.cashSalesPaise,
      upiPaise: r.upiSalesPaise,
      cardPaise: r.cardSalesPaise,
      otherPaise: r.otherSalesPaise,
      expensesPaise: r.cashExpensesPaise,
      variancePaise: r.cashVariancePaise,
      varianceReason: r.varianceReason,
      tomorrowOpeningCashPaise: r.tomorrowOpeningCashPaise,
      cashRemovedPaise: r.cashRemovedPaise,
      cashDepositDestination: r.cashDepositDestination,
      closedBy: r.closedByName || r.closedBy?.name || 'Manager',
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
      status: r.status,
      notes: r.notes,
    }));

    return NextResponse.json({
      ok: true,
      records: formatted,
    });
  } catch (err: any) {
    console.error('Day Closing History error:', err);
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
