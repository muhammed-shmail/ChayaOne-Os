import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/day-closing/[id]
 * Returns full snapshot for viewing and printable report generation.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = params;

  try {
    const closing = await prisma.dayClosing.findUnique({
      where: { id },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
            gstin: true,
            stateCode: true,
            timezone: true,
          },
        },
        closedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!closing || closing.outletId !== session.outletId) {
      return NextResponse.json({ error: 'CLOSING_NOT_FOUND' }, { status: 404 });
    }

    // Also fetch shifts and expenses for this business day
    const shifts = await prisma.cashShift.findMany({
      where: { outletId: closing.outletId, businessDate: closing.businessDate },
    });

    const expenses = await prisma.expense.findMany({
      where: { outletId: closing.outletId, businessDate: closing.businessDate },
    });

    return NextResponse.json({
      ok: true,
      report: {
        ...closing,
        shifts,
        expenses,
      },
    });
  } catch (err: any) {
    console.error('Day Closing detail error:', err);
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
