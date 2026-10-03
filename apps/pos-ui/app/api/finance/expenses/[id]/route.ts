import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/finance/expenses/:id  — Owner-only expense deletion.
 *
 * The expense is permanently removed.  All financial totals are
 * recalculated client-side by refreshing the expense list, so there
 * are no stale aggregates.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden — owner only' }, { status: 403 });
  }

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  try {
    // Verify the expense belongs to this outlet (prevent cross-tenant deletion)
    const expense = await prisma.expense.findFirst({
      where: { id, outletId: session.outletId },
      select: { id: true, category: true, amountPaise: true, businessDate: true },
    });

    if (!expense) {
      return NextResponse.json({ error: 'expense_not_found' }, { status: 404 });
    }

    await prisma.expense.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'expense.deleted',
        entity: 'expense',
        entityId: id,
        before: {
          category: expense.category,
          amountPaise: expense.amountPaise,
          businessDate: expense.businessDate,
        },
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      deleted: { id, category: expense.category, amountPaise: expense.amountPaise },
    });
  } catch (err: any) {
    console.error('[DELETE /api/finance/expenses/:id]', err);
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
