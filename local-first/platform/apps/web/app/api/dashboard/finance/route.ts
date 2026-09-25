import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TZ = 'Asia/Kolkata';

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    let outletId = session.outletId;
    if (!outletId) {
      const firstOutlet = await prisma.outlet.findFirst({
        where: { tenantId: session.tenantId },
        select: { id: true },
      });
      outletId = firstOutlet?.id ?? '';
    }

    if (!outletId) return NextResponse.json({ error: 'no_outlet' }, { status: 400 });

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { settings: true },
    });

    const settings = (outlet?.settings as Record<string, unknown>) ?? {};
    const finance = (settings.finance as Record<string, unknown>) ?? {};

    // 1. Live Orders and Payment Stats for Today
    const shiftInterval = '4 hours';
    const [orderRows, payRows, refundRows, staffList, vendorList, activeShift] = await Promise.all([
      prisma.$queryRaw<
        { orders: number; gross: number; footfall: number; discount: number; tax: number }[]
      >`
        SELECT
          COUNT(*)::int AS orders,
          COALESCE(SUM("totalPaise"), 0)::int AS gross,
          (COUNT(DISTINCT "customerId")
            + COUNT(*) FILTER (WHERE "customerId" IS NULL))::int AS footfall,
          COALESCE(SUM("discountPaise"), 0)::int AS discount,
          COALESCE(SUM("cgstPaise" + "sgstPaise" + "igstPaise"), 0)::int AS tax
        FROM orders
        WHERE "outletId" = ${outletId}::uuid
          AND "status" <> 'cancelled'
          AND (("placedAt" AT TIME ZONE ${TZ}) - (${shiftInterval})::interval)::date
              = (("now"() AT TIME ZONE ${TZ}) - (${shiftInterval})::interval)::date
      `,
      prisma.$queryRaw<
        { cash_sales: number; upi_sales: number; card_sales: number }[]
      >`
        SELECT
          COALESCE(SUM(CASE WHEN p."method" = 'cash' THEN p."amountPaise" ELSE 0 END), 0)::int AS cash_sales,
          COALESCE(SUM(CASE WHEN p."method" = 'upi' THEN p."amountPaise" ELSE 0 END), 0)::int AS upi_sales,
          COALESCE(SUM(CASE WHEN p."method" = 'card' THEN p."amountPaise" ELSE 0 END), 0)::int AS card_sales
        FROM payments p
        JOIN orders o ON p."orderId" = o.id
        WHERE o."outletId" = ${outletId}::uuid
          AND o."status" <> 'cancelled'
          AND p."status" = 'success'
          AND ((o."placedAt" AT TIME ZONE ${TZ}) - (${shiftInterval})::interval)::date
              = (("now"() AT TIME ZONE ${TZ}) - (${shiftInterval})::interval)::date
      `,
      prisma.$queryRaw<{ refunds: number }[]>`
        SELECT COALESCE(SUM(r."amountPaise"), 0)::int AS refunds
        FROM refunds r
        JOIN orders o ON r."orderId" = o.id
        WHERE o."outletId" = ${outletId}::uuid
          AND ((r."createdAt" AT TIME ZONE ${TZ}) - (${shiftInterval})::interval)::date
              = (("now"() AT TIME ZONE ${TZ}) - (${shiftInterval})::interval)::date
      `.catch(() => [{ refunds: 0 }]),
      prisma.staffUser.findMany({
        where: { tenantId: session.tenantId, active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
      prisma.vendor.findMany({
        where: { tenantId: session.tenantId },
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' },
      }),
      prisma.shift.findFirst({
        where: { outletId, status: 'open' },
        orderBy: { startsAt: 'desc' },
        select: { id: true, startsAt: true },
      }).catch(() => null),
    ]);

    const ord = orderRows[0] ?? { orders: 0, gross: 0, footfall: 0, discount: 0, tax: 0 };
    const pay = payRows[0] ?? { cash_sales: 0, upi_sales: 0, card_sales: 0 };
    const ref = refundRows[0] ?? { refunds: 0 };

    // Format real staff for payroll ledger
    const realStaffPayroll = staffList.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role.toUpperCase(),
      baseSalaryPaise: 0,
      advancePaise: 0,
      bonusPaise: 0,
      deductionPaise: 0,
      attendanceDays: 0,
      paidStatus: 'unpaid',
    }));

    return NextResponse.json({
      ok: true,
      kpi: {
        todaySalesPaise: ord.gross,
        todayOrders: ord.orders,
        todaySalesCashPaise: pay.cash_sales,
        todaySalesUpiPaise: pay.upi_sales,
        todaySalesCardPaise: pay.card_sales,
        todayDiscountPaise: ord.discount,
        todayTaxPaise: ord.tax,
        todayRefundPaise: ref.refunds,
      },
      bankAccounts: Array.isArray(finance.bankAccounts) ? finance.bankAccounts : [],
      expenses: Array.isArray(finance.expenses) ? finance.expenses : [],
      transactions: Array.isArray(finance.transactions) ? finance.transactions : [],
      vendorBills: Array.isArray(finance.vendorBills) ? finance.vendorBills : [],
      payroll: Array.isArray(finance.payroll) && (finance.payroll as any[]).length > 0 ? finance.payroll : realStaffPayroll,
      journals: Array.isArray(finance.journals) ? finance.journals : [],
      audits: Array.isArray(finance.audits) ? finance.audits : [],
      staff: staffList,
      vendors: vendorList,
      activeShift: activeShift
        ? {
            id: activeShift.id,
            openingCashPaise: 0,
            openedAt: activeShift.startsAt.toISOString(),
          }
        : null,
    });
  } catch (err: any) {
    console.error('[Finance API GET error]:', err);
    return NextResponse.json({ error: 'internal_error', message: err?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    let outletId = session.outletId;
    if (!outletId) {
      const firstOutlet = await prisma.outlet.findFirst({
        where: { tenantId: session.tenantId },
        select: { id: true },
      });
      outletId = firstOutlet?.id ?? '';
    }

    if (!outletId) return NextResponse.json({ error: 'no_outlet' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { settings: true },
    });

    const settings = (outlet?.settings as Record<string, unknown>) ?? {};
    const finance = (settings.finance as Record<string, unknown>) ?? {
      bankAccounts: [],
      expenses: [],
      transactions: [],
      vendorBills: [],
      payroll: [],
      journals: [],
      audits: [],
    };

    if (body.action === 'clear_demo_data') {
      const cleanFinance = {
        bankAccounts: [],
        expenses: [],
        transactions: [],
        vendorBills: [],
        payroll: [],
        journals: [],
        audits: [],
      };
      await prisma.outlet.update({
        where: { id: outletId },
        data: { settings: { ...settings, finance: cleanFinance } as unknown as Prisma.InputJsonValue },
      });
      return NextResponse.json({ ok: true, finance: cleanFinance });
    }

    if (body.action === 'save_finance') {
      const nextFinance = {
        bankAccounts: Array.isArray(body.bankAccounts) ? body.bankAccounts : finance.bankAccounts,
        expenses: Array.isArray(body.expenses) ? body.expenses : finance.expenses,
        transactions: Array.isArray(body.transactions) ? body.transactions : finance.transactions,
        vendorBills: Array.isArray(body.vendorBills) ? body.vendorBills : finance.vendorBills,
        payroll: Array.isArray(body.payroll) ? body.payroll : finance.payroll,
        journals: Array.isArray(body.journals) ? body.journals : finance.journals,
        audits: Array.isArray(body.audits) ? body.audits : finance.audits,
      };

      await prisma.outlet.update({
        where: { id: outletId },
        data: { settings: { ...settings, finance: nextFinance } as unknown as Prisma.InputJsonValue },
      });

      return NextResponse.json({ ok: true, finance: nextFinance });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (err: any) {
    console.error('[Finance API POST error]:', err);
    return NextResponse.json({ error: 'internal_error', message: err?.message }, { status: 500 });
  }
}
