import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canManageStaff, hasPermission, hasRole } from '@/lib/rbac';
import { getOutletLocation, checkGeofence, readGeoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getLocalDateBounds(dateStr: string, timezone: string): { start: Date; end: Date } {
  // e.g. "2026-09-17" in "Asia/Kolkata" (+05:30)
  // Construct UTC bounds corresponding to start and end of that local day
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  // Approximate with full 24h UTC window covering timezone offsets
  const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);
  return { start: new Date(start.getTime() - 14 * 3600 * 1000), end: new Date(end.getTime() + 14 * 3600 * 1000) };
}

/**
 * Attendance Tracking & Reporting API.
 *
 * GET  /api/attendance
 *   - No params: Returns caller's open punch and geo requirement.
 *   - ?report=daily&date=YYYY-MM-DD: Daily attendance breakdown across staff.
 *   - ?report=monthly&month=YYYY-MM: Monthly attendance rollup.
 *   - ?staffId=...: View punch status for a specific staff member.
 *
 * POST /api/attendance
 *   - { action: 'in' | 'out' | 'break_start' | 'break_end', staffId? }
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const reportType = sp.get('report');
  const targetStaffId = sp.get('staffId');

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { id: true, timezone: true },
  });
  const tz = outlet?.timezone || 'Asia/Kolkata';

  // 1. Daily / Monthly Attendance Report for Managers & Owners
  if (reportType === 'daily' || reportType === 'monthly') {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance:view') && !hasRole(session, ['owner', 'manager', 'accountant'])) {
      return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to view attendance reports' }, { status: 403 });
    }

    if (reportType === 'daily') {
      const dateStr = sp.get('date') || new Date().toISOString().slice(0, 10);
      const { start, end } = getLocalDateBounds(dateStr, tz);

      const [staffList, punches, shifts] = await Promise.all([
        prisma.staffUser.findMany({
          where: { tenantId: session.tenantId, active: true },
          select: { id: true, name: true, role: true, employeeCode: true },
          orderBy: { name: 'asc' },
        }),
        prisma.attendance.findMany({
          where: {
            outletId: session.outletId,
            clockIn: { gte: start, lte: end },
          },
          orderBy: { clockIn: 'asc' },
        }),
        prisma.shift.findMany({
          where: {
            outletId: session.outletId,
            startsAt: { gte: start, lte: end },
          },
        }),
      ]);

      const report = staffList.map((st) => {
        const staffPunches = punches.filter((p) => p.staffId === st.id);
        const shift = shifts.find((s) => s.staffId === st.id);

        let totalWorkMins = 0;
        let isClockedIn = false;
        let firstClockIn: Date | null = null;
        let lastClockOut: Date | null = null;

        for (const p of staffPunches) {
          if (!firstClockIn || p.clockIn < firstClockIn) firstClockIn = p.clockIn;
          const outTime = p.clockOut ?? new Date();
          if (!p.clockOut) isClockedIn = true;
          if (p.clockOut && (!lastClockOut || p.clockOut > lastClockOut)) lastClockOut = p.clockOut;

          const durationMs = outTime.getTime() - p.clockIn.getTime();
          totalWorkMins += Math.max(0, Math.round(durationMs / 60000));
        }

        // Calculations for late, overtime, early leaving
        let lateMins = 0;
        let earlyLeavingMins = 0;
        let overtimeMins = Math.max(0, totalWorkMins - 480); // standard 8h = 480 mins

        if (shift && firstClockIn) {
          const shiftStartMs = shift.startsAt.getTime();
          const firstInMs = firstClockIn.getTime();
          // 15-minute grace period
          if (firstInMs > shiftStartMs + 15 * 60000) {
            lateMins = Math.round((firstInMs - shiftStartMs) / 60000);
          }
          if (lastClockOut && lastClockOut.getTime() < shift.endsAt.getTime() - 15 * 60000) {
            earlyLeavingMins = Math.round((shift.endsAt.getTime() - lastClockOut.getTime()) / 60000);
          }
        }

        let status: 'present' | 'absent' | 'late' | 'overtime' | 'on_shift' | 'off' = 'off';
        if (staffPunches.length === 0) {
          status = shift ? 'absent' : 'off';
        } else if (isClockedIn) {
          status = 'on_shift';
        } else if (lateMins > 0) {
          status = 'late';
        } else if (overtimeMins > 0) {
          status = 'overtime';
        } else {
          status = 'present';
        }

        return {
          staffId: st.id,
          name: st.name,
          role: st.role,
          employeeCode: st.employeeCode,
          status,
          isClockedIn,
          firstClockIn: firstClockIn?.toISOString() ?? null,
          lastClockOut: lastClockOut?.toISOString() ?? null,
          totalWorkMinutes: totalWorkMins,
          totalWorkHours: Number((totalWorkMins / 60).toFixed(2)),
          lateMinutes: lateMins,
          earlyLeavingMinutes: earlyLeavingMins,
          overtimeMinutes: overtimeMins,
          punchesCount: staffPunches.length,
          scheduledShift: shift ? { startsAt: shift.startsAt.toISOString(), endsAt: shift.endsAt.toISOString() } : null,
        };
      });

      return NextResponse.json({ date: dateStr, timezone: tz, records: report });
    }

    if (reportType === 'monthly') {
      const monthStr = sp.get('month') || new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const parts = monthStr.split('-').map(Number);
      const year = parts[0] ?? new Date().getFullYear();
      const month = parts[1] ?? (new Date().getMonth() + 1);
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));


      const [staffList, punches] = await Promise.all([
        prisma.staffUser.findMany({
          where: { tenantId: session.tenantId, active: true },
          select: { id: true, name: true, role: true, employeeCode: true, payRatePaise: true, payType: true },
          orderBy: { name: 'asc' },
        }),
        prisma.attendance.findMany({
          where: {
            outletId: session.outletId,
            clockIn: { gte: start, lt: end },
          },
        }),
      ]);

      const monthlySummary = staffList.map((st) => {
        const staffPunches = punches.filter((p) => p.staffId === st.id);
        const daysSet = new Set<string>();
        let totalMinutes = 0;

        for (const p of staffPunches) {
          const dayKey = p.clockIn.toISOString().slice(0, 10);
          daysSet.add(dayKey);
          const out = p.clockOut ?? new Date();
          totalMinutes += Math.max(0, Math.round((out.getTime() - p.clockIn.getTime()) / 60000));
        }

        const totalHours = Number((totalMinutes / 60).toFixed(2));
        const overtimeHours = Number((Math.max(0, totalMinutes - daysSet.size * 480) / 60).toFixed(2));

        return {
          staffId: st.id,
          name: st.name,
          role: st.role,
          employeeCode: st.employeeCode,
          payType: st.payType,
          payRatePaise: st.payRatePaise,
          daysWorked: daysSet.size,
          totalHours,
          overtimeHours,
          punchesCount: staffPunches.length,
        };
      });

      return NextResponse.json({ month: monthStr, records: monthlySummary });
    }
  }

  // 2. Querying specific staff member status (Manager inspection)
  let queryStaffId = session.staffId;
  if (targetStaffId && targetStaffId !== session.staffId) {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance:view')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    queryStaffId = targetStaffId;
  }

  let open = await prisma.attendance.findFirst({
    where: { outletId: session.outletId, staffId: queryStaffId, clockOut: null },
    orderBy: { clockIn: 'desc' },
    select: { id: true, clockIn: true },
  });

  // Stale punch auto-close: if an open punch is older than 16 hours, auto-close it
  if (open && Date.now() - open.clockIn.getTime() > 16 * 3600 * 1000) {
    const autoOut = new Date(open.clockIn.getTime() + 8 * 3600 * 1000);
    await prisma.attendance.update({
      where: { id: open.id },
      data: { clockOut: autoOut },
    }).catch(() => {});
    open = null;
  }

  const loc = await getOutletLocation(session.outletId);
  const geoRequired = loc.enabled && loc.gateAttendance && loc.lat !== null && session.role !== 'owner';

  return NextResponse.json({
    open: open ? { id: open.id, clockIn: open.clockIn.toISOString() } : null,
    geoRequired,
  });
}

/**
 * POST /api/attendance
 * Handles clocking in, clocking out, and breaks with duplicate prevention.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (!['in', 'out', 'break_start', 'break_end'].includes(action)) {
    return NextResponse.json({ error: 'invalid_action', message: 'Action must be in, out, break_start, or break_end' }, { status: 400 });
  }

  // Who is being punched — self by default; punching others requires management rights
  let staffId = session.staffId;
  const isSelfPunch = !body.staffId || body.staffId === session.staffId;

  if (!isSelfPunch) {
    if (!canManageStaff(session)) {
      return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to punch attendance for other staff' }, { status: 403 });
    }
    const t = await prisma.staffUser.findFirst({
      where: { id: body.staffId, tenantId: session.tenantId },
      select: { id: true, name: true },
    });
    if (!t) return NextResponse.json({ error: 'not_found', message: 'Employee not found in tenant' }, { status: 404 });
    staffId = body.staffId;
  }

  let open = await prisma.attendance.findFirst({
    where: { outletId: session.outletId, staffId, clockOut: null },
    orderBy: { clockIn: 'desc' },
  });

  // Stale punch auto-close: if punch is older than 16 hours, auto-close it before proceeding
  if (open && Date.now() - open.clockIn.getTime() > 16 * 3600 * 1000) {
    const autoOut = new Date(open.clockIn.getTime() + 8 * 3600 * 1000);
    await prisma.attendance.update({
      where: { id: open.id },
      data: { clockOut: autoOut },
    }).catch(() => {});
    open = null;
  }

  // 1. CLOCK IN / BREAK END
  if (action === 'in' || action === 'break_end') {
    // Duplicate punch prevention: already clocked in
    if (open) {
      return NextResponse.json({
        ok: true,
        open: { id: open.id, clockIn: open.clockIn.toISOString() },
        already: true,
        message: 'Employee is already clocked in',
      });
    }

    // Location gate check for self-punch
    if (isSelfPunch && session.role !== 'owner') {
      const loc = await getOutletLocation(session.outletId);
      if (loc.enabled && loc.gateAttendance && loc.lat !== null) {
        const fence = checkGeofence(loc, readGeoFromHeaders(req.headers), { strict: true });
        if (!fence.ok) {
          const error = fence.reason === 'no_fix' ? 'no_gps' : 'out_of_range';
          return NextResponse.json({ error, radiusM: fence.radiusM, distanceM: fence.distanceM }, { status: 403 });
        }
      }
    }

    const source = action === 'break_end' ? 'break_return' : (body.source || 'punch');
    const rec = await prisma.attendance.create({
      data: { outletId: session.outletId, staffId, clockIn: new Date(), source },
      select: { id: true, clockIn: true },
    });

    if (!isSelfPunch) {
      await prisma.auditLog.create({
        data: {
          outletId: session.outletId,
          actorId: session.staffId,
          action: 'attendance.manager_clock_in',
          entity: 'attendance',
          entityId: rec.id,
          after: { targetStaffId: staffId, clockIn: rec.clockIn.toISOString() },
        },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, open: { id: rec.id, clockIn: rec.clockIn.toISOString() } });
  }

  // 2. CLOCK OUT / BREAK START
  if (action === 'out' || action === 'break_start') {
    // Duplicate clock-out prevention: if already clocked out, return cleanly
    if (!open) {
      return NextResponse.json({
        ok: true,
        open: null,
        already: true,
        message: 'Employee is already clocked out',
      });
    }

    const now = new Date();
    await prisma.attendance.update({
      where: { id: open.id },
      data: { clockOut: now },
    });

    const workedMinutes = Math.max(0, Math.round((now.getTime() - open.clockIn.getTime()) / 60000));

    if (!isSelfPunch) {
      await prisma.auditLog.create({
        data: {
          outletId: session.outletId,
          actorId: session.staffId,
          action: action === 'break_start' ? 'attendance.break_start' : 'attendance.manager_clock_out',
          entity: 'attendance',
          entityId: open.id,
          after: { targetStaffId: staffId, clockOut: now.toISOString(), workedMinutes },
        },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, open: null, workedMinutes });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

