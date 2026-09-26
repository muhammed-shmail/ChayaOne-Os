import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canManageStaff, hasPermission, hasRole } from '@/lib/rbac';
import { getOutletLocation, checkGeofence, readGeoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getLocalDateBounds(dateStr: string, timezone: string): { start: Date; end: Date } {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);
  return { start: new Date(start.getTime() - 14 * 3600 * 1000), end: new Date(end.getTime() + 14 * 3600 * 1000) };
}

function parseLocalDateTime(dateStr: string, timeStr?: string | null): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 9;
  let minutes = 0;
  if (timeStr) {
    const isPm = /pm/i.test(timeStr);
    const isAm = /am/i.test(timeStr);
    const cleaned = timeStr.replace(/(am|pm)/i, '').trim();
    const parts = cleaned.split(':').map(Number);
    if (!isNaN(parts[0])) {
      hours = parts[0];
      if (isPm && hours < 12) hours += 12;
      if (isAm && hours === 12) hours = 0;
    }
    if (parts[1] !== undefined && !isNaN(parts[1])) {
      minutes = parts[1];
    }
  }
  // Store offset for Indian timezone (UTC+5:30)
  const offsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0) - offsetMs);
}

function formatTimeInTz(d: Date | null, tz: string): string {
  if (!d) return '--';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

function formatDateInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function formatDayInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'long' }).format(d);
  } catch {
    return '';
  }
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Attendance Tracking & Reporting API.
 *
 * GET  /api/attendance
 *   - No params: Returns caller's open punch and geo requirement.
 *   - ?report=daily&date=YYYY-MM-DD: Daily attendance breakdown across staff.
 *   - ?report=monthly&month=YYYY-MM: Monthly attendance rollup.
 *   - ?staffId=...&view=history: Detailed attendance history, summary, and calendar for staff member.
 *   - ?staffId=...: View punch status for a specific staff member.
 *
 * POST /api/attendance
 *   - { action: 'in' | 'out' | 'break_start' | 'break_end', staffId? }
 *   - { action: 'mark_status', staffId, date, status, notes?, clockIn?, clockOut? }
 *   - { action: 'correct', id?, staffId, date, clockIn, clockOut, status, notes?, reason }
 *   - { action: 'add_note', id, notes }
 *   - { action: 'delete', id }
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const reportType = sp.get('report');
  const viewMode = sp.get('view');
  const targetStaffId = sp.get('staffId');

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { id: true, timezone: true, name: true },
  });
  const tz = outlet?.timezone || 'Asia/Kolkata';

  // 1. Daily / Monthly Attendance Rollup across All Staff
  if (reportType === 'daily' || reportType === 'monthly') {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance') && !hasRole(session, ['owner', 'manager', 'accountant'])) {
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

        let lateMins = 0;
        let earlyLeavingMins = 0;
        let overtimeMins = Math.max(0, totalWorkMins - 480);

        if (shift && firstClockIn) {
          const shiftStartMs = shift.startsAt.getTime();
          const firstInMs = firstClockIn.getTime();
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
      const monthStr = sp.get('month') || new Date().toISOString().slice(0, 7);
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

  // 2. Staff Profile Attendance View (Detailed History, Calendar & Monthly Summary)
  if (viewMode === 'history' || sp.has('month') || sp.has('startDate') || (targetStaffId && (sp.has('view') || sp.has('filterStatus')))) {
    const effectiveStaffId = targetStaffId || session.staffId;
    const isSelf = effectiveStaffId === session.staffId;

    if (!isSelf && !canManageStaff(session) && !hasPermission(session, 'staff:attendance') && !hasPermission(session, 'staff:view') && !hasRole(session, ['owner', 'manager'])) {
      return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to view attendance for this staff member' }, { status: 403 });
    }

    const targetStaff = await prisma.staffUser.findFirst({
      where: { id: effectiveStaffId, tenantId: session.tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        email: true,
        username: true,
        active: true,
        employeeCode: true,
        payType: true,
        payRatePaise: true,
        createdAt: true,
        permissions: true,
      },
    });

    if (!targetStaff) {
      return NextResponse.json({ error: 'not_found', message: 'Staff member not found' }, { status: 404 });
    }

    // Determine query boundaries
    let rangeStart: Date;
    let rangeEnd: Date;
    const monthParam = sp.get('month'); // e.g. "2026-09"
    const startDateParam = sp.get('startDate');
    const endDateParam = sp.get('endDate');

    if (startDateParam && endDateParam) {
      rangeStart = getLocalDateBounds(startDateParam, tz).start;
      rangeEnd = getLocalDateBounds(endDateParam, tz).end;
    } else {
      const monthStr = monthParam || new Date().toISOString().slice(0, 7);
      const parts = monthStr.split('-').map(Number);
      const year = parts[0] ?? new Date().getFullYear();
      const month = parts[1] ?? (new Date().getMonth() + 1);
      rangeStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 14 * 3600 * 1000);
      rangeEnd = new Date(Date.UTC(year, month, 1, 23, 59, 59) + 14 * 3600 * 1000);
    }

    // Auto-close open stale punches older than 16 hours
    await prisma.attendance.updateMany({
      where: {
        outletId: session.outletId,
        staffId: effectiveStaffId,
        clockOut: null,
        clockIn: { lt: new Date(Date.now() - 16 * 3600 * 1000) },
      },
      data: {
        clockOut: new Date(),
      },
    }).catch(() => {});

    const [attendanceRows, shiftRows] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          outletId: session.outletId,
          staffId: effectiveStaffId,
          clockIn: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { clockIn: 'desc' },
        include: { shift: true },
      }),
      prisma.shift.findMany({
        where: {
          outletId: session.outletId,
          staffId: effectiveStaffId,
          startsAt: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    // Format individual attendance records
    const formattedRecords = attendanceRows.map((a) => {
      const dateStr = formatDateInTz(a.clockIn, tz);
      const dayName = formatDayInTz(a.clockIn, tz);
      const checkInFormatted = formatTimeInTz(a.clockIn, tz);
      const checkOutFormatted = a.clockOut ? formatTimeInTz(a.clockOut, tz) : '--';

      let workingMins = a.workingMinutes ?? 0;
      if (a.workingMinutes == null) {
        if (a.clockOut) {
          workingMins = Math.max(0, Math.round((a.clockOut.getTime() - a.clockIn.getTime()) / 60000));
        } else if (Date.now() - a.clockIn.getTime() < 16 * 3600 * 1000) {
          workingMins = Math.max(0, Math.round((Date.now() - a.clockIn.getTime()) / 60000));
        }
      }

      // Associated shift lookup
      const matchedShift = a.shift || shiftRows.find((s) => {
        const sDate = formatDateInTz(s.startsAt, tz);
        return sDate === dateStr;
      });

      let shiftLabel = matchedShift
        ? `${matchedShift.role || 'General'} (${formatTimeInTz(matchedShift.startsAt, tz)} – ${formatTimeInTz(matchedShift.endsAt, tz)})`
        : null;

      // Status resolution
      let status = a.status ? a.status.toLowerCase().trim() : '';
      if (!status) {
        if (!a.clockOut) {
          const isRecentlyStarted = Date.now() - a.clockIn.getTime() < 16 * 3600 * 1000;
          status = isRecentlyStarted ? 'working' : 'missing_checkout';
        } else if (matchedShift && a.clockIn.getTime() > matchedShift.startsAt.getTime() + 15 * 60000) {
          status = 'late';
        } else if (workingMins >= 180 && workingMins < 360) {
          status = 'half_day';
        } else {
          status = 'present';
        }
      }

      const isManual = ['manual', 'manual_adjustment', 'manual_entry', 'manager_punch'].includes(a.source);

      return {
        id: a.id,
        date: dateStr,
        day: dayName,
        checkIn: checkInFormatted,
        checkOut: checkOutFormatted,
        rawCheckIn: a.clockIn.toISOString(),
        rawCheckOut: a.clockOut?.toISOString() ?? null,
        workingMinutes: workingMins,
        workingHours: formatDuration(workingMins),
        status,
        shift: shiftLabel,
        shiftId: a.shiftId ?? matchedShift?.id ?? null,
        notes: a.notes || null,
        source: a.source,
        isManual,
        createdAt: a.createdAt?.toISOString() ?? null,
        updatedAt: a.updatedAt?.toISOString() ?? null,
      };
    });

    // Optional status filter
    const statusFilter = sp.get('filterStatus');
    const filteredRecords = statusFilter && statusFilter !== 'all'
      ? formattedRecords.filter((r) => r.status === statusFilter)
      : formattedRecords;

    // Monthly summary calculation based on actual records
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let offDayCount = 0;
    let workingCount = 0;
    let missingCheckoutCount = 0;
    let totalMinutesWorked = 0;

    for (const r of formattedRecords) {
      totalMinutesWorked += r.workingMinutes;
      switch (r.status) {
        case 'present':
        case 'overtime':
          presentCount++;
          break;
        case 'absent':
          absentCount++;
          break;
        case 'late':
          lateCount++;
          break;
        case 'half_day':
          halfDayCount++;
          break;
        case 'leave':
          leaveCount++;
          break;
        case 'holiday':
        case 'off_day':
          offDayCount++;
          break;
        case 'working':
          workingCount++;
          break;
        case 'missing_checkout':
          missingCheckoutCount++;
          break;
        default:
          presentCount++;
          break;
      }
    }

    // Determine total eligible working days in selected month/window
    const distinctWorkDates = new Set(formattedRecords.map((r) => r.date));
    const totalWorkingDays = Math.max(
      presentCount + lateCount + halfDayCount + absentCount + leaveCount + workingCount,
      distinctWorkDates.size,
      1
    );

    const productiveUnits = presentCount + lateCount + workingCount + (halfDayCount * 0.5);
    const attendanceRate = totalWorkingDays > 0
      ? Number(((productiveUnits / totalWorkingDays) * 100).toFixed(2))
      : 100;

    const summary = {
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      halfDay: halfDayCount,
      leave: leaveCount,
      offDay: offDayCount,
      working: workingCount,
      missingCheckout: missingCheckoutCount,
      totalWorkingDays,
      attendanceRate: `${attendanceRate}%`,
      totalHours: formatDuration(totalMinutesWorked),
    };

    return NextResponse.json({
      ok: true,
      staff: targetStaff,
      records: filteredRecords,
      summary,
      shifts: shiftRows.map((s) => ({
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        role: s.role,
        status: s.status,
      })),
      timezone: tz,
    });
  }

  // 3. Querying caller or single staff open punch (POS shift status bar)
  let queryStaffId = session.staffId;
  if (targetStaffId && targetStaffId !== session.staffId) {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    queryStaffId = targetStaffId;
  }

  let open = await prisma.attendance.findFirst({
    where: { outletId: session.outletId, staffId: queryStaffId, clockOut: null },
    orderBy: { clockIn: 'desc' },
    select: { id: true, clockIn: true },
  });

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
 * Handles clocking in, clocking out, manual status marks, corrections, and note additions.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  // ── 1. Mark Status (Manager manual action: Present, Absent, Leave, etc.) ──
  if (action === 'mark_status') {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance') && !hasRole(session, ['owner', 'manager'])) {
      return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to mark attendance' }, { status: 403 });
    }

    const { staffId, date, status, notes, clockIn, clockOut } = body;
    if (!staffId || !date || !status) {
      return NextResponse.json({ error: 'missing_fields', message: 'Staff ID, date and status are required.' }, { status: 400 });
    }

    const target = await prisma.staffUser.findFirst({
      where: { id: staffId, tenantId: session.tenantId },
      select: { id: true, name: true },
    });
    if (!target) return NextResponse.json({ error: 'not_found', message: 'Staff member not found' }, { status: 404 });

    const clockInDate = parseLocalDateTime(date, clockIn || (status === 'present' ? '09:30 AM' : null));
    const clockOutDate = clockOut ? parseLocalDateTime(date, clockOut) : (status === 'present' ? parseLocalDateTime(date, '05:30 PM') : null);

    let workingMinutes: number | null = null;
    if (clockOutDate && clockInDate) {
      workingMinutes = Math.max(0, Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000));
    }

    const created = await prisma.attendance.create({
      data: {
        outletId: session.outletId,
        staffId,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        status: String(status).toLowerCase(),
        notes: notes ? String(notes).trim() : null,
        workingMinutes,
        source: 'manual_entry',
        createdById: session.staffId,
      },
    });

    await prisma.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'attendance.manual_mark',
        entity: 'attendance',
        entityId: created.id,
        after: {
          targetStaffId: staffId,
          targetName: target.name,
          date,
          status,
          notes: notes || null,
          markedBy: session.staffId,
        },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, attendance: created });
  }

  // ── 2. Attendance Correction (Edit with Reason) ──
  if (action === 'correct' || action === 'edit') {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance') && !hasRole(session, ['owner', 'manager'])) {
      return NextResponse.json({ error: 'forbidden', message: 'Unauthorized to correct attendance' }, { status: 403 });
    }

    const { id, staffId, date, clockIn, clockOut, status, notes, reason } = body;
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: 'reason_required', message: 'A reason for correcting attendance is required for audit compliance.' }, { status: 400 });
    }

    const target = await prisma.staffUser.findFirst({
      where: { id: staffId, tenantId: session.tenantId },
      select: { id: true, name: true },
    });
    if (!target) return NextResponse.json({ error: 'not_found', message: 'Staff member not found' }, { status: 404 });

    const clockInDate = parseLocalDateTime(date, clockIn);
    const clockOutDate = clockOut ? parseLocalDateTime(date, clockOut) : null;
    let workingMinutes: number | null = null;
    if (clockInDate && clockOutDate) {
      workingMinutes = Math.max(0, Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000));
    }

    let attendanceId = id;
    let beforeState: any = null;

    if (id) {
      const existing = await prisma.attendance.findUnique({ where: { id } });
      if (existing) {
        beforeState = {
          clockIn: existing.clockIn.toISOString(),
          clockOut: existing.clockOut?.toISOString() ?? null,
          status: existing.status,
          notes: existing.notes,
          workingMinutes: existing.workingMinutes,
        };

        await prisma.attendance.update({
          where: { id },
          data: {
            clockIn: clockInDate,
            clockOut: clockOutDate,
            status: status ? String(status).toLowerCase() : existing.status,
            notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
            workingMinutes,
            source: 'manual_adjustment',
            updatedById: session.staffId,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      const created = await prisma.attendance.create({
        data: {
          outletId: session.outletId,
          staffId,
          clockIn: clockInDate,
          clockOut: clockOutDate,
          status: status ? String(status).toLowerCase() : 'present',
          notes: notes ? String(notes).trim() : null,
          workingMinutes,
          source: 'manual_adjustment',
          createdById: session.staffId,
          updatedById: session.staffId,
        },
      });
      attendanceId = created.id;
    }

    // Comprehensive Audit Record with Reason
    await prisma.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'attendance.corrected',
        entity: 'attendance',
        entityId: attendanceId,
        before: beforeState,
        after: {
          targetStaffId: staffId,
          targetName: target.name,
          date,
          clockIn: clockInDate.toISOString(),
          clockOut: clockOutDate?.toISOString() ?? null,
          status: status || 'present',
          notes: notes || null,
          reason: String(reason).trim(),
          correctedBy: session.staffId,
        },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, attendanceId, message: 'Attendance corrected successfully' });
  }

  // ── 3. Add Note ──
  if (action === 'add_note') {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance') && !hasRole(session, ['owner', 'manager'])) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const { id, notes } = body;
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        notes: notes ? String(notes).trim() : null,
        updatedById: session.staffId,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'attendance.note_added',
        entity: 'attendance',
        entityId: id,
        after: { notes: updated.notes },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, attendance: updated });
  }

  // ── 4. Delete Record ──
  if (action === 'delete') {
    if (!canManageStaff(session) && !hasPermission(session, 'staff:attendance') && !hasRole(session, ['owner', 'manager'])) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (existing) {
      await prisma.attendance.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          outletId: session.outletId,
          actorId: session.staffId,
          action: 'attendance.deleted',
          entity: 'attendance',
          entityId: id,
          before: { staffId: existing.staffId, clockIn: existing.clockIn.toISOString() },
        },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, deleted: true });
  }

  // ── 5. Standard Clock-In / Clock-Out / Breaks ──
  if (!['in', 'out', 'break_start', 'break_end'].includes(action)) {
    return NextResponse.json({ error: 'invalid_action', message: 'Action must be in, out, break_start, break_end, mark_status, or correct' }, { status: 400 });
  }

  let staffId = session.staffId;
  const isSelfPunch = !body.staffId || body.staffId === session.staffId;

  if (!isSelfPunch) {
    if (!canManageStaff(session) && !hasRole(session, ['owner', 'manager'])) {
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

  if (open && Date.now() - open.clockIn.getTime() > 16 * 3600 * 1000) {
    const autoOut = new Date(open.clockIn.getTime() + 8 * 3600 * 1000);
    await prisma.attendance.update({
      where: { id: open.id },
      data: { clockOut: autoOut },
    }).catch(() => {});
    open = null;
  }

  if (action === 'in' || action === 'break_end') {
    if (open) {
      return NextResponse.json({
        ok: true,
        open: { id: open.id, clockIn: open.clockIn.toISOString() },
        already: true,
        message: 'Employee is already clocked in',
      });
    }

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

    const source = action === 'break_end' ? 'break_return' : (isSelfPunch ? (body.source || 'punch') : 'manager_punch');
    const rec = await prisma.attendance.create({
      data: {
        outletId: session.outletId,
        staffId,
        clockIn: new Date(),
        source,
        status: 'working',
        createdById: session.staffId,
      },
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

  if (action === 'out' || action === 'break_start') {
    if (!open) {
      return NextResponse.json({
        ok: true,
        open: null,
        already: true,
        message: 'Employee is already clocked out',
      });
    }

    const now = new Date();
    const workedMinutes = Math.max(0, Math.round((now.getTime() - open.clockIn.getTime()) / 60000));

    await prisma.attendance.update({
      where: { id: open.id },
      data: {
        clockOut: now,
        status: workedMinutes >= 240 && workedMinutes < 420 ? 'half_day' : 'present',
        workingMinutes: workedMinutes,
        updatedById: session.staffId,
        updatedAt: now,
      },
    });

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
