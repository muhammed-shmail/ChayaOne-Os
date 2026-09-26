import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getLocalDateBounds(dateStr: string): { start: Date; end: Date } {
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
  const offsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0) - offsetMs);
}

function formatTimeInTz(d: Date | null, tz: string = 'Asia/Kolkata'): string {
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

function formatDateInTz(d: Date, tz: string = 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function formatDayInTz(d: Date, tz: string = 'Asia/Kolkata'): string {
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

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const viewMode = sp.get('view');
  const targetStaffId = sp.get('staffId');

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { id: true, timezone: true },
  });
  const tz = outlet?.timezone || 'Asia/Kolkata';

  // 1. Staff Profile Attendance View (Detailed History, Calendar & Monthly Summary)
  if (viewMode === 'history' || sp.has('month') || sp.has('startDate') || (targetStaffId && (sp.has('view') || sp.has('filterStatus')))) {
    const effectiveStaffId = targetStaffId || session.staffId;
    const isSelf = effectiveStaffId === session.staffId;

    if (!isSelf && session.role !== 'owner' && session.role !== 'manager') {
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

    let rangeStart: Date;
    let rangeEnd: Date;
    const monthParam = sp.get('month');
    const startDateParam = sp.get('startDate');
    const endDateParam = sp.get('endDate');

    if (startDateParam && endDateParam) {
      rangeStart = getLocalDateBounds(startDateParam).start;
      rangeEnd = getLocalDateBounds(endDateParam).end;
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

      const matchedShift = a.shift || shiftRows.find((s) => {
        const sDate = formatDateInTz(s.startsAt, tz);
        return sDate === dateStr;
      });

      let shiftLabel = matchedShift
        ? `${matchedShift.role || 'General'} (${formatTimeInTz(matchedShift.startsAt, tz)} – ${formatTimeInTz(matchedShift.endsAt, tz)})`
        : null;

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

    const statusFilter = sp.get('filterStatus');
    const filteredRecords = statusFilter && statusFilter !== 'all'
      ? formattedRecords.filter((r) => r.status === statusFilter)
      : formattedRecords;

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

  // 2. Open punch lookup
  let queryStaffId = session.staffId;
  if (targetStaffId && targetStaffId !== session.staffId) {
    if (session.role !== 'owner' && session.role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    queryStaffId = targetStaffId;
  }

  const open = await prisma.attendance.findFirst({
    where: { outletId: session.outletId, staffId: queryStaffId, clockOut: null },
    orderBy: { clockIn: 'desc' },
    select: { id: true, clockIn: true },
  });

  return NextResponse.json({
    open: open ? { id: open.id, clockIn: open.clockIn.toISOString() } : null,
    geoRequired: false,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  // Mark Status
  if (action === 'mark_status') {
    if (session.role !== 'owner' && session.role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { staffId, date, status, notes, clockIn, clockOut } = body;
    if (!staffId || !date || !status) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

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
        after: { staffId, date, status, notes },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, attendance: created });
  }

  // Attendance Correction
  if (action === 'correct' || action === 'edit') {
    if (session.role !== 'owner' && session.role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { id, staffId, date, clockIn, clockOut, status, notes, reason } = body;
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: 'reason_required', message: 'A reason for correcting attendance is required.' }, { status: 400 });
    }

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

    await prisma.auditLog.create({
      data: {
        outletId: session.outletId,
        actorId: session.staffId,
        action: 'attendance.corrected',
        entity: 'attendance',
        entityId: attendanceId,
        before: beforeState,
        after: {
          staffId,
          date,
          clockIn: clockInDate.toISOString(),
          clockOut: clockOutDate?.toISOString() ?? null,
          status,
          reason: String(reason).trim(),
        },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, attendanceId, message: 'Attendance corrected successfully' });
  }

  // Delete Record
  if (action === 'delete') {
    if (session.role !== 'owner' && session.role !== 'manager') {
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

  // Clock In / Out
  if (action === 'in') {
    const staffId = body.staffId || session.staffId;
    const open = await prisma.attendance.findFirst({
      where: { outletId: session.outletId, staffId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (open) return NextResponse.json({ ok: true, attendance: open, already: true });

    const row = await prisma.attendance.create({
      data: {
        outletId: session.outletId,
        staffId,
        clockIn: new Date(),
        source: session.staffId === staffId ? 'pin' : 'manager_punch',
        status: 'working',
        createdById: session.staffId,
      },
    });
    return NextResponse.json({ ok: true, attendance: row });
  } else if (action === 'out') {
    const staffId = body.staffId || session.staffId;
    const open = await prisma.attendance.findFirst({
      where: { outletId: session.outletId, staffId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (!open) return NextResponse.json({ ok: true, already: true });

    const now = new Date();
    const workedMinutes = Math.max(0, Math.round((now.getTime() - open.clockIn.getTime()) / 60000));
    const row = await prisma.attendance.update({
      where: { id: open.id },
      data: {
        clockOut: now,
        status: workedMinutes >= 240 && workedMinutes < 420 ? 'half_day' : 'present',
        workingMinutes: workedMinutes,
        updatedById: session.staffId,
        updatedAt: now,
      },
    });
    return NextResponse.json({ ok: true, attendance: row });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
