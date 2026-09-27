require('dotenv').config();
const path = require('path');

async function test() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Check staff members
    const staff = await prisma.staffUser.findMany({ select: { id: true, name: true, role: true, outletId: true, tenantId: true } });
    console.log('Staff list:', staff);

    // Let's test with the actual staff member's outletId and tenantId:
    const ravi = staff.find(s => s.name.includes('Ravi')) || staff[0];
    console.log('Using Ravi:', ravi);

    const outletId = ravi.outletId;
    const tenantId = ravi.tenantId;

    // Check if outlet exists
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    console.log('Outlet:', outlet);

    // Let's test calling the exact logic in getStaff in sections.ts:
    const TZ = 'Asia/Kolkata';
    const period = new Date().toISOString().slice(0, 7);

    // 1. auto-close attendance
    await prisma.attendance.updateMany({
      where: {
        outletId,
        clockOut: null,
        clockIn: { lt: new Date(Date.now() - 16 * 3600 * 1000) },
      },
      data: {
        clockOut: new Date(),
      },
    }).catch(e => console.error('attendance updateMany failed:', e));

    const parts = period.split('-').map(Number);
    const periodYear = Number.isFinite(parts[0]) && parts[0] ? parts[0] : new Date().getFullYear();
    const periodMonth = Number.isFinite(parts[1]) && parts[1] ? parts[1] : new Date().getMonth() + 1;
    const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1, 0, 0, 0));

    console.log('Testing queries...');
    const memberRows = await prisma.staffUser.findMany({
      where: { tenantId, OR: [{ outletId }, { outletId: null }] },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, role: true, phone: true, active: true, employeeCode: true, payType: true, payRatePaise: true, pinHash: true, username: true, passwordHash: true, permissions: true },
    });
    console.log('memberRows count:', memberRows.length);

    const customRoles = await prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    }).catch(() => []);
    console.log('customRoles:', customRoles.length);

    const sales = await prisma.$queryRaw`
      SELECT o."staffId"::text AS "staffId",
             COALESCE(s."name", 'Unattributed') AS name,
             COUNT(*)::int AS orders,
             COALESCE(SUM(o."totalPaise"), 0)::int AS gross
      FROM orders o
      LEFT JOIN staff_users s ON s.id = o."staffId"
      WHERE o."outletId" = ${outletId}::uuid
        AND o."status" = 'settled'
        AND o."settledAt" IS NOT NULL
        AND o."settledAt" >= now() - interval '30 days'
      GROUP BY 1, 2
      ORDER BY gross DESC
    `;
    console.log('sales ok');

    const attendance = await prisma.attendance.findMany({
      where: { outletId },
      orderBy: { clockIn: 'desc' },
      take: 12,
      include: { staff: { select: { name: true } } },
    });
    console.log('attendance ok, count:', attendance.length);

    const active = await prisma.$queryRaw`
      SELECT s.id::text AS "staffId",
             COALESCE(array_agg(DISTINCT t.label) FILTER (WHERE t.label IS NOT NULL), '{}') AS tables,
             COUNT(DISTINCT o.id)::int AS orders
      FROM orders o
      JOIN staff_users s ON s.id = o."staffId" OR s.id = o."approvedById"
      LEFT JOIN tables_map t ON t.id = o."tableId"
      WHERE o."outletId" = ${outletId}::uuid
        AND o."settledAt" IS NULL
        AND o."status" IN ('open','in_kitchen','ready','served')
      GROUP BY s.id
    `;
    console.log('active ok');

    const todayWork = await prisma.$queryRaw`
      SELECT s.id::text AS "staffId",
             COALESCE(ord.orders, 0)::int AS orders,
             COALESCE(ord.gross, 0)::int AS gross,
             COALESCE(al.approvals, 0)::int AS approvals,
             COALESCE(al.settled, 0)::int AS settled,
             COALESCE(al.voided, 0)::int AS voided
      FROM staff_users s
      LEFT JOIN (
        SELECT "staffId", COUNT(*)::int AS orders, COALESCE(SUM("totalPaise"),0)::int AS gross
        FROM orders
        WHERE "outletId" = ${outletId}::uuid AND status = 'settled' AND "settledAt" IS NOT NULL
          AND ("settledAt" AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date
        GROUP BY "staffId"
      ) ord ON ord."staffId" = s.id
      LEFT JOIN (
        SELECT "actorId",
               COUNT(*) FILTER (WHERE action = 'order.approved')::int AS approvals,
               COUNT(*) FILTER (WHERE action = 'table.settled')::int AS settled,
               COUNT(*) FILTER (WHERE action = 'order.item_voided')::int AS voided
        FROM audit_log
        WHERE "outletId" = ${outletId}::uuid
          AND ("createdAt" AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date
        GROUP BY "actorId"
      ) al ON al."actorId" = s.id
      WHERE s."tenantId" = ${tenantId}::uuid
    `;
    console.log('todayWork ok');

    const attToday = await prisma.$queryRaw`
      SELECT a."id"::text AS "id", a."staffId"::text AS "staffId", s.name AS name, s.role AS role, a."clockIn" AS "clockIn", a."clockOut" AS "clockOut"
      FROM attendance a JOIN staff_users s ON s.id = a."staffId"
      WHERE a."outletId" = ${outletId}::uuid
        AND (("clockIn" AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date OR a."clockOut" IS NULL)
      ORDER BY a."clockIn" DESC
    `;
    console.log('attToday ok, count:', attToday.length);

    const shiftRows = await prisma.shift.findMany({
      where: { outletId, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 60,
      include: { staff: { select: { name: true } } },
    });
    console.log('shiftRows ok');

    const payRows = await prisma.salaryPayment.findMany({
      where: { outletId, periodLabel: period },
      orderBy: { paidAt: 'desc' },
      select: { id: true, staffId: true, periodLabel: true, amountPaise: true, method: true, note: true, paidAt: true },
    });
    console.log('payRows ok');

    const monthPunches = await prisma.attendance.findMany({
      where: {
        outletId,
        clockIn: { gte: periodStart, lt: periodEnd },
      },
      select: { staffId: true, clockIn: true, clockOut: true },
    });
    console.log('monthPunches ok, count:', monthPunches.length);

    console.log('Now testing processing...');
    const members = memberRows.map(({ pinHash, passwordHash, ...m }) => ({ ...m, hasPin: !!pinHash, hasLogin: !!passwordHash }));
    const activeBy = new Map(active.map((a) => [a.staffId, a]));
    const workBy = new Map(todayWork.map((w) => [w.staffId, w]));
    const paidBy = new Map();
    for (const p of payRows) paidBy.set(p.staffId, (paidBy.get(p.staffId) ?? 0) + p.amountPaise);

    const monthStaffDays = new Map();
    const monthStaffMinutes = new Map();
    for (const p of monthPunches) {
      const dayKey = p.clockIn.toISOString().slice(0, 10);
      if (!monthStaffDays.has(p.staffId)) monthStaffDays.set(p.staffId, new Set());
      monthStaffDays.get(p.staffId).add(dayKey);

      const end = p.clockOut ? new Date(p.clockOut).getTime() : Math.min(Date.now(), new Date(p.clockIn).getTime() + 8 * 3600 * 1000);
      const durMins = Math.max(0, Math.round((end - new Date(p.clockIn).getTime()) / 60000));
      monthStaffMinutes.set(p.staffId, (monthStaffMinutes.get(p.staffId) ?? 0) + durMins);
    }

    const activity = members
      .filter((m) => m.active && m.role !== 'kitchen')
      .map((m) => {
        const a = activeBy.get(m.id);
        const w = workBy.get(m.id);
        return {
          staffId: m.id, name: m.name, role: m.role,
          status: (a?.orders ?? 0) > 0 ? 'occupied' : 'free',
          activeTables: a?.tables ?? [],
          activeOrders: a?.orders ?? 0,
          today: { orders: w?.orders ?? 0, approvals: w?.approvals ?? 0, settled: w?.settled ?? 0, voided: w?.voided ?? 0, grossPaise: w?.gross ?? 0 },
        };
      });

    const attendanceToday = attToday.map((a) => {
      const end = a.clockOut ? new Date(a.clockOut).getTime() : Date.now();
      const minutes = a.clockIn ? Math.max(0, Math.round((end - new Date(a.clockIn).getTime()) / 60000)) : 0;
      return { id: a.id, staffId: a.staffId, name: a.name, role: a.role, clockIn: a.clockIn ? new Date(a.clockIn).toISOString() : null, clockOut: a.clockOut ? new Date(a.clockOut).toISOString() : null, minutes, present: !!a.clockIn && !a.clockOut };
    });

    console.log('SUCCESS! ALL DATA GENERATED CLEANLY');
    await prisma.$disconnect();
  } catch (e) {
    console.error('ERROR IN TEST:', e);
  }
}

test();
