import { prisma } from '@/lib/db';
import type {
  StoreKpi, OrganizationKpi, TrendPoint, TopItem, DashboardData,
  DailySummary, PaymentBreakdown,
} from '@/types';

const TZ = 'Asia/Kolkata';

// ======================== Multi-Store Aware Dashboard ========================

/**
 * Get KPIs for a single outlet (store-level dashboard).
 */
export async function getStoreDashboard(outletId: string): Promise<{
  kpi: StoreKpi;
  trend: TrendPoint[];
  topItems: TopItem[];
}> {
  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { id: true, name: true },
  });
  if (!outlet) throw new Error(`Outlet not found: ${outletId}`);

  const [today, yesterday, trendRows, items] = await Promise.all([
    storeKpis(outletId, 0),
    storeKpis(outletId, 1),
    storeTrend(outletId),
    storeTopItems(outletId),
  ]);

  const kpi: StoreKpi = {
    storeId:         outlet.id,
    storeName:       outlet.name,
    todaySalesPaise: today.gross,
    todayOrders:     today.orders,
    aovPaise:        today.orders > 0 ? Math.round(today.gross / today.orders) : 0,
    salesDeltaPct:   pctDelta(today.gross, yesterday.gross),
    ordersDeltaPct:  pctDelta(today.orders, yesterday.orders),
  };

  return { kpi, trend: trendRows, topItems: items };
}

/**
 * Get aggregated KPIs across multiple outlets (org-level dashboard).
 * Only includes outlets the user is authorized to access.
 */
export async function getOrganizationDashboard(outletIds: string[]): Promise<{
  kpi: OrganizationKpi;
  trend: TrendPoint[];
  topItems: TopItem[];
}> {
  if (outletIds.length === 0) {
    return {
      kpi: {
        totalSalesPaise: 0, totalOrders: 0, aovPaise: 0,
        storesOnline: 0, storesTotal: 0,
      },
      trend: [],
      topItems: [],
    };
  }

  const [todayRows, yesterdayRows, trendRows, items, storeSales] = await Promise.all([
    orgKpis(outletIds, 0),
    orgKpis(outletIds, 1),
    orgTrend(outletIds),
    orgTopItems(outletIds),
    storeBreakdown(outletIds),
  ]);

  const totalSales = todayRows.reduce((s, r) => s + r.gross, 0);
  const totalOrders = todayRows.reduce((s, r) => s + r.orders, 0);
  const totalSalesYest = yesterdayRows.reduce((s, r) => s + r.gross, 0);

  const topStore = storeSales.sort((a, b) => b.gross - a.gross)[0];

  const kpi: OrganizationKpi = {
    totalSalesPaise: totalSales,
    totalOrders,
    aovPaise:        totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
    storesOnline:    0, // populated by shop-status API
    storesTotal:     outletIds.length,
    topStore: topStore
      ? { id: topStore.outletId, name: topStore.outletName, salesPaise: topStore.gross }
      : undefined,
    salesDeltaPct: pctDelta(totalSales, totalSalesYest),
  };

  return { kpi, trend: trendRows, topItems: items };
}

// ======================== Sales Analytics ========================

export async function getSalesForOutlets(
  outletIds: string[],
  from: Date,
  to: Date,
  page = 1,
  limit = 50,
) {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: {
        outletId: { in: outletIds },
        status: { not: 'cancelled' },
        settledAt: { not: null },
        placedAt: { gte: from, lte: to },
      },
      include: {
        outlet: { select: { name: true } },
        payments: { select: { method: true, amountPaise: true, status: true } },
        table: { select: { label: true } },
      },
      orderBy: { placedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({
      where: {
        outletId: { in: outletIds },
        status: { not: 'cancelled' },
        settledAt: { not: null },
        placedAt: { gte: from, lte: to },
      },
    }),
  ]);

  return { data: orders, total, page, limit, hasMore: skip + orders.length < total };
}

export async function getOrdersForOutlets(
  outletIds: string[],
  from: Date,
  to: Date,
  status?: string,
  page = 1,
  limit = 50,
) {
  const skip = (page - 1) * limit;
  const statusFilter = status && status !== 'all' ? { status: status as never } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: {
        outletId: { in: outletIds },
        placedAt: { gte: from, lte: to },
        ...statusFilter,
      },
      include: {
        outlet: { select: { name: true } },
        table: { select: { label: true } },
        _count: { select: { items: true } },
      },
      orderBy: { placedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({
      where: {
        outletId: { in: outletIds },
        placedAt: { gte: from, lte: to },
        ...statusFilter,
      },
    }),
  ]);

  return { data: orders, total, page, limit, hasMore: skip + orders.length < total };
}

// ======================== Reports ========================

export async function getDailySalesReport(
  outletIds: string[],
  from: Date,
  to: Date,
): Promise<DailySummary[]> {
  // Try rollup table first (fast), fall back to live query
  const rollups = await prisma.dailySalesRollup.findMany({
    where: {
      outletId: { in: outletIds },
      day: { gte: from, lte: to },
    },
    include: { outlet: { select: { name: true } } },
    orderBy: { day: 'asc' },
  });

  if (rollups.length > 0) {
    return rollups.map((r) => ({
      date:          r.day.toISOString().slice(0, 10),
      storeId:       r.outletId,
      storeName:     r.outlet.name,
      orders:        r.orders,
      grossPaise:    r.grossPaise,
      discountPaise: r.discountPaise,
      taxPaise:      r.taxPaise,
      netPaise:      r.netPaise,
    }));
  }

  // Live fallback
  const rows = await prisma.$queryRaw<
    { outlet_id: string; day: Date; orders: number; gross: number; discount: number; tax: number }[]
  >`
    SELECT
      "outletId" AS outlet_id,
      ("placedAt" AT TIME ZONE ${TZ})::date AS day,
      COUNT(*)::int AS orders,
      COALESCE(SUM("totalPaise"), 0)::int AS gross,
      COALESCE(SUM("discountPaise"), 0)::int AS discount,
      COALESCE(SUM("cgstPaise" + "sgstPaise" + "igstPaise"), 0)::int AS tax
    FROM orders
    WHERE "outletId" = ANY(${outletIds}::uuid[])
      AND "status" <> 'cancelled'
      AND "placedAt" >= ${from}
      AND "placedAt" <= ${to}
    GROUP BY 1, 2
    ORDER BY 2 ASC
  `;

  const outlets = await prisma.outlet.findMany({
    where: { id: { in: outletIds } },
    select: { id: true, name: true },
  });
  const outletMap = new Map(outlets.map((o) => [o.id, o.name]));

  return rows.map((r) => ({
    date:          r.day.toISOString().slice(0, 10),
    storeId:       r.outlet_id,
    storeName:     outletMap.get(r.outlet_id) ?? '',
    orders:        r.orders,
    grossPaise:    r.gross,
    discountPaise: r.discount,
    taxPaise:      r.tax,
    netPaise:      r.gross - r.discount,
  }));
}

export async function getPaymentBreakdown(
  outletIds: string[],
  from: Date,
  to: Date,
): Promise<PaymentBreakdown[]> {
  const rows = await prisma.$queryRaw<
    { method: string; amount: number; count: number }[]
  >`
    SELECT
      p.method,
      COALESCE(SUM(p."amountPaise"), 0)::int AS amount,
      COUNT(*)::int AS count
    FROM payments p
    JOIN orders o ON o.id = p."orderId"
    WHERE p."outletId" = ANY(${outletIds}::uuid[])
      AND p.status = 'success'
      AND o."placedAt" >= ${from}
      AND o."placedAt" <= ${to}
    GROUP BY 1
    ORDER BY amount DESC
  `;

  return rows.map((r) => ({
    method:      r.method,
    amountPaise: r.amount,
    count:       r.count,
  }));
}

// ======================== Internal Helpers ========================

async function storeKpis(outletId: string, daysAgo: number) {
  const rows = await prisma.$queryRaw<{ orders: number; gross: number }[]>`
    SELECT
      COUNT(*)::int AS orders,
      COALESCE(SUM("totalPaise"), 0)::int AS gross
    FROM orders
    WHERE "outletId" = ${outletId}::uuid
      AND "status" <> 'cancelled'
      AND ("placedAt" AT TIME ZONE ${TZ})::date
          = (now() AT TIME ZONE ${TZ})::date - ${daysAgo}::int
  `;
  return rows[0] ?? { orders: 0, gross: 0 };
}

async function storeTrend(outletId: string): Promise<TrendPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; orders: number; gross: number }[]>`
    SELECT
      ("placedAt" AT TIME ZONE ${TZ})::date AS day,
      COUNT(*)::int AS orders,
      COALESCE(SUM("totalPaise"), 0)::int AS gross
    FROM orders
    WHERE "outletId" = ${outletId}::uuid
      AND "status" <> 'cancelled'
      AND ("placedAt" AT TIME ZONE ${TZ})::date > (now() AT TIME ZONE ${TZ})::date - 7
    GROUP BY 1
  `;
  return fillTrend(rows);
}

async function storeTopItems(outletId: string): Promise<TopItem[]> {
  const rows = await prisma.$queryRaw<
    { name: string; qty: number; revenue: number }[]
  >`
    SELECT
      oi."nameSnapshot" AS name,
      SUM(oi.qty)::int AS qty,
      SUM(oi.qty * oi."unitPricePaise")::int AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    WHERE o."outletId" = ${outletId}::uuid
      AND o."status" <> 'cancelled'
      AND o."placedAt" >= now() - interval '30 days'
    GROUP BY 1
    ORDER BY revenue DESC
    LIMIT 6
  `;
  return rows.map((r) => ({ name: r.name, qty: r.qty, revenuePaise: r.revenue }));
}

async function orgKpis(outletIds: string[], daysAgo: number) {
  const rows = await prisma.$queryRaw<
    { outlet_id: string; orders: number; gross: number }[]
  >`
    SELECT
      "outletId" AS outlet_id,
      COUNT(*)::int AS orders,
      COALESCE(SUM("totalPaise"), 0)::int AS gross
    FROM orders
    WHERE "outletId" = ANY(${outletIds}::uuid[])
      AND "status" <> 'cancelled'
      AND ("placedAt" AT TIME ZONE ${TZ})::date
          = (now() AT TIME ZONE ${TZ})::date - ${daysAgo}::int
    GROUP BY 1
  `;
  return rows;
}

async function orgTrend(outletIds: string[]): Promise<TrendPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; orders: number; gross: number }[]>`
    SELECT
      ("placedAt" AT TIME ZONE ${TZ})::date AS day,
      COUNT(*)::int AS orders,
      COALESCE(SUM("totalPaise"), 0)::int AS gross
    FROM orders
    WHERE "outletId" = ANY(${outletIds}::uuid[])
      AND "status" <> 'cancelled'
      AND ("placedAt" AT TIME ZONE ${TZ})::date > (now() AT TIME ZONE ${TZ})::date - 7
    GROUP BY 1
  `;
  return fillTrend(rows);
}

async function orgTopItems(outletIds: string[]): Promise<TopItem[]> {
  const rows = await prisma.$queryRaw<
    { name: string; qty: number; revenue: number }[]
  >`
    SELECT
      oi."nameSnapshot" AS name,
      SUM(oi.qty)::int AS qty,
      SUM(oi.qty * oi."unitPricePaise")::int AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    WHERE o."outletId" = ANY(${outletIds}::uuid[])
      AND o."status" <> 'cancelled'
      AND o."placedAt" >= now() - interval '30 days'
    GROUP BY 1
    ORDER BY revenue DESC
    LIMIT 6
  `;
  return rows.map((r) => ({ name: r.name, qty: r.qty, revenuePaise: r.revenue }));
}

async function storeBreakdown(outletIds: string[]) {
  const rows = await prisma.$queryRaw<
    { outlet_id: string; outlet_name: string; orders: number; gross: number }[]
  >`
    SELECT
      o."outletId" AS outlet_id,
      out.name AS outlet_name,
      COUNT(*)::int AS orders,
      COALESCE(SUM(o."totalPaise"), 0)::int AS gross
    FROM orders o
    JOIN outlets out ON out.id = o."outletId"
    WHERE o."outletId" = ANY(${outletIds}::uuid[])
      AND o."status" <> 'cancelled'
      AND (o."placedAt" AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date
    GROUP BY 1, 2
  `;
  return rows.map((r) => ({ outletId: r.outlet_id, outletName: r.outlet_name, gross: r.gross, orders: r.orders }));
}

// ======================== Utilities ========================

function fillTrend(rows: { day: Date; orders: number; gross: number }[]): TrendPoint[] {
  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
  const out: TrendPoint[] = [];
  const base = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    out.push({
      label:      DOW[d.getDay()]!,
      date:       key,
      orders:     hit?.orders ?? 0,
      grossPaise: hit?.gross ?? 0,
    });
  }
  return out;
}

function pctDelta(now: number, prev: number): number | null {
  if (prev === 0) return now > 0 ? 100 : null;
  return Math.round(((now - prev) / prev) * 100);
}
