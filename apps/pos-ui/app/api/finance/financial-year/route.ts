import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { FinancialYearService } from '@/lib/services/financial-year.service';
import { FinancialYearCreateSchema, FinancialYearCloseSchema } from '@cafeos/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/financial-year
 * Query params: ?date=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetDate = searchParams.get('date') || undefined;

  try {
    const financialYears = await FinancialYearService.listFinancialYears(session.tenantId, session.outletId);
    const activeFinancialYear = await FinancialYearService.getActiveFinancialYear(session.tenantId, session.outletId, targetDate);

    return NextResponse.json({
      ok: true,
      financialYears,
      activeFinancialYear,
    });
  } catch (err: any) {
    console.error('Error fetching financial years:', err);
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * POST /api/finance/financial-year
 * Create a new Financial Year
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Only owner, manager, or accountant can configure financial years
  const role = session.role?.toLowerCase();
  if (role !== 'owner' && role !== 'manager' && role !== 'admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only Owners or Managers can configure Financial Years.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = FinancialYearCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await FinancialYearService.createFinancialYear(
      session.tenantId,
      session.outletId,
      parsed.data
    );

    return NextResponse.json({ ok: true, financialYear: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 400 });
  }
}

/**
 * PATCH /api/finance/financial-year
 * Action: 'close' | 'reopen' | 'update'
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const role = session.role?.toLowerCase();
  if (role !== 'owner' && role !== 'manager' && role !== 'admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only Owners or Managers can close, reopen, or modify Financial Years.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  try {
    if (action === 'close' || action === 'reopen') {
      const parsed = FinancialYearCloseSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
      }

      const { id } = parsed.data;
      let result;
      if (action === 'close') {
        result = await FinancialYearService.closeFinancialYear(session.tenantId, id, {
          id: session.staffId,
          name: session.name,
          role: session.role,
        });
      } else {
        result = await FinancialYearService.reopenFinancialYear(session.tenantId, id, {
          id: session.staffId,
          name: session.name,
          role: session.role,
        });
      }

      return NextResponse.json({ ok: true, financialYear: result });
    }

    if (action === 'update') {
      const id = body.id;
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

      const updated = await FinancialYearService.updateFinancialYear(session.tenantId, id, body);
      return NextResponse.json({ ok: true, financialYear: updated });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 400 });
  }
}
