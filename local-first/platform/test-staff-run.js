require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

async function run() {
  const outlets = await prisma.outlet.findMany();
  console.log(`Found ${outlets.length} outlet(s):`, outlets.map(o => ({ id: o.id, name: o.name, tenantId: o.tenantId })));

  for (const outlet of outlets) {
    console.log(`\n================ Testing ${outlet.name} (${outlet.id}) ================`);
    const outletId = outlet.id;
    const tenantId = outlet.tenantId;
    const period = new Date().toISOString().slice(0, 7);

    try {
      const parts = period.split('-').map(Number);
      const periodYear = Number.isFinite(parts[0]) && parts[0] ? parts[0] : new Date().getFullYear();
      const periodMonth = Number.isFinite(parts[1]) && parts[1] ? parts[1] : new Date().getMonth() + 1;
      const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1, 0, 0, 0));
      const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1, 0, 0, 0));

      const [memberRows, customRoles, sales, attendance, active, todayWork, attToday, shiftRows, payRows, monthPunches, outletRecord] = await Promise.all([
        prisma.staffUser.findMany({
          where: { tenantId, OR: [{ outletId }, { outletId: null }] },
          orderBy: [{ active: 'desc' }, { name: 'asc' }],
          select: { id: true, name: true, role: true, phone: true, active: true, employeeCode: true, payType: true, payRatePaise: true, pinHash: true, username: true, passwordHash: true, permissions: true },
        }),
        prisma.role.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
        }).catch(() => []),
        prisma.$queryRaw`
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
        `,
        prisma.attendance.findMany({
          where: { outletId },
          orderBy: { clockIn: 'desc' },
          take: 12,
          include: { staff: { select: { name: true } } },
        }),
        prisma.$queryRaw`
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
        `,
        prisma.$queryRaw`
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
        `,
        prisma.$queryRaw`
          SELECT a."id"::text AS "id", a."staffId"::text AS "staffId", s.name AS name, s.role AS role, a."clockIn" AS "clockIn", a."clockOut" AS "clockOut"
          FROM attendance a JOIN staff_users s ON s.id = a."staffId"
          WHERE a."outletId" = ${outletId}::uuid
            AND (("clockIn" AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date OR a."clockOut" IS NULL)
          ORDER BY a."clockIn" DESC
        `,
        prisma.shift.findMany({
          where: { outletId, endsAt: { gte: new Date() } },
          orderBy: { startsAt: 'asc' },
          take: 60,
          include: { staff: { select: { name: true } } },
        }),
        prisma.salaryPayment.findMany({
          where: { outletId, periodLabel: period },
          orderBy: { paidAt: 'desc' },
          select: { id: true, staffId: true, periodLabel: true, amountPaise: true, method: true, note: true, paidAt: true },
        }),
        prisma.attendance.findMany({
          where: {
            outletId,
            clockIn: { gte: periodStart, lt: periodEnd },
          },
          select: { staffId: true, clockIn: true, clockOut: true },
        }),
        prisma.outlet.findUnique({
          where: { id: outletId },
          select: { settings: true },
        }).catch(() => null),
      ]);

      console.log(`Success querying DB for ${outlet.name}! Members: ${memberRows.length}`);
    } catch (err) {
      console.error(`ERROR for ${outlet.name}:`, err);
    }
  }

  await prisma.$disconnect();
}

run();
