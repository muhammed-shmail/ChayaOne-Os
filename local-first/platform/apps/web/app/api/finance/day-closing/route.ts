import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma, Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canManageDayClosing, canCloseDay } from '@/lib/rbac';
import { DayClosingService } from '@/lib/services';
import {
  DayClosingCommitSchema,
  DayClosingVerifyCashSchema,
  DayClosingReopenSchema,
  DayClosingAdjustSchema,
  ForceCloseShiftSchema,
} from '@cafeos/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/day-closing
 * Query params: ?date=YYYY-MM-DD (optional, defaults to current business day)
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetDate = searchParams.get('date') || undefined;

  try {
    const summary = await DayClosingService.calculateDaySummary(session.outletId, targetDate);
    const userCanManage = canManageDayClosing(session);
    const userCanClose = canCloseDay(session);

    return NextResponse.json({
      ok: true,
      data: summary,
      userRole: session.role,
      userCanManage,
      userCanClose,
    });
  } catch (err: any) {
    console.error('Error fetching day closing summary:', err);
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * POST /api/finance/day-closing
 * Actions:
 * - verify_cash
 * - close_day
 * - reopen_day
 * - adjust
 * - force_close_shift
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const currentOutletId = session.outletId;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  // Helper to authenticate manager role or manager PIN
  async function verifyManagerAuthority(managerPin?: string): Promise<{ authorized: boolean; staff?: any }> {
    if (canCloseDay(session)) {
      return { authorized: true, staff: session };
    }

    if (managerPin) {
      const pinHash = createHash('sha256').update(managerPin.trim()).digest('hex');
      const managerUser = await prisma.staffUser.findFirst({
        where: {
          outletId: currentOutletId,
          OR: [{ pinHash }, { pinHash: managerPin.trim() }],
          role: { in: ['owner', 'manager'] },
          active: true,
        },
      });
      if (managerUser) {
        return { authorized: true, staff: managerUser };
      }
    }

    return { authorized: false };
  }

  try {
    if (action === 'verify_cash') {
      const parsed = DayClosingVerifyCashSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
      }

      const { businessDate, actualCashPaise, varianceReason, varianceNote, denominations } = parsed.data;

      // Upsert in-progress DayClosing record with counted cash
      const closing = await prisma.dayClosing.upsert({
        where: { outletId_businessDate: { outletId: currentOutletId, businessDate } },
        create: {
          outletId: currentOutletId,
          businessDate,
          closingNumber: `DRAFT-${businessDate}`,
          status: 'in_progress',
          actualCashPaise,
          varianceReason: varianceReason || null,
          varianceNote: varianceNote || null,
          denominations: (denominations as any) ?? Prisma.JsonNull,
        },
        update: {
          actualCashPaise,
          varianceReason: varianceReason || null,
          varianceNote: varianceNote || null,
          denominations: (denominations as any) ?? Prisma.JsonNull,
          status: 'in_progress',
        },
      });

      return NextResponse.json({ ok: true, closing });
    }

    if (action === 'close_day') {
      const parsed = DayClosingCommitSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
      }

      // Check manager permission
      const auth = await verifyManagerAuthority(parsed.data.managerPin);
      if (!auth.authorized) {
        return NextResponse.json(
          {
            error: 'forbidden',
            message: 'Only Manager, Owner or Admin can close the business day. Please provide a valid Manager PIN.',
          },
          { status: 403 }
        );
      }

      const actingStaff = auth.staff;
      const closed = await DayClosingService.closeBusinessDay({
        outletId: session.outletId,
        staffId: actingStaff.id || session.staffId,
        staffName: actingStaff.name || session.name,
        staffRole: actingStaff.role || session.role,
        input: parsed.data,
      });

      return NextResponse.json({
        ok: true,
        message: 'Business day closed successfully.',
        closing: closed,
      });
    }

    if (action === 'reopen_day') {
      const parsed = DayClosingReopenSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
      }

      const auth = await verifyManagerAuthority(parsed.data.managerPin);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: 'forbidden', message: 'Manager or Owner authorization required to reopen business day.' },
          { status: 403 }
        );
      }

      const actingStaff = auth.staff;
      const reopened = await DayClosingService.reopenBusinessDay({
        outletId: session.outletId,
        businessDate: parsed.data.businessDate,
        staffId: actingStaff.id || session.staffId,
        staffName: actingStaff.name || session.name,
        reason: parsed.data.reason,
      });

      return NextResponse.json({
        ok: true,
        message: 'Business day reopened.',
        closing: reopened,
      });
    }

    if (action === 'adjust') {
      const parsed = DayClosingAdjustSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
      }

      const auth = await verifyManagerAuthority(parsed.data.managerPin);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: 'forbidden', message: 'Manager or Owner authorization required to adjust financial records.' },
          { status: 403 }
        );
      }

      const actingStaff = auth.staff;
      const adjusted = await DayClosingService.adjustDayClosing({
        closingId: parsed.data.closingId,
        staffId: actingStaff.id || session.staffId,
        staffName: actingStaff.name || session.name,
        field: parsed.data.field,
        beforeValue: parsed.data.beforeValue,
        afterValue: parsed.data.afterValue,
        reason: parsed.data.reason,
      });

      return NextResponse.json({
        ok: true,
        message: 'Day Closing adjusted successfully.',
        closing: adjusted,
      });
    }

    if (action === 'force_close_shift') {
      const parsed = ForceCloseShiftSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
      }

      const auth = await verifyManagerAuthority(parsed.data.managerPin);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: 'forbidden', message: 'Manager authorization required to force-close cashier shift.' },
          { status: 403 }
        );
      }

      const actingStaff = auth.staff;
      const shift = await DayClosingService.forceCloseShift({
        shiftId: parsed.data.shiftId,
        outletId: session.outletId,
        staffId: actingStaff.id || session.staffId,
        staffName: actingStaff.name || session.name,
        actualCashPaise: parsed.data.actualCashPaise,
        varianceReason: parsed.data.varianceReason,
        notes: parsed.data.notes,
      });

      return NextResponse.json({
        ok: true,
        message: 'Shift closed successfully.',
        shift,
      });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err: any) {
    console.error('Day Closing API error:', err);
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 400 });
  }
}
