import { prisma, Prisma } from '@cafeos/db';
import { DEFAULT_TIMEZONE, formatYmdInTz } from '../businessDay';
import { FinancialYearService } from './financial-year.service';

export interface ReportFilter {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  staffId?: string;
  paymentMethod?: string;
  category?: string;
  tableId?: string;
  orderType?: string;
}

export class ReportsService {
  /**
   * Helper to ensure startDate and endDate are valid YYYY-MM-DD strings.
   * If not provided, defaults to today in the outlet's timezone.
   */
  static normalizeDateRange(startDate?: string | null, endDate?: string | null, tz = DEFAULT_TIMEZONE): { startDate: string; endDate: string } {
    const today = formatYmdInTz(new Date(), tz);
    const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : today;
    const end = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : today);
    return { startDate: start <= end ? start : end, endDate: start <= end ? end : start };
  }

  /**
   * Get metadata about the reporting period, active financial year, and outlet info.
   */
  static async getReportMeta(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const [financialYears, staffMembers, categories, tables] = await Promise.all([
      FinancialYearService.listFinancialYears(tenantId, outletId).catch(() => []),
      prisma.staffUser.findMany({
        where: { tenantId, OR: [{ outletId }, { outletId: null }] },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }).catch(() => []),
      prisma.category.findMany({
        where: { outletId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }).catch(() => []),
      prisma.tableMap.findMany({
        where: { outletId },
        select: { id: true, label: true, seats: true },
        orderBy: { label: 'asc' },
      }).catch(() => []),
    ]);

    // Determine which financial year the selected period falls into
    const activeFY = financialYears.find(
      (fy) => fy.startDate <= filter.startDate && fy.endDate >= filter.endDate
    ) || financialYears.find((fy) => fy.status === 'active') || financialYears[0] || null;

    return {
      period: filter.period,
      startDate: filter.startDate,
      endDate: filter.endDate,
      timezone: tz,
      activeFinancialYear: activeFY,
      financialYears,
      staffMembers,
      categories,
      tables,
    };
  }

  // =========================================================================
  // 1. SALES REPORT
  // =========================================================================
  static async getSalesReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, staffId, orderType } = filter;

    // Filter conditions for orders
    const staffFilterSql = staffId ? Prisma.sql`AND o."staffId" = ${staffId}::uuid` : Prisma.empty;
    const typeFilterSql = orderType ? Prisma.sql`AND o."type" = ${orderType}::text` : Prisma.empty;

    const [dailyRows, refundRows] = await Promise.all([
      prisma.$queryRaw<
        { day: Date; orders: number; gross: number; subtotal: number; discount: number; tax: number; net: number }[]
      >`
        SELECT
          ("settledAt" AT TIME ZONE ${tz})::date AS day,
          COUNT(*)::int AS orders,
          COALESCE(SUM("totalPaise"), 0)::int AS gross,
          COALESCE(SUM("subtotalPaise"), 0)::int AS subtotal,
          COALESCE(SUM("discountPaise"), 0)::int AS discount,
          COALESCE(SUM("cgstPaise" + "sgstPaise" + "igstPaise"), 0)::int AS tax,
          COALESCE(SUM("totalPaise" - ("cgstPaise" + "sgstPaise" + "igstPaise")), 0)::int AS net
        FROM orders o
        WHERE o."outletId" = ${outletId}::uuid
          AND o."status" = 'settled'
          AND o."settledAt" IS NOT NULL
          AND ("settledAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND ("settledAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          ${staffFilterSql}
          ${typeFilterSql}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<{ day: Date; refunds: number }[]>`
        SELECT
          (r."createdAt" AT TIME ZONE ${tz})::date AS day,
          COALESCE(SUM(r."amountPaise"), 0)::int AS refunds
        FROM refunds r
        JOIN orders o ON o.id = r."orderId"
        WHERE o."outletId" = ${outletId}::uuid
          AND (r."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (r."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        GROUP BY 1
      `,
    ]);

    const refundsMap = new Map(refundRows.map((r) => [r.day.toISOString().slice(0, 10), r.refunds]));

    // Build complete date ledger for the range
    const ledger: any[] = [];
    const curr = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const dayDataMap = new Map(dailyRows.map((r) => [r.day.toISOString().slice(0, 10), r]));

    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    while (curr <= end) {
      const dateKey = curr.toISOString().slice(0, 10);
      const row = dayDataMap.get(dateKey);
      const dayOfWeek = DOW[curr.getUTCDay()];
      const dayNum = curr.getUTCDate();
      const monthStr = MONTHS[curr.getUTCMonth()];
      const label = `${dayNum} ${monthStr} (${dayOfWeek})`;

      const orders = row?.orders ?? 0;
      const grossPaise = row?.gross ?? 0;
      const discountPaise = row?.discount ?? 0;
      const taxPaise = row?.tax ?? 0;
      const netSalesPaise = row?.net ?? 0;
      const refundsPaise = refundsMap.get(dateKey) ?? 0;

      ledger.push({
        date: dateKey,
        label,
        orders,
        grossSalesPaise: grossPaise,
        discountPaise,
        taxPaise,
        netSalesPaise,
        refundsPaise,
      });

      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const totalOrders = ledger.reduce((acc, row) => acc + row.orders, 0);
    const grossSalesPaise = ledger.reduce((acc, row) => acc + row.grossSalesPaise, 0);
    const discountPaise = ledger.reduce((acc, row) => acc + row.discountPaise, 0);
    const taxPaise = ledger.reduce((acc, row) => acc + row.taxPaise, 0);
    const netSalesPaise = ledger.reduce((acc, row) => acc + row.netSalesPaise, 0);
    const refundsPaise = ledger.reduce((acc, row) => acc + row.refundsPaise, 0);
    const aovPaise = totalOrders > 0 ? Math.round(grossSalesPaise / totalOrders) : 0;

    return {
      summary: {
        totalOrders,
        grossSalesPaise,
        discountPaise,
        taxPaise,
        netSalesPaise,
        refundsPaise,
        aovPaise,
      },
      ledger,
    };
  }

  // =========================================================================
  // 2. ITEMS / TOP ITEMS REPORT
  // =========================================================================
  static async getItemsReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, category } = filter;

    const catFilterSql = category ? Prisma.sql`AND (c."name" ILIKE ${`%${category}%`} OR c."id"::text = ${category})` : Prisma.empty;

    const rows = await prisma.$queryRaw<
      { itemId: string; name: string; category: string; qty: number; revenue: number; unitPrice: number }[]
    >`
      SELECT
        COALESCE(oi."itemId"::text, oi."nameSnapshot") AS "itemId",
        oi."nameSnapshot" AS name,
        COALESCE(c."name", 'General') AS category,
        SUM(oi.qty)::int AS qty,
        SUM(oi.qty * oi."unitPricePaise")::int AS revenue,
        MAX(oi."unitPricePaise")::int AS "unitPrice"
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      LEFT JOIN menu_items mi ON mi.id = oi."itemId"
      LEFT JOIN categories c ON c.id = mi."categoryId"
      WHERE o."outletId" = ${outletId}::uuid
        AND o."status" = 'settled'
        AND o."settledAt" IS NOT NULL
        AND ("settledAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
        AND ("settledAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        ${catFilterSql}
      GROUP BY 1, 2, 3
      ORDER BY revenue DESC
    `;

    const totalRevenuePaise = rows.reduce((acc, r) => acc + r.revenue, 0);
    const totalItemsSold = rows.reduce((acc, r) => acc + r.qty, 0);

    const items = rows.map((r) => ({
      itemId: r.itemId,
      name: r.name,
      category: r.category,
      qty: r.qty,
      revenuePaise: r.revenue,
      unitPricePaise: r.unitPrice,
      avgPricePaise: r.qty > 0 ? Math.round(r.revenue / r.qty) : 0,
      sharePct: totalRevenuePaise > 0 ? Number(((r.revenue / totalRevenuePaise) * 100).toFixed(1)) : 0,
    }));

    return {
      summary: {
        totalItemsSold,
        totalRevenuePaise,
        uniqueItemCount: items.length,
      },
      items,
    };
  }

  // =========================================================================
  // 3. GST / TAX REPORT
  // =========================================================================
  static async getGstReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate } = filter;

    const orders = await prisma.order.findMany({
      where: {
        outletId,
        status: 'settled',
        settledAt: { not: null },
      },
      include: {
        items: true,
      },
      orderBy: { settledAt: 'asc' },
    });

    // In-memory filter with timezone accuracy
    const filteredOrders = orders.filter((o) => {
      if (!o.settledAt) return false;
      const ymd = formatYmdInTz(o.settledAt, tz);
      return ymd >= startDate && ymd <= endDate;
    });

    const itemIds = Array.from(new Set(filteredOrders.flatMap((o) => o.items.map((i) => i.itemId).filter((id): id is string => !!id))));
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, hsnCode: true, gstRate: true, category: { select: { name: true } } },
    });
    const menuItemMap = new Map(menuItems.map((i) => [i.id, i]));

    let totalSalesPaise = 0;
    let totalTaxablePaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;
    let totalExemptPaise = 0;
    let totalDiscountPaise = 0;

    const rateSummary: Record<number, { taxable: number; cgst: number; sgst: number; igst: number; revenue: number }> = {};
    const hsnSummary: Record<string, { qty: number; taxable: number; cgst: number; sgst: number; igst: number }> = {};

    filteredOrders.forEach((o) => {
      totalSalesPaise += o.totalPaise;
      totalCgstPaise += o.cgstPaise;
      totalSgstPaise += o.sgstPaise;
      totalIgstPaise += o.igstPaise;
      totalDiscountPaise += o.discountPaise;

      const isInterstate = o.igstPaise > 0;
      const orderTaxAmt = o.cgstPaise + o.sgstPaise + o.igstPaise;
      const baseTaxable = Math.max(0, o.subtotalPaise - orderTaxAmt);
      totalTaxablePaise += baseTaxable;

      o.items.forEach((item) => {
        const dbItem = item.itemId ? menuItemMap.get(item.itemId) : null;
        const rate = dbItem ? Number(dbItem.gstRate) : 5;
        const hsn = dbItem?.hsnCode || (item.itemId ? '9963' : '—');
        const catName = dbItem?.category?.name?.toLowerCase() ?? '';
        const isExempt = catName.includes('exempt') || catName.includes('zero') || rate === 0;

        const modifiersPrice = Array.isArray(item.modifiers)
          ? (item.modifiers as any[]).reduce((sum, m) => sum + (m.pricePaise ?? 0), 0)
          : 0;
        const itemLineTotal = (item.unitPricePaise + modifiersPrice) * item.qty;

        if (isExempt) totalExemptPaise += itemLineTotal;

        let lineTax = 0;
        if (orderTaxAmt > 0 && o.subtotalPaise > 0) {
          lineTax = Math.round((itemLineTotal / o.subtotalPaise) * orderTaxAmt);
        }

        let lineCgst = 0;
        let lineSgst = 0;
        let lineIgst = 0;

        if (isInterstate) {
          lineIgst = lineTax;
        } else {
          lineCgst = Math.round(lineTax / 2);
          lineSgst = lineTax - lineCgst;
        }

        const lineTaxable = Math.max(0, itemLineTotal - lineTax);

        if (!rateSummary[rate]) {
          rateSummary[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, revenue: 0 };
        }
        rateSummary[rate].taxable += lineTaxable;
        rateSummary[rate].cgst += lineCgst;
        rateSummary[rate].sgst += lineSgst;
        rateSummary[rate].igst += lineIgst;
        rateSummary[rate].revenue += itemLineTotal;

        if (!hsnSummary[hsn]) {
          hsnSummary[hsn] = { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        }
        hsnSummary[hsn].qty += item.qty;
        hsnSummary[hsn].taxable += lineTaxable;
        hsnSummary[hsn].cgst += lineCgst;
        hsnSummary[hsn].sgst += lineSgst;
        hsnSummary[hsn].igst += lineIgst;
      });
    });

    const totalTaxPaise = totalCgstPaise + totalSgstPaise + totalIgstPaise;
    const netSalesPaise = totalSalesPaise - totalTaxPaise;

    const byRate = Object.entries(rateSummary)
      .map(([rateStr, v]) => {
        const rate = Number(rateStr);
        return {
          rate,
          slab: rate === 0 ? 'Tax-free (0%)' : `${rate}% GST`,
          taxablePaise: v.taxable,
          cgstPaise: v.cgst,
          sgstPaise: v.sgst,
          igstPaise: v.igst,
          totalTaxPaise: v.cgst + v.sgst + v.igst,
          revenuePaise: v.revenue,
        };
      })
      .sort((a, b) => a.rate - b.rate);

    const hsnList = Object.entries(hsnSummary)
      .map(([hsn, v]) => ({
        hsn,
        qty: v.qty,
        taxablePaise: v.taxable,
        cgstPaise: v.cgst,
        sgstPaise: v.sgst,
        igstPaise: v.igst,
        totalTaxPaise: v.cgst + v.sgst + v.igst,
      }))
      .sort((a, b) => b.taxablePaise - a.taxablePaise);

    return {
      summary: {
        totalSalesPaise,
        taxableSalesPaise: totalTaxablePaise,
        nonTaxableSalesPaise: totalExemptPaise,
        cgstPaise: totalCgstPaise,
        sgstPaise: totalSgstPaise,
        igstPaise: totalIgstPaise,
        totalTaxPaise,
        netSalesPaise,
        effectiveTaxRate: totalTaxablePaise > 0 ? Number(((totalTaxPaise / totalTaxablePaise) * 100).toFixed(1)) : 0,
      },
      byRate,
      hsnSummary: hsnList,
    };
  }

  // =========================================================================
  // 4. PAYMENTS REPORT
  // =========================================================================
  static async getPaymentsReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, paymentMethod } = filter;

    const methodFilterSql = paymentMethod ? Prisma.sql`AND p."method" = ${paymentMethod}::text` : Prisma.empty;

    const [payRows, refundRows] = await Promise.all([
      prisma.$queryRaw<{ method: string; count: number; gross: number }[]>`
        SELECT
          p."method"::text AS method,
          COUNT(*)::int AS count,
          COALESCE(SUM(p."amountPaise"), 0)::int AS gross
        FROM payments p
        WHERE p."outletId" = ${outletId}::uuid
          AND p."status" = 'success'
          AND (p."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (p."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          ${methodFilterSql}
        GROUP BY 1
        ORDER BY gross DESC
      `,
      prisma.$queryRaw<{ method: string; refunds: number }[]>`
        SELECT
          p."method"::text AS method,
          COALESCE(SUM(r."amountPaise"), 0)::int AS refunds
        FROM refunds r
        JOIN payments p ON p.id = r."paymentId"
        WHERE p."outletId" = ${outletId}::uuid
          AND (r."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (r."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        GROUP BY 1
      `,
    ]);

    const refundsMap = new Map(refundRows.map((r) => [r.method, r.refunds]));
    const totalCollectionPaise = payRows.reduce((acc, r) => acc + r.gross, 0);
    const totalTransactions = payRows.reduce((acc, r) => acc + r.count, 0);
    const totalRefundsPaise = refundRows.reduce((acc, r) => acc + r.refunds, 0);

    const methods = payRows.map((r) => {
      const refundPaise = refundsMap.get(r.method) ?? 0;
      const netPaise = Math.max(0, r.gross - refundPaise);
      const label = r.method.toUpperCase();
      return {
        method: r.method,
        label,
        count: r.count,
        grossPaise: r.gross,
        refundPaise,
        netPaise,
        sharePct: totalCollectionPaise > 0 ? Number(((r.gross / totalCollectionPaise) * 100).toFixed(1)) : 0,
      };
    });

    const cashRow = methods.find((m) => m.method.toLowerCase() === 'cash');
    const upiRow = methods.find((m) => m.method.toLowerCase() === 'upi');
    const cardRow = methods.find((m) => m.method.toLowerCase() === 'card');
    const otherRows = methods.filter((m) => !['cash', 'upi', 'card'].includes(m.method.toLowerCase()));

    return {
      summary: {
        totalCollectionPaise,
        totalTransactions,
        cashCollectionPaise: cashRow?.grossPaise ?? 0,
        upiCollectionPaise: upiRow?.grossPaise ?? 0,
        cardCollectionPaise: cardRow?.grossPaise ?? 0,
        otherCollectionPaise: otherRows.reduce((acc, r) => acc + r.grossPaise, 0),
        totalRefundsPaise,
        netCollectionPaise: Math.max(0, totalCollectionPaise - totalRefundsPaise),
      },
      methods,
    };
  }

  // =========================================================================
  // 5. EXPENSES REPORT
  // =========================================================================
  static async getExpensesReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, category } = filter;

    const whereClause: any = {
      outletId,
      businessDate: { gte: startDate, lte: endDate },
    };
    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { businessDate: 'desc' },
    });

    const totalExpensesPaise = expenses.reduce((acc, e) => acc + e.amountPaise, 0);
    const totalGstPaise = expenses.reduce((acc, e) => acc + e.gstPaise, 0);
    const cashExpensesPaise = expenses
      .filter((e) => e.method?.toLowerCase() === 'cash')
      .reduce((acc, e) => acc + e.amountPaise, 0);
    const bankExpensesPaise = totalExpensesPaise - cashExpensesPaise;

    // Group by category
    const catMap = new Map<string, { count: number; amountPaise: number }>();
    expenses.forEach((e) => {
      const c = e.category || 'General';
      const cur = catMap.get(c) || { count: 0, amountPaise: 0 };
      cur.count += 1;
      cur.amountPaise += e.amountPaise;
      catMap.set(c, cur);
    });

    const byCategory = Array.from(catMap.entries())
      .map(([catName, data]) => ({
        category: catName,
        count: data.count,
        amountPaise: data.amountPaise,
        sharePct: totalExpensesPaise > 0 ? Number(((data.amountPaise / totalExpensesPaise) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amountPaise - a.amountPaise);

    return {
      summary: {
        totalExpensesPaise,
        totalGstPaise,
        expenseCount: expenses.length,
        cashExpensesPaise,
        bankExpensesPaise,
      },
      byCategory,
      expenses: expenses.map((e) => ({
        id: e.id,
        date: e.businessDate,
        category: e.category,
        vendor: e.vendor || '—',
        amountPaise: e.amountPaise,
        gstPaise: e.gstPaise,
        method: e.method,
        status: e.status,
        reference: e.reference || '—',
        notes: e.notes || '',
      })),
    };
  }

  // =========================================================================
  // 6. STAFF REPORT
  // =========================================================================
  static async getStaffReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, staffId } = filter;

    const staffFilterSql = staffId ? Prisma.sql`AND s.id = ${staffId}::uuid` : Prisma.empty;

    const [salesRows, refundRows, cancelRows] = await Promise.all([
      prisma.$queryRaw<
        { staffId: string; name: string; role: string; orders: number; gross: number; discounts: number; net: number }[]
      >`
        SELECT
          s.id::text AS "staffId",
          s.name AS name,
          s.role AS role,
          COUNT(o.id)::int AS orders,
          COALESCE(SUM(o."totalPaise"), 0)::int AS gross,
          COALESCE(SUM(o."discountPaise"), 0)::int AS discounts,
          COALESCE(SUM(o."totalPaise" - (o."cgstPaise" + o."sgstPaise" + o."igstPaise")), 0)::int AS net
        FROM staff_users s
        LEFT JOIN orders o ON o."staffId" = s.id
          AND o."outletId" = ${outletId}::uuid
          AND o."status" = 'settled'
          AND o."settledAt" IS NOT NULL
          AND ("settledAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND ("settledAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        WHERE s."tenantId" = ${tenantId}::uuid
          AND (s."outletId" = ${outletId}::uuid OR s."outletId" IS NULL)
          ${staffFilterSql}
        GROUP BY s.id, s.name, s.role
        ORDER BY gross DESC
      `,
      prisma.$queryRaw<{ staffId: string; refunds: number }[]>`
        SELECT
          r."approvedBy"::text AS "staffId",
          COALESCE(SUM(r."amountPaise"), 0)::int AS refunds
        FROM refunds r
        JOIN orders o ON o.id = r."orderId"
        WHERE o."outletId" = ${outletId}::uuid
          AND (r."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (r."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          AND r."approvedBy" IS NOT NULL
        GROUP BY 1
      `,
      prisma.$queryRaw<{ staffId: string; cancels: number }[]>`
        SELECT
          o."staffId"::text AS "staffId",
          COUNT(*)::int AS cancels
        FROM orders o
        WHERE o."outletId" = ${outletId}::uuid
          AND o."status" = 'cancelled'
          AND (o."placedAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (o."placedAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          AND o."staffId" IS NOT NULL
        GROUP BY 1
      `,
    ]);

    const refundsMap = new Map(refundRows.map((r) => [r.staffId, r.refunds]));
    const cancelsMap = new Map(cancelRows.map((r) => [r.staffId, r.cancels]));

    const staffList = salesRows.map((s) => {
      const refundsPaise = refundsMap.get(s.staffId) ?? 0;
      const cancelledOrders = cancelsMap.get(s.staffId) ?? 0;
      const aovPaise = s.orders > 0 ? Math.round(s.gross / s.orders) : 0;
      return {
        staffId: s.staffId,
        name: s.name,
        role: s.role,
        orders: s.orders,
        grossSalesPaise: s.gross,
        netSalesPaise: s.net,
        discountsPaise: s.discounts,
        refundsPaise,
        aovPaise,
        cancelledOrders,
      };
    });

    const totalStaffSalesPaise = staffList.reduce((acc, s) => acc + s.grossSalesPaise, 0);
    const totalOrdersHandled = staffList.reduce((acc, s) => acc + s.orders, 0);
    const totalDiscountsGivenPaise = staffList.reduce((acc, s) => acc + s.discountsPaise, 0);

    return {
      summary: {
        activeStaffCount: staffList.filter((s) => s.orders > 0).length,
        totalStaffSalesPaise,
        totalOrdersHandled,
        totalDiscountsGivenPaise,
      },
      staff: staffList,
    };
  }

  // =========================================================================
  // 7. DISCOUNTS REPORT
  // =========================================================================
  static async getDiscountsReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, staffId } = filter;

    const staffFilterSql = staffId ? Prisma.sql`AND o."staffId" = ${staffId}::uuid` : Prisma.empty;

    const [discountOrders, byTypeRows] = await Promise.all([
      prisma.$queryRaw<
        { id: string; number: number; date: Date; type: string; staffName: string; subtotal: number; discount: number; total: number }[]
      >`
        SELECT
          o.id::text AS id,
          o.number AS number,
          ("settledAt" AT TIME ZONE ${tz}) AS date,
          o.type::text AS type,
          COALESCE(s.name, 'Cashier') AS "staffName",
          o."subtotalPaise"::int AS subtotal,
          o."discountPaise"::int AS discount,
          o."totalPaise"::int AS total
        FROM orders o
        LEFT JOIN staff_users s ON s.id = o."staffId"
        WHERE o."outletId" = ${outletId}::uuid
          AND o."status" = 'settled'
          AND o."discountPaise" > 0
          AND o."settledAt" IS NOT NULL
          AND ("settledAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND ("settledAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          ${staffFilterSql}
        ORDER BY o."discountPaise" DESC
        LIMIT 50
      `,
      prisma.$queryRaw<{ type: string; orders: number; discount: number }[]>`
        SELECT
          o.type::text AS type,
          COUNT(*)::int AS orders,
          COALESCE(SUM(o."discountPaise"), 0)::int AS discount
        FROM orders o
        WHERE o."outletId" = ${outletId}::uuid
          AND o."status" = 'settled'
          AND o."discountPaise" > 0
          AND o."settledAt" IS NOT NULL
          AND ("settledAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND ("settledAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          ${staffFilterSql}
        GROUP BY 1
      `,
    ]);

    const totalDiscountPaise = byTypeRows.reduce((acc, r) => acc + r.discount, 0);
    const discountedOrdersCount = byTypeRows.reduce((acc, r) => acc + r.orders, 0);

    const byType = byTypeRows.map((r) => ({
      type: r.type === 'dine_in' ? 'Dine In' : 'Takeaway',
      orders: r.orders,
      amountPaise: r.discount,
      sharePct: totalDiscountPaise > 0 ? Number(((r.discount / totalDiscountPaise) * 100).toFixed(1)) : 0,
    }));

    return {
      summary: {
        totalDiscountPaise,
        discountedOrdersCount,
        avgDiscountPerOrderPaise: discountedOrdersCount > 0 ? Math.round(totalDiscountPaise / discountedOrdersCount) : 0,
      },
      byType,
      orders: discountOrders.map((o) => ({
        id: o.id,
        number: o.number,
        date: o.date ? new Date(o.date).toLocaleDateString('en-IN') : '—',
        type: o.type === 'dine_in' ? 'Dine In' : 'Takeaway',
        staffName: o.staffName,
        subtotalPaise: o.subtotal,
        discountPaise: o.discount,
        totalPaise: o.total,
      })),
    };
  }

  // =========================================================================
  // 8. REFUNDS REPORT
  // =========================================================================
  static async getRefundsReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate } = filter;

    const rows = await prisma.$queryRaw<
      { id: string; date: Date; orderNumber: number; amount: number; method: string; reason: string; approvedByName: string }[]
    >`
      SELECT
        r.id::text AS id,
        r."createdAt" AS date,
        o.number AS "orderNumber",
        r."amountPaise"::int AS amount,
        p.method::text AS method,
        COALESCE(r.reason, 'Standard Refund') AS reason,
        COALESCE(s.name, 'Admin') AS "approvedByName"
      FROM refunds r
      JOIN orders o ON o.id = r."orderId"
      JOIN payments p ON p.id = r."paymentId"
      LEFT JOIN staff_users s ON s.id = r."approvedBy"
      WHERE o."outletId" = ${outletId}::uuid
        AND (r."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
        AND (r."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
      ORDER BY r."createdAt" DESC
    `;

    const totalRefundPaise = rows.reduce((acc, r) => acc + r.amount, 0);
    const cashRefundsPaise = rows.filter((r) => r.method.toLowerCase() === 'cash').reduce((acc, r) => acc + r.amount, 0);
    const digitalRefundsPaise = totalRefundPaise - cashRefundsPaise;

    return {
      summary: {
        totalRefundPaise,
        refundCount: rows.length,
        cashRefundsPaise,
        digitalRefundsPaise,
      },
      refunds: rows.map((r) => ({
        id: r.id,
        date: r.date ? new Date(r.date).toLocaleString('en-IN') : '—',
        orderNumber: r.orderNumber,
        amountPaise: r.amount,
        method: r.method.toUpperCase(),
        reason: r.reason,
        approvedByName: r.approvedByName,
      })),
    };
  }

  // =========================================================================
  // 9. TABLES REPORT
  // =========================================================================
  static async getTablesReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, tableId } = filter;

    const tableFilterSql = tableId ? Prisma.sql`AND t.id = ${tableId}::uuid` : Prisma.empty;

    const rows = await prisma.$queryRaw<
      { tableId: string; label: string; seats: number; orders: number; sales: number; aov: number }[]
    >`
      SELECT
        t.id::text AS "tableId",
        t.label AS label,
        t.seats AS seats,
        COUNT(o.id)::int AS orders,
        COALESCE(SUM(o."totalPaise"), 0)::int AS sales,
        COALESCE(AVG(o."totalPaise"), 0)::int AS aov
      FROM tables_map t
      LEFT JOIN orders o ON o."tableId" = t.id
        AND o."status" = 'settled'
        AND o."settledAt" IS NOT NULL
        AND ("settledAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
        AND ("settledAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
      WHERE t."outletId" = ${outletId}::uuid
        ${tableFilterSql}
      GROUP BY t.id, t.label, t.seats
      ORDER BY sales DESC
    `;

    const totalTableSalesPaise = rows.reduce((acc, r) => acc + r.sales, 0);
    const activeTables = rows.filter((r) => r.orders > 0);

    return {
      summary: {
        totalTables: rows.length,
        activeTablesWithOrders: activeTables.length,
        totalTableSalesPaise,
        avgSalesPerTablePaise: rows.length > 0 ? Math.round(totalTableSalesPaise / rows.length) : 0,
      },
      tables: rows.map((r) => ({
        tableId: r.tableId,
        label: r.label,
        seats: r.seats,
        orders: r.orders,
        salesPaise: r.sales,
        aovPaise: r.aov,
      })),
    };
  }

  // =========================================================================
  // 10. KOT / KITCHEN REPORT
  // =========================================================================
  static async getKotReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate } = filter;

    const [statusRows, stationRows, topItems] = await Promise.all([
      prisma.$queryRaw<{ status: string; count: number }[]>`
        SELECT
          k.status::text AS status,
          COUNT(*)::int AS count
        FROM kots k
        WHERE k."outletId" = ${outletId}::uuid
          AND (k."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (k."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        GROUP BY 1
      `,
      prisma.$queryRaw<{ station: string; total: number; completed: number; cancelled: number }[]>`
        SELECT
          COALESCE(k.station, 'main') AS station,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE k.status = 'served' OR k.status = 'ready')::int AS completed,
          COUNT(*) FILTER (WHERE k.status = 'cancelled')::int AS cancelled
        FROM kots k
        WHERE k."outletId" = ${outletId}::uuid
          AND (k."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (k."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        GROUP BY 1
        ORDER BY total DESC
      `,
      prisma.$queryRaw<{ name: string; qty: number; station: string }[]>`
        SELECT
          oi."nameSnapshot" AS name,
          SUM(oi.qty)::int AS qty,
          COALESCE(oi.station, 'main') AS station
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        WHERE o."outletId" = ${outletId}::uuid
          AND (o."placedAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (o."placedAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        GROUP BY 1, 3
        ORDER BY qty DESC
        LIMIT 20
      `,
    ]);

    const totalKots = statusRows.reduce((acc, r) => acc + r.count, 0);
    const completedKots = statusRows
      .filter((r) => r.status === 'served' || r.status === 'ready')
      .reduce((acc, r) => acc + r.count, 0);
    const queuedKots = statusRows
      .filter((r) => r.status === 'queued' || r.status === 'preparing')
      .reduce((acc, r) => acc + r.count, 0);
    const cancelledKots = statusRows
      .filter((r) => r.status === 'cancelled')
      .reduce((acc, r) => acc + r.count, 0);

    return {
      summary: {
        totalKots,
        completedKots,
        queuedKots,
        cancelledKots,
      },
      byStation: stationRows.map((s) => ({
        station: s.station.toUpperCase(),
        total: s.total,
        completed: s.completed,
        cancelled: s.cancelled,
      })),
      topKitchenItems: topItems.map((i) => ({
        name: i.name,
        qty: i.qty,
        station: i.station.toUpperCase(),
      })),
    };
  }

  // =========================================================================
  // 11. CASH DRAWER REPORT
  // =========================================================================
  static async getCashDrawerReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate } = filter;

    const [closings, movements, cashOrders] = await Promise.all([
      prisma.dayClosing.findMany({
        where: {
          outletId,
          businessDate: { gte: startDate, lte: endDate },
        },
        orderBy: { businessDate: 'asc' },
      }),
      prisma.cashMovement.findMany({
        where: {
          outletId,
          businessDate: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.$queryRaw<{ cashSales: number }[]>`
        SELECT COALESCE(SUM(p."amountPaise"), 0)::int AS "cashSales"
        FROM payments p
        WHERE p."outletId" = ${outletId}::uuid
          AND p."status" = 'success'
          AND p."method" = 'cash'
          AND (p."createdAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (p."createdAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
      `,
    ]);

    // Aggregate values
    let openingCashPaise = 0;
    let cashSalesPaise = cashOrders[0]?.cashSales ?? 0;
    let cashExpensesPaise = 0;
    let cashRefundsPaise = 0;
    let cashInPaise = 0;
    let cashOutPaise = 0;
    let expectedClosingCashPaise = 0;
    let actualClosingCashPaise = 0;
    let variancePaise = 0;

    if (closings.length > 0) {
      openingCashPaise = closings[0]?.openingCashPaise ?? 0;
      actualClosingCashPaise = closings[closings.length - 1]?.actualCashPaise ?? 0;
      closings.forEach((c) => {
        cashExpensesPaise += c.cashExpensesPaise;
        cashRefundsPaise += c.cashRefundsPaise;
        cashInPaise += c.cashInPaise;
        cashOutPaise += c.cashOutPaise;
        variancePaise += c.cashVariancePaise;
      });
      expectedClosingCashPaise = openingCashPaise + cashSalesPaise + cashInPaise - cashExpensesPaise - cashRefundsPaise - cashOutPaise;
    } else {
      // If no closed day yet in window, aggregate from raw cash movements
      movements.forEach((m) => {
        if (m.type === 'inflow') cashInPaise += m.amountPaise;
        else if (m.type === 'outflow') cashOutPaise += m.amountPaise;
      });
      expectedClosingCashPaise = openingCashPaise + cashSalesPaise + cashInPaise - cashExpensesPaise - cashRefundsPaise - cashOutPaise;
      actualClosingCashPaise = expectedClosingCashPaise;
    }

    return {
      summary: {
        openingCashPaise,
        cashSalesPaise,
        cashExpensesPaise,
        cashRefundsPaise,
        cashInPaise,
        cashOutPaise,
        expectedClosingCashPaise,
        actualClosingCashPaise,
        differencePaise: variancePaise || (actualClosingCashPaise - expectedClosingCashPaise),
      },
      closings: closings.map((c) => ({
        id: c.id,
        businessDate: c.businessDate,
        status: c.status,
        openingCashPaise: c.openingCashPaise,
        cashSalesPaise: c.cashSalesPaise,
        cashExpensesPaise: c.cashExpensesPaise,
        cashRefundsPaise: c.cashRefundsPaise,
        expectedCashPaise: c.expectedCashPaise,
        actualCashPaise: c.actualCashPaise,
        cashVariancePaise: c.cashVariancePaise,
        closedByName: c.notes || 'Staff',
      })),
      movements: movements.map((m) => ({
        id: m.id,
        date: m.businessDate,
        type: m.type,
        category: m.category,
        amountPaise: m.amountPaise,
        reason: m.reason || '—',
        staffName: m.staffName || 'Staff',
        destination: m.destination || '—',
      })),
    };
  }

  // =========================================================================
  // 12. ORDERS / ORDER SUMMARY
  // =========================================================================
  static async getOrdersReport(outletId: string, tenantId: string, filter: ReportFilter, tz = DEFAULT_TIMEZONE) {
    const { startDate, endDate, orderType } = filter;

    const typeFilterSql = orderType ? Prisma.sql`AND o."type" = ${orderType}::text` : Prisma.empty;

    const [statusRows, typeRows, ordersList] = await Promise.all([
      prisma.$queryRaw<{ status: string; count: number; total: number }[]>`
        SELECT
          o.status::text AS status,
          COUNT(*)::int AS count,
          COALESCE(SUM(o."totalPaise"), 0)::int AS total
        FROM orders o
        WHERE o."outletId" = ${outletId}::uuid
          AND (o."placedAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (o."placedAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          ${typeFilterSql}
        GROUP BY 1
      `,
      prisma.$queryRaw<{ type: string; count: number; total: number }[]>`
        SELECT
          o.type::text AS type,
          COUNT(*)::int AS count,
          COALESCE(SUM(o."totalPaise"), 0)::int AS total
        FROM orders o
        WHERE o."outletId" = ${outletId}::uuid
          AND o."status" = 'settled'
          AND (o."placedAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (o."placedAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
        GROUP BY 1
      `,
      prisma.$queryRaw<
        { id: string; number: number; date: Date; type: string; status: string; tableLabel: string; staffName: string; subtotal: number; discount: number; tax: number; total: number }[]
      >`
        SELECT
          o.id::text AS id,
          o.number AS number,
          (o."placedAt" AT TIME ZONE ${tz}) AS date,
          o.type::text AS type,
          o.status::text AS status,
          COALESCE(t.label, 'Takeaway') AS "tableLabel",
          COALESCE(s.name, 'Unassigned') AS "staffName",
          o."subtotalPaise"::int AS subtotal,
          o."discountPaise"::int AS discount,
          (o."cgstPaise" + o."sgstPaise" + o."igstPaise")::int AS tax,
          o."totalPaise"::int AS total
        FROM orders o
        LEFT JOIN tables_map t ON t.id = o."tableId"
        LEFT JOIN staff_users s ON s.id = o."staffId"
        WHERE o."outletId" = ${outletId}::uuid
          AND (o."placedAt" AT TIME ZONE ${tz})::date >= ${startDate}::date
          AND (o."placedAt" AT TIME ZONE ${tz})::date <= ${endDate}::date
          ${typeFilterSql}
        ORDER BY o."placedAt" DESC
        LIMIT 60
      `,
    ]);

    const totalOrders = statusRows.reduce((acc, r) => acc + r.count, 0);
    const settledRow = statusRows.find((r) => r.status === 'settled');
    const openRow = statusRows.find((r) => r.status === 'open');
    const cancelledRow = statusRows.find((r) => r.status === 'cancelled');

    const settledOrders = settledRow?.count ?? 0;
    const settledRevenuePaise = settledRow?.total ?? 0;
    const openOrders = openRow?.count ?? 0;
    const cancelledOrders = cancelledRow?.count ?? 0;

    const dineInRow = typeRows.find((r) => r.type === 'dine_in');
    const takeawayRow = typeRows.find((r) => r.type === 'takeaway');

    return {
      summary: {
        totalOrders,
        settledOrders,
        openOrders,
        cancelledOrders,
        dineInOrders: dineInRow?.count ?? 0,
        dineInRevenuePaise: dineInRow?.total ?? 0,
        takeawayOrders: takeawayRow?.count ?? 0,
        takeawayRevenuePaise: takeawayRow?.total ?? 0,
        aovPaise: settledOrders > 0 ? Math.round(settledRevenuePaise / settledOrders) : 0,
      },
      orders: ordersList.map((o) => ({
        id: o.id,
        number: o.number,
        date: o.date ? new Date(o.date).toLocaleString('en-IN') : '—',
        type: o.type === 'dine_in' ? 'Dine In' : 'Takeaway',
        status: o.status.toUpperCase(),
        tableLabel: o.tableLabel,
        staffName: o.staffName,
        subtotalPaise: o.subtotal,
        discountPaise: o.discount,
        taxPaise: o.tax,
        totalPaise: o.total,
      })),
    };
  }
}
