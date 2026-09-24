import { prisma, PayMethod, OrderStatus } from '@cafeos/db';
import { formatYmdInTz, getWallClockTimeInTz, DEFAULT_TIMEZONE, readBusinessDay } from '../businessDay';
import { DayClosingService } from './day-closing.service';
import { FinancialYearService } from './financial-year.service';

export interface DayBookEntry {
  id: string;
  timestamp: Date;
  dateStr: string;
  timeStr: string;
  type: 'sale' | 'expense' | 'payment' | 'refund' | 'vendor' | 'bank' | 'payroll' | 'cash_drawer';
  reference: string;
  description: string;
  method: string;
  debitPaise: number;  // Inflow (increases liquid cash/bank)
  creditPaise: number; // Outflow (decreases liquid cash/bank)
  status: 'completed' | 'pending' | 'cancelled' | 'refunded' | 'voided';
  source: string;
  metadata?: Record<string, any>;
  financialYearName?: string;
}

export interface DayBookSummary {
  openingBalancePaise: number;
  totalSalesPaise: number;
  totalExpensesPaise: number;
  totalRefundsPaise: number;
  totalDebitPaise: number;
  totalCreditPaise: number;
  netMovementPaise: number;
  closingBalancePaise: number;
  dayClosingRecord?: {
    id: string;
    closingNumber: string;
    status: string;
    closedAt: Date | null;
    closedByName: string | null;
    actualCashPaise: number;
    cashVariancePaise: number;
  } | null;
}

export interface DayBookQueryParams {
  dateFrom?: string;
  dateTo?: string;
  financialYearId?: string;
  type?: string;
  paymentMethod?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortOrder?: 'asc' | 'desc';
}

export class DayBookService {
  /**
   * Resolve date boundaries for Day Book query
   */
  static async resolveDateRange(
    tenantId: string,
    outletId: string,
    params: DayBookQueryParams,
    timezone: string
  ): Promise<{ dateFrom: string; dateTo: string; financialYearName?: string }> {
    let dateFrom = params.dateFrom;
    let dateTo = params.dateTo;
    let financialYearName: string | undefined;

    if (params.financialYearId) {
      const fy = await prisma.financialYear.findFirst({
        where: { id: params.financialYearId, tenantId },
      });
      if (fy) {
        dateFrom = dateFrom ? (dateFrom < fy.startDate ? fy.startDate : dateFrom) : fy.startDate;
        dateTo = dateTo ? (dateTo > fy.endDate ? fy.endDate : dateTo) : fy.endDate;
        financialYearName = fy.name;
      }
    }

    if (!dateFrom || !dateTo) {
      const today = formatYmdInTz(new Date(), timezone);
      dateFrom = dateFrom || today;
      dateTo = dateTo || today;
    }

    return { dateFrom, dateTo, financialYearName };
  }

  /**
   * Main query function returning paginated Day Book register + summary
   */
  static async getDayBook(
    tenantId: string,
    outletId: string,
    params: DayBookQueryParams = {}
  ): Promise<{
    entries: DayBookEntry[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    summary: DayBookSummary;
    dateFrom: string;
    dateTo: string;
    financialYearName?: string;
    timezone: string;
  }> {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { timezone: true, settings: true, tenantId: true },
    });
    if (!outlet || outlet.tenantId !== tenantId) {
      throw new Error('OUTLET_NOT_FOUND');
    }

    const tz = outlet.timezone || DEFAULT_TIMEZONE;
    const bState = readBusinessDay(outlet.settings, new Date(), tz);
    const cutoffHour = bState.cutoffHour ?? 4;

    const { dateFrom, dateTo, financialYearName } = await this.resolveDateRange(
      tenantId,
      outletId,
      params,
      tz
    );

    // Compute UTC timestamp window for order placedAt / payment createdAt queries
    const windowStart = new Date(`${dateFrom}T${String(cutoffHour).padStart(2, '0')}:00:00+05:30`);
    const dateToParts = dateTo.split('-').map(Number);
    const toY = dateToParts[0] ?? 2026;
    const toM = dateToParts[1] ?? 1;
    const toD = dateToParts[2] ?? 1;
    const dateToObj = new Date(Date.UTC(toY, toM - 1, toD + 1));
    const nextDayStr = formatYmdInTz(dateToObj, tz);
    const windowEnd = new Date(`${nextDayStr}T${String(cutoffHour).padStart(2, '0')}:00:00+05:30`);

    const allEntries: DayBookEntry[] = [];

    // ─────────────────────────────────────────────────────────────
    // 1. POS SALES & PAYMENTS (payments & orders)
    // ─────────────────────────────────────────────────────────────
    const payments = await prisma.payment.findMany({
      where: {
        outletId,
        createdAt: { gte: windowStart, lt: windowEnd },
      },
      include: {
        order: {
          select: {
            id: true,
            number: true,
            type: true,
            status: true,
            table: { select: { label: true } },
            customer: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const p of payments) {
      const order = p.order;
      const timeInfo = getWallClockTimeInTz(p.createdAt, tz);
      const isCancelled = order?.status === OrderStatus.cancelled;
      const orderNum = order?.number;
      const tableLabel = order?.table?.label;

      allEntries.push({
        id: `pay-${p.id}`,
        timestamp: p.createdAt,
        dateStr: formatYmdInTz(p.createdAt, tz),
        timeStr: timeInfo.timeStr,
        type: 'sale',
        reference: orderNum ? `INV-${orderNum}` : `PAY-${p.id.slice(0, 8)}`,
        description: `Order #${orderNum ?? '—'} · ${tableLabel ? `Table ${tableLabel}` : order?.type?.toUpperCase() || 'POS'}`,
        method: p.method,
        debitPaise: isCancelled ? 0 : p.amountPaise,
        creditPaise: 0,
        status: isCancelled ? 'cancelled' : p.status === 'success' ? 'completed' : p.status === 'pending' ? 'pending' : p.status === 'refunded' ? 'refunded' : 'cancelled',
        source: 'POS Sales',
        metadata: {
          orderId: p.orderId,
          orderNumber: orderNum,
          tableName: tableLabel,
          orderType: order?.type,
          customerName: order?.customer?.name,
          customerPhone: order?.customer?.phone,
          providerRef: p.providerRef,
          accountingDrCr: `Dr. Liquid Cash/Bank · Cr. Food & Drink Sales Revenue`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. REFUNDS
    // ─────────────────────────────────────────────────────────────
    const refunds = await prisma.refund.findMany({
      where: {
        order: { outletId },
        createdAt: { gte: windowStart, lt: windowEnd },
      },
      include: {
        order: { select: { number: true, table: { select: { label: true } } } },
        payment: { select: { method: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const ref of refunds) {
      const timeInfo = getWallClockTimeInTz(ref.createdAt, tz);
      const orderNum = ref.order?.number;
      allEntries.push({
        id: `ref-${ref.id}`,
        timestamp: ref.createdAt,
        dateStr: formatYmdInTz(ref.createdAt, tz),
        timeStr: timeInfo.timeStr,
        type: 'refund',
        reference: ref.providerRef || `REF-${ref.id.slice(0, 8)}`,
        description: `Customer Refund · Order #${orderNum ?? '—'}${ref.reason ? ` (${ref.reason})` : ''}`,
        method: ref.payment?.method || 'cash',
        debitPaise: 0,
        creditPaise: ref.amountPaise,
        status: 'refunded',
        source: 'POS Refunds',
        metadata: {
          orderId: ref.orderId,
          orderNumber: orderNum,
          reason: ref.reason,
          approvedBy: ref.approvedBy,
          accountingDrCr: `Dr. Sales Returns/Refunds · Cr. Liquid Cash/Bank`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. EXPENSES
    // ─────────────────────────────────────────────────────────────
    const expenses = await prisma.expense.findMany({
      where: {
        outletId,
        businessDate: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const exp of expenses) {
      const timeInfo = getWallClockTimeInTz(exp.paidAt || exp.createdAt, tz);
      const isApproved = exp.status === 'approved';
      allEntries.push({
        id: `exp-${exp.id}`,
        timestamp: exp.paidAt || exp.createdAt,
        dateStr: exp.businessDate,
        timeStr: timeInfo.timeStr,
        type: 'expense',
        reference: exp.reference || `EXP-${exp.id.slice(0, 8)}`,
        description: `${exp.category}${exp.vendor ? ` — ${exp.vendor}` : ''}${exp.notes ? ` (${exp.notes})` : ''}`,
        method: exp.method,
        debitPaise: 0,
        creditPaise: isApproved ? exp.amountPaise : 0,
        status: isApproved ? 'completed' : (exp.status as any),
        source: 'Expense Register',
        metadata: {
          category: exp.category,
          vendor: exp.vendor,
          gstPaise: exp.gstPaise,
          approvedBy: exp.approvedBy,
          notes: exp.notes,
          accountingDrCr: `Dr. Operating Expenses (${exp.category}) · Cr. Liquid Cash/Bank`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. VENDOR / SUPPLIER PAYMENTS
    // ─────────────────────────────────────────────────────────────
    const supplierPayments = await prisma.supplierPayment.findMany({
      where: {
        outletId,
        paidAt: { gte: windowStart, lt: windowEnd },
      },
      include: {
        vendor: { select: { name: true, phone: true } },
      },
      orderBy: { paidAt: 'asc' },
    });

    for (const sp of supplierPayments) {
      const timeInfo = getWallClockTimeInTz(sp.paidAt, tz);
      allEntries.push({
        id: `sp-${sp.id}`,
        timestamp: sp.paidAt,
        dateStr: formatYmdInTz(sp.paidAt, tz),
        timeStr: timeInfo.timeStr,
        type: 'vendor',
        reference: sp.reference || `VPAY-${sp.id.slice(0, 8)}`,
        description: `Vendor Payment · ${sp.vendor?.name || 'Supplier'}${sp.note ? ` (${sp.note})` : ''}`,
        method: sp.method,
        debitPaise: 0,
        creditPaise: sp.amountPaise,
        status: 'completed',
        source: 'Vendor Accounts',
        metadata: {
          vendorId: sp.vendorId,
          vendorName: sp.vendor?.name,
          vendorPhone: sp.vendor?.phone,
          note: sp.note,
          accountingDrCr: `Dr. Accounts Payable (2100) · Cr. Liquid Cash/Bank`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. CASH MOVEMENTS / CASH DRAWER
    // ─────────────────────────────────────────────────────────────
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        outletId,
        businessDate: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const cm of cashMovements) {
      const timeInfo = getWallClockTimeInTz(cm.createdAt, tz);
      const isBankDeposit = cm.category === 'day_close_deposit' || cm.destination === 'bank';
      const categoryLabel = cm.category.replace(/_/g, ' ').toUpperCase();

      allEntries.push({
        id: `cm-${cm.id}`,
        timestamp: cm.createdAt,
        dateStr: cm.businessDate,
        timeStr: timeInfo.timeStr,
        type: isBankDeposit ? 'bank' : 'cash_drawer',
        reference: cm.reference || `DRW-${cm.id.slice(0, 8)}`,
        description: `${isBankDeposit ? 'Bank Deposit' : 'Cash Drawer'}: ${categoryLabel}${cm.reason ? ` — ${cm.reason}` : ''}`,
        method: 'cash',
        debitPaise: cm.type === 'inflow' ? cm.amountPaise : 0,
        creditPaise: cm.type === 'outflow' ? cm.amountPaise : 0,
        status: 'completed',
        source: 'Cash Drawer Till',
        metadata: {
          staffName: cm.staffName,
          category: cm.category,
          destination: cm.destination,
          destAccount: cm.destAccount,
          reason: cm.reason,
          accountingDrCr:
            cm.type === 'inflow'
              ? `Dr. Cash Register Drawer · Cr. Till Opening / Float`
              : `Dr. Bank Account / Vault · Cr. Cash Register Drawer`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 6. PAYROLL / SALARY PAYMENTS
    // ─────────────────────────────────────────────────────────────
    const salaryPayments = await prisma.salaryPayment.findMany({
      where: {
        outletId,
        paidAt: { gte: windowStart, lt: windowEnd },
      },
      include: {
        staff: { select: { name: true, role: true } },
      },
      orderBy: { paidAt: 'asc' },
    });

    for (const sal of salaryPayments) {
      const timeInfo = getWallClockTimeInTz(sal.paidAt, tz);
      allEntries.push({
        id: `sal-${sal.id}`,
        timestamp: sal.paidAt,
        dateStr: formatYmdInTz(sal.paidAt, tz),
        timeStr: timeInfo.timeStr,
        type: 'payroll',
        reference: `SAL-${sal.periodLabel}-${sal.id.slice(0, 6)}`,
        description: `Salary Payout · ${sal.staff?.name || 'Staff User'} (${sal.periodLabel})`,
        method: sal.method,
        debitPaise: 0,
        creditPaise: sal.amountPaise,
        status: 'completed',
        source: 'Payroll Register',
        metadata: {
          staffName: sal.staff?.name,
          staffRole: sal.staff?.role,
          periodLabel: sal.periodLabel,
          note: sal.note,
          accountingDrCr: `Dr. Staff Salaries Expense · Cr. Liquid Cash/Bank`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 7. AUTHORITATIVE OPENING BALANCE (Reusing DayClosing logic)
    // ─────────────────────────────────────────────────────────────
    let openingBalancePaise = 1500000; // 15,000 INR default float
    const openingRecord = await prisma.openingCashBalance.findUnique({
      where: { outletId_businessDate: { outletId, businessDate: dateFrom } },
    });

    if (openingRecord) {
      openingBalancePaise = openingRecord.amountPaise;
    } else {
      // Check previous day closing tomorrow float
      const parts = dateFrom.split('-').map(Number);
      const fromY = parts[0] ?? 2026;
      const fromM = parts[1] ?? 1;
      const fromD = parts[2] ?? 1;
      const prevDateObj = new Date(Date.UTC(fromY, fromM - 1, fromD - 1));
      const prevDate = formatYmdInTz(prevDateObj, tz);
      const prevClosing = await prisma.dayClosing.findUnique({
        where: { outletId_businessDate: { outletId, businessDate: prevDate } },
      });
      if (prevClosing && prevClosing.tomorrowOpeningCashPaise > 0) {
        openingBalancePaise = prevClosing.tomorrowOpeningCashPaise;
      }
    }

    // Check if an authoritative DayClosing record exists for dateTo
    const dayClosingRecord = await prisma.dayClosing.findUnique({
      where: { outletId_businessDate: { outletId, businessDate: dateTo } },
      select: {
        id: true,
        closingNumber: true,
        status: true,
        closedAt: true,
        closedByName: true,
        actualCashPaise: true,
        cashVariancePaise: true,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // 8. TOTALS & SUMMARY CALCULATION
    // ─────────────────────────────────────────────────────────────
    let totalSalesPaise = 0;
    let totalExpensesPaise = 0;
    let totalRefundsPaise = 0;
    let totalDebitPaise = 0;
    let totalCreditPaise = 0;

    for (const e of allEntries) {
      if (e.status !== 'cancelled' && e.status !== 'voided') {
        totalDebitPaise += e.debitPaise;
        totalCreditPaise += e.creditPaise;

        if (e.type === 'sale') totalSalesPaise += e.debitPaise;
        if (e.type === 'expense') totalExpensesPaise += e.creditPaise;
        if (e.type === 'refund') totalRefundsPaise += e.creditPaise;
      }
    }

    const netMovementPaise = totalDebitPaise - totalCreditPaise;
    const closingBalancePaise = openingBalancePaise + netMovementPaise;

    const summary: DayBookSummary = {
      openingBalancePaise,
      totalSalesPaise,
      totalExpensesPaise,
      totalRefundsPaise,
      totalDebitPaise,
      totalCreditPaise,
      netMovementPaise,
      closingBalancePaise,
      dayClosingRecord: dayClosingRecord || null,
    };

    // ─────────────────────────────────────────────────────────────
    // 9. CLIENT FILTERING (Type, Payment Method, Search)
    // ─────────────────────────────────────────────────────────────
    let filteredEntries = allEntries;

    // Filter: Type
    if (params.type && params.type !== 'all') {
      const targetType = params.type.toLowerCase();
      filteredEntries = filteredEntries.filter((e) => {
        if (targetType === 'sales') return e.type === 'sale';
        if (targetType === 'expenses') return e.type === 'expense';
        if (targetType === 'payments') return e.type === 'payment' || e.type === 'sale';
        if (targetType === 'refunds') return e.type === 'refund';
        if (targetType === 'vendor') return e.type === 'vendor';
        if (targetType === 'bank') return e.type === 'bank';
        if (targetType === 'payroll') return e.type === 'payroll';
        if (targetType === 'cash_drawer') return e.type === 'cash_drawer';
        return e.type === targetType;
      });
    }

    // Filter: Payment Method
    if (params.paymentMethod && params.paymentMethod !== 'all') {
      const targetMethod = params.paymentMethod.toLowerCase();
      filteredEntries = filteredEntries.filter((e) => e.method.toLowerCase() === targetMethod);
    }

    // Filter: Search query
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filteredEntries = filteredEntries.filter((e) => {
        return (
          e.reference.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.method.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q) ||
          (e.metadata?.customerName && String(e.metadata.customerName).toLowerCase().includes(q)) ||
          (e.metadata?.vendorName && String(e.metadata.vendorName).toLowerCase().includes(q)) ||
          (e.metadata?.tableName && String(e.metadata.tableName).toLowerCase().includes(q)) ||
          (e.metadata?.orderNumber && String(e.metadata.orderNumber).toLowerCase().includes(q))
        );
      });
    }

    // Sort: ASC (chronological) or DESC
    const sortOrder = params.sortOrder || 'asc';
    filteredEntries.sort((a, b) => {
      const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
      return sortOrder === 'asc' ? timeDiff : -timeDiff;
    });

    // ─────────────────────────────────────────────────────────────
    // 10. PAGINATION
    // ─────────────────────────────────────────────────────────────
    const totalCount = filteredEntries.length;
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 25));
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedEntries = filteredEntries.slice(startIndex, startIndex + pageSize);

    return {
      entries: paginatedEntries,
      totalCount,
      page,
      pageSize,
      totalPages,
      summary,
      dateFrom,
      dateTo,
      financialYearName,
      timezone: tz,
    };
  }

  /**
   * Helper to format Day Book data as CSV string
   */
  static generateCSV(entries: DayBookEntry[], summary: DayBookSummary, dateRange: string): string {
    const headers = [
      'Date',
      'Time',
      'Type',
      'Reference',
      'Description',
      'Payment Method',
      'Debit (INR)',
      'Credit (INR)',
      'Status',
      'Source',
    ];

    const rows = entries.map((e) => [
      `"${e.dateStr}"`,
      `"${e.timeStr}"`,
      `"${e.type.toUpperCase()}"`,
      `"${e.reference}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.method.toUpperCase()}"`,
      (e.debitPaise / 100).toFixed(2),
      (e.creditPaise / 100).toFixed(2),
      `"${e.status.toUpperCase()}"`,
      `"${e.source}"`,
    ]);

    const summaryRows = [
      [],
      ['SUMMARY FOR PERIOD:', `"${dateRange}"`],
      ['Opening Balance:', (summary.openingBalancePaise / 100).toFixed(2)],
      ['Total Sales:', (summary.totalSalesPaise / 100).toFixed(2)],
      ['Total Expenses:', (summary.totalExpensesPaise / 100).toFixed(2)],
      ['Total Refunds:', (summary.totalRefundsPaise / 100).toFixed(2)],
      ['Total Debit (Inflows):', (summary.totalDebitPaise / 100).toFixed(2)],
      ['Total Credit (Outflows):', (summary.totalCreditPaise / 100).toFixed(2)],
      ['Net Movement:', (summary.netMovementPaise / 100).toFixed(2)],
      ['Closing Balance:', (summary.closingBalancePaise / 100).toFixed(2)],
    ];

    return [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      ...summaryRows.map((r) => r.join(',')),
    ].join('\n');
  }
}
