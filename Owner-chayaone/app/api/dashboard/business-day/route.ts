import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import {
  readBusinessDay,
  canManageBusinessDay,
  shouldPromptBusinessDayExtension,
  formatYmdInTz,
  DEFAULT_TIMEZONE,
  type BusinessDayState,
} from '@/lib/businessDay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/business-day
 *
 * Returns live business day status for the active outlet, whether the user
 * can manage it (manager/owner only), and if a midnight/closing prompt is due.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { settings: true, timezone: true },
  });

  const tz = outlet?.timezone || DEFAULT_TIMEZONE;
  const state = readBusinessDay(outlet?.settings, new Date(), tz);
  const canManage = canManageBusinessDay(session);
  const shouldPrompt = shouldPromptBusinessDayExtension(state, new Date(), tz);

  return NextResponse.json({
    ok: true,
    state,
    canManage,
    shouldPrompt,
    timezone: tz,
  });
}

/**
 * POST /api/dashboard/business-day
 *
 * Actions:
 * - { action: 'extend', durationMinutes?: number } (Manager / Owner only)
 * - { action: 'close_day' } (Manager / Owner only)
 * - { action: 'configure', closingTime?, cutoffHour?, autoPromptAtMidnight? } (Manager / Owner only)
 * - { action: 'dismiss_prompt' } (Any staff)
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { settings: true, timezone: true },
  });
  if (!outlet) return NextResponse.json({ error: 'outlet_not_found' }, { status: 404 });

  const tz = outlet.timezone || DEFAULT_TIMEZONE;
  const currentSettings = ((outlet.settings as Record<string, any>) ?? {});
  const currentState = readBusinessDay(currentSettings, new Date(), tz);
  const userCanManage = canManageBusinessDay(session);

  // Dismiss prompt is allowed for all staff (e.g. snooze on cashier till)
  if (action === 'dismiss_prompt') {
    return NextResponse.json({ ok: true, dismissed: true });
  }

  // All management actions require Manager or Owner role!
  if (!userCanManage) {
    // Check if manager PIN was provided for override
    const managerPin = String(body.managerPin || '').trim();
    if (managerPin) {
      const pinHash = createHash('sha256').update(managerPin).digest('hex');
      const authStaff = await prisma.staffUser.findFirst({
        where: {
          outletId: session.outletId,
          OR: [{ pinHash }, { pinHash: managerPin }],
          role: { in: ['owner', 'manager'] },
          active: true,
        },
      });
      if (!authStaff) {
        return NextResponse.json(
          { error: 'forbidden', message: 'Invalid Manager PIN. Only roles above Cashier (Manager / Owner) can manage the business day.' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'forbidden', message: 'Only roles above Cashier (Manager / Owner) can extend or close the business day.' },
        { status: 403 }
      );
    }
  }

  const now = new Date();

  if (action === 'extend') {
    const minutes = typeof body.durationMinutes === 'number' && body.durationMinutes > 0
      ? body.durationMinutes
      : null; // null = open until manual close

    const extendedUntil = minutes ? new Date(now.getTime() + minutes * 60_000).toISOString() : null;

    const updatedState: BusinessDayState = {
      ...currentState,
      isExtended: true,
      extendedUntil,
      extendedAt: now.toISOString(),
      extendedByStaffId: session.staffId,
      extendedByRole: session.role || 'manager',
      status: 'extended',
    };

    const nextSettings = { ...currentSettings, businessDay: updatedState };
    await prisma.outlet.update({
      where: { id: session.outletId },
      data: { settings: nextSettings as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      ok: true,
      message: minutes ? `Business day extended by ${minutes} minutes.` : "Business day extended (same day active until closed).",
      state: updatedState,
    });
  }

  if (action === 'close_day') {
    // Settle/close the current business day and roll over to tomorrow
    const calendarToday = formatYmdInTz(now, tz);
    const updatedState: BusinessDayState = {
      ...currentState,
      isExtended: false,
      extendedUntil: null,
      status: 'closed',
      lastClosedAt: now.toISOString(),
      currentBusinessDate: calendarToday,
    };

    const nextSettings = { ...currentSettings, businessDay: updatedState };
    await prisma.outlet.update({
      where: { id: session.outletId },
      data: { settings: nextSettings as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      ok: true,
      message: 'Business day closed successfully.',
      state: updatedState,
    });
  }

  if (action === 'configure') {
    const cutoffHour = typeof body.cutoffHour === 'number' ? Math.max(0, Math.min(8, body.cutoffHour)) : currentState.cutoffHour;
    const closingTime = typeof body.closingTime === 'string' && /^\d{2}:\d{2}$/.test(body.closingTime) ? body.closingTime : currentState.closingTime;
    const autoPromptAtMidnight = typeof body.autoPromptAtMidnight === 'boolean' ? body.autoPromptAtMidnight : currentState.autoPromptAtMidnight;

    const updatedState: BusinessDayState = {
      ...currentState,
      cutoffHour,
      closingTime,
      autoPromptAtMidnight,
    };

    const nextSettings = { ...currentSettings, businessDay: updatedState };
    await prisma.outlet.update({
      where: { id: session.outletId },
      data: { settings: nextSettings as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      ok: true,
      message: 'Business day settings updated.',
      state: updatedState,
    });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
