import { prisma, Prisma, OrderStatus, KotStatus, PayMethod } from '@cafeos/db';
import { createHash } from 'crypto';
import {
  formatYmdInTz,
  getWallClockTimeInTz,
  readBusinessDay,
  DEFAULT_TIMEZONE,
  type BusinessDayState,
} from '../businessDay';
import {
  type CashDenominations,
  calculateDenominationsTotalPaise,
  type DayClosingCommitInput,
} from '@cafeos/core';

export interface DayClosingValidation {
  canClose: boolean;
  blockingReasons: string[];
  warnings: string[];
}

export interface PaymentReconciliationLine {
  method: string;
  label: string;
  systemAmountPaise: number;
  expectedAmountPaise: number;
  actualAmountPaise: number;
  variancePaise: number;
  status: 'MATCHED' | 'VARIANCE' | 'NOT_VERIFIED';
}

export interface ShiftSummaryItem {
  id: string;
  cashierName: string;
  openingCashPaise: number;
  salesPaise: number;
  expectedCashPaise: number;
  actualCashPaise: number;
  variancePaise: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
}

export interface DayClosingSummaryResult {
  businessDate: string;
  tomorrowDate: string;
  timezone: string;
  status: 'open' | 'in_progress' | 'closed' | 'reopened';
  closingNumber: string | null;
  dayClosing: any | null;
  validation: DayClosingValidation;
  salesSummary: {
    grossSalesPaise: number;
    discountsPaise: number;
    refundsPaise: number;
    netSalesPaise: number;
    taxCollectedPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
  };
  paymentReconciliation: PaymentReconciliationLine[];
  shiftSummary: {
    totalShifts: number;
    closedShifts: number;
    openShifts: number;
    shifts: ShiftSummaryItem[];
  };
  cashReconciliation: {
    openingCashPaise: number;
    cashSalesPaise: number;
    cashInPaise: number;
    cashExpensesPaise: number;
    cashOutPaise: number;
    cashRefundsPaise: number;
    expectedClosingCashPaise: number;
    actualCashCountedPaise: number;
    cashVariancePaise: number;
    varianceReason: string | null;
    varianceNote: string | null;
    denominations: CashDenominations | null;
  };
  expenses: Array<{
    id: string;
    category: string;
    vendor: string | null;
    amountPaise: number;
    gstPaise: number;
    method: string;
    time: string;
    reference: string | null;
    status: string;
  }>;
  totalExpensesPaise: number;
  cashExpensesPaise: number;
  refundsAndCancellations: {
    cashRefundsPaise: number;
    upiRefundsPaise: number;
    cardRefundsPaise: number;
    totalRefundsPaise: number;
    cancelledOrdersCount: number;
    cancelledItemsCount: number;
    kotCancellationsCount: number;
    complimentaryItemsCount: number;
  };
  settlements: {
    platformSalesPaise: number;
    platformCommissionPaise: number;
    platformFeesPaise: number;
    expectedSettlementPaise: number;
    receivedSettlementPaise: number;
    settlementDifferencePaise: number;
  };
  tomorrowOpeningCashConfig: {
    todayActualClosingCashPaise: number;
    suggestedTomorrowOpeningCashPaise: number;
    cashToRemoveDepositPaise: number;
  };
  bankAccounts: Array<{
    id: string;
    name: string;
    type: string;
    identifier: string;
  }>;
}

export class DayClosingService {
  /**
   * Computes the UTC start & end boundary for a given business date and outlet settings.
   */
  static getBusinessDateWindow(
    businessDate: string,
    timezone = DEFAULT_TIMEZONE,
    cutoffHour = 4
  ): { start: Date; end: Date; tomorrowDate: string } {
    const parts = businessDate.split('-').map((p) => parseInt(p, 10));
    const y = parts[0] || 2026;
    const m = parts[1] || 1;
    const d = parts[2] || 1;
    const dateObj = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

    // Tomorrow's date
    const tomorrowObj = new Date(dateObj.getTime() + 864e5);
    const tomorrowDate = formatYmdInTz(tomorrowObj, timezone);

    // Convert cutoffHour (e.g. 04:00 AM IST) to Date objects
    const start = new Date(`${businessDate}T${String(cutoffHour).padStart(2, '0')}:00:00+05:30`);
    const end = new Date(`${tomorrowDate}T${String(cutoffHour).padStart(2, '0')}:00:00+05:30`);

    return { start, end, tomorrowDate };
  }

  /**
   * Computes comprehensive authoritative day summary for an outlet and business date.
   */
  static async calculateDaySummary(
    outletId: string,
    targetBusinessDate?: string
  ): Promise<DayClosingSummaryResult> {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { id: true, name: true, timezone: true, settings: true },
    });
    if (!outlet) throw new Error('OUTLET_NOT_FOUND');

    const tz = outlet.timezone || DEFAULT_TIMEZONE;
    const bState = readBusinessDay(outlet.settings, new Date(), tz);
    const businessDate = targetBusinessDate || bState.currentBusinessDate || formatYmdInTz(new Date(), tz);

    const cutoffHour = bState.cutoffHour ?? 4;
    const { start: windowStart, end: windowEnd, tomorrowDate } = this.getBusinessDateWindow(
      businessDate,
      tz,
      cutoffHour
    );

    // 1. Check existing DayClosing record
    const existingClosing = await prisma.dayClosing.findUnique({
      where: { outletId_businessDate: { outletId, businessDate } },
      include: {
        closedBy: { select: { id: true, name: true, role: true } },
      },
    });

    // 2. Fetch all orders within the business day window
    const orders = await prisma.order.findMany({
      where: {
        outletId,
        placedAt: { gte: windowStart, lt: windowEnd },
      },
      include: {
        payments: true,
        refunds: true,
        items: true,
        kots: true,
      },
    });

    // 3. Compute Sales Summary
    let grossSalesPaise = 0;
    let discountsPaise = 0;
    let taxCollectedPaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let refundedOrders = 0;
    let cancelledItemsCount = 0;
    let complimentaryItemsCount = 0;

    const successfulPayments: Array<{ method: string; amountPaise: number }> = [];

    for (const ord of orders) {
      if (ord.status === OrderStatus.cancelled) {
        cancelledOrders++;
      } else {
        grossSalesPaise += ord.subtotalPaise || (ord.totalPaise + ord.discountPaise);
        discountsPaise += ord.discountPaise || 0;
        cgstPaise += ord.cgstPaise || 0;
        sgstPaise += ord.sgstPaise || 0;
        igstPaise += ord.igstPaise || 0;
        taxCollectedPaise += (ord.cgstPaise || 0) + (ord.sgstPaise || 0) + (ord.igstPaise || 0);

        if (ord.status === OrderStatus.settled) {
          completedOrders++;
        }
      }

      if (ord.refunds && ord.refunds.length > 0) {
        refundedOrders++;
      }

      // Check items for cancellation or complimentary
      if (ord.items) {
        for (const item of ord.items) {
          if (item.kotStatus === KotStatus.void) cancelledItemsCount++;
          if (item.unitPricePaise === 0) complimentaryItemsCount++;
        }
      }

      // Tally payments
      if (ord.payments) {
        for (const p of ord.payments) {
          if (p.status !== 'failed') {
            successfulPayments.push({ method: p.method, amountPaise: p.amountPaise });
          }
        }
      }
    }

    const netSalesPaise = Math.max(0, grossSalesPaise - discountsPaise);

    // KOT Cancellations
    const voidKotsCount = await prisma.kot.count({
      where: {
        outletId,
        createdAt: { gte: windowStart, lt: windowEnd },
        status: KotStatus.void,
      },
    });

    // 4. Group payments by method
    let cashSalesPaise = 0;
    let upiSalesPaise = 0;
    let cardSalesPaise = 0;
    let otherSalesPaise = 0;

    for (const p of successfulPayments) {
      if (p.method === PayMethod.cash) cashSalesPaise += p.amountPaise;
      else if (p.method === PayMethod.upi) upiSalesPaise += p.amountPaise;
      else if (p.method === PayMethod.card) cardSalesPaise += p.amountPaise;
      else otherSalesPaise += p.amountPaise;
    }

    // 5. Refunds during the day
    const allRefunds = await prisma.refund.findMany({
      where: {
        order: { outletId },
        createdAt: { gte: windowStart, lt: windowEnd },
      },
      include: {
        payment: { select: { method: true } },
      },
    });

    let cashRefundsPaise = 0;
    let upiRefundsPaise = 0;
    let cardRefundsPaise = 0;
    let totalRefundsPaise = 0;

    for (const ref of allRefunds) {
      totalRefundsPaise += ref.amountPaise;
      const m = ref.payment?.method;
      if (m === PayMethod.cash) cashRefundsPaise += ref.amountPaise;
      else if (m === PayMethod.upi) upiRefundsPaise += ref.amountPaise;
      else if (m === PayMethod.card) cardRefundsPaise += ref.amountPaise;
      else cashRefundsPaise += ref.amountPaise;
    }

    // 6. Cash Shifts (Shifts for this business day)
    const cashShifts = await prisma.cashShift.findMany({
      where: { outletId, businessDate },
      orderBy: { openedAt: 'asc' },
    });

    const shiftItems: ShiftSummaryItem[] = cashShifts.map((s) => ({
      id: s.id,
      cashierName: s.cashierName,
      openingCashPaise: s.openingCashPaise,
      salesPaise: s.cashSalesPaise,
      expectedCashPaise: s.expectedCashPaise,
      actualCashPaise: s.actualCashPaise,
      variancePaise: s.cashVariancePaise,
      status: s.status as 'open' | 'closed',
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    }));

    const totalShifts = shiftItems.length;
    const openShifts = shiftItems.filter((s) => s.status === 'open').length;
    const closedShifts = totalShifts - openShifts;

    // 7. Cash Movements (Deposits, Withdrawals, Cash In/Out)
    const cashMovements = await prisma.cashMovement.findMany({
      where: { outletId, businessDate },
      orderBy: { createdAt: 'asc' },
    });

    let cashInPaise = 0;
    let cashOutPaise = 0;

    for (const m of cashMovements) {
      if (m.type === 'inflow') cashInPaise += m.amountPaise;
      else if (m.type === 'outflow') cashOutPaise += m.amountPaise;
    }

    // 8. Expenses recorded for this business day
    const expensesList = await prisma.expense.findMany({
      where: {
        outletId,
        businessDate,
        status: 'approved',
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalExpensesPaise = 0;
    let cashExpensesPaise = 0;

    const formattedExpenses = expensesList.map((e) => {
      totalExpensesPaise += e.amountPaise;
      if (e.method === 'cash') cashExpensesPaise += e.amountPaise;
      return {
        id: e.id,
        category: e.category,
        vendor: e.vendor,
        amountPaise: e.amountPaise,
        gstPaise: e.gstPaise,
        method: e.method,
        time: e.paidAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        reference: e.reference,
        status: e.status,
      };
    });

    // 9. Opening Cash Resolution
    let openingCashPaise = 1500000; // Default 15,000 INR
    const openingRecord = await prisma.openingCashBalance.findUnique({
      where: { outletId_businessDate: { outletId, businessDate } },
    });

    if (openingRecord) {
      openingCashPaise = openingRecord.amountPaise;
    } else {
      // Check previous day closing
      const parts = businessDate.split('-').map((p) => parseInt(p, 10));
      const y = parts[0] || 2026;
      const m = parts[1] || 1;
      const d = parts[2] || 1;
      const prevDate = formatYmdInTz(new Date(Date.UTC(y, m - 1, d - 1)), tz);
      const prevClosing = await prisma.dayClosing.findUnique({
        where: { outletId_businessDate: { outletId, businessDate: prevDate } },
      });
      if (prevClosing && prevClosing.tomorrowOpeningCashPaise > 0) {
        openingCashPaise = prevClosing.tomorrowOpeningCashPaise;
      }
    }

    // 10. Cash Reconciliation calculation:
    // Opening Cash + Cash Sales + Cash In - Cash Expenses - Cash Out - Cash Refunds = Expected Closing Cash
    const expectedClosingCashPaise =
      openingCashPaise +
      cashSalesPaise +
      cashInPaise -
      cashExpensesPaise -
      cashOutPaise -
      cashRefundsPaise;

    // Use saved actual cash if closing exists, otherwise default to expected
    const actualCashCountedPaise = existingClosing
      ? existingClosing.actualCashPaise
      : expectedClosingCashPaise;

    const cashVariancePaise = actualCashCountedPaise - expectedClosingCashPaise;

    // 11. Payment Reconciliation Array
    const paymentReconciliation: PaymentReconciliationLine[] = [
      {
        method: 'cash',
        label: 'Cash',
        systemAmountPaise: cashSalesPaise,
        expectedAmountPaise: cashSalesPaise,
        actualAmountPaise: existingClosing ? existingClosing.cashSalesPaise : cashSalesPaise,
        variancePaise: 0,
        status: 'MATCHED',
      },
      {
        method: 'upi',
        label: 'UPI (QR / Soundbox)',
        systemAmountPaise: upiSalesPaise,
        expectedAmountPaise: upiSalesPaise,
        actualAmountPaise: upiSalesPaise,
        variancePaise: 0,
        status: 'MATCHED',
      },
      {
        method: 'card',
        label: 'Credit / Debit Card',
        systemAmountPaise: cardSalesPaise,
        expectedAmountPaise: cardSalesPaise,
        actualAmountPaise: cardSalesPaise,
        variancePaise: 0,
        status: 'MATCHED',
      },
      {
        method: 'other',
        label: 'Other (Wallet / Delivery)',
        systemAmountPaise: otherSalesPaise,
        expectedAmountPaise: otherSalesPaise,
        actualAmountPaise: otherSalesPaise,
        variancePaise: 0,
        status: 'MATCHED',
      },
    ];

    // 12. Delivery / Online Settlements (Platform sales & commission estimates)
    const settlements = {
      platformSalesPaise: otherSalesPaise,
      platformCommissionPaise: Math.round(otherSalesPaise * 0.15),
      platformFeesPaise: Math.round(otherSalesPaise * 0.02),
      expectedSettlementPaise: Math.round(otherSalesPaise * 0.83),
      receivedSettlementPaise: Math.round(otherSalesPaise * 0.83),
      settlementDifferencePaise: 0,
    };

    // 13. Tomorrow Opening Cash Suggestions
    const suggestedTomorrowOpeningCashPaise = openingCashPaise;
    const cashToRemoveDepositPaise = Math.max(0, actualCashCountedPaise - suggestedTomorrowOpeningCashPaise);

    // 14. Validation Rules
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    if (openShifts > 0) {
      blockingReasons.push(
        `${openShifts} shift(s) still open. All shifts must be closed before the business day can be finalized.`
      );
    }

    if (cashVariancePaise !== 0 && (!existingClosing || !existingClosing.varianceReason)) {
      warnings.push(`Cash variance of ${cashVariancePaise >= 0 ? '+' : ''}${Math.round(cashVariancePaise / 100)} INR requires a reason before closing.`);
    }

    const canClose = blockingReasons.length === 0;

    // Available bank accounts
    const outletSettings = (outlet.settings as Record<string, unknown>) ?? {};
    const outletFinance = (outletSettings.finance as Record<string, unknown>) ?? {};
    const configuredBankAccounts = Array.isArray(outletFinance.bankAccounts) ? outletFinance.bankAccounts : [];

    const bankAccounts = configuredBankAccounts.length > 0
      ? configuredBankAccounts.map((a: any) => ({
          id: String(a.id),
          name: String(a.name),
          type: a.type || 'bank',
          identifier: a.identifier || ''
        }))
      : [
          { id: 'vault_safe', name: 'Main Safe / Cash Drawer Vault', type: 'vault', identifier: 'Vault 01' },
          { id: 'owner_draw', name: 'Owner Cash Withdrawal', type: 'owner', identifier: 'Proprietor Drawing' },
        ];

    return {
      businessDate,
      tomorrowDate,
      timezone: tz,
      status: existingClosing ? (existingClosing.status as any) : 'open',
      closingNumber: existingClosing?.closingNumber || null,
      dayClosing: existingClosing,
      validation: {
        canClose,
        blockingReasons,
        warnings,
      },
      salesSummary: {
        grossSalesPaise,
        discountsPaise,
        refundsPaise: totalRefundsPaise,
        netSalesPaise,
        taxCollectedPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        totalOrders: orders.length,
        completedOrders,
        cancelledOrders,
        refundedOrders,
      },
      paymentReconciliation,
      shiftSummary: {
        totalShifts,
        closedShifts,
        openShifts,
        shifts: shiftItems,
      },
      cashReconciliation: {
        openingCashPaise,
        cashSalesPaise,
        cashInPaise,
        cashExpensesPaise,
        cashOutPaise,
        cashRefundsPaise,
        expectedClosingCashPaise,
        actualCashCountedPaise,
        cashVariancePaise,
        varianceReason: existingClosing?.varianceReason || null,
        varianceNote: existingClosing?.varianceNote || null,
        denominations: (existingClosing?.denominations as CashDenominations) || null,
      },
      expenses: formattedExpenses,
      totalExpensesPaise,
      cashExpensesPaise,
      refundsAndCancellations: {
        cashRefundsPaise,
        upiRefundsPaise,
        cardRefundsPaise,
        totalRefundsPaise,
        cancelledOrdersCount: cancelledOrders,
        cancelledItemsCount,
        kotCancellationsCount: voidKotsCount,
        complimentaryItemsCount,
      },
      settlements,
      tomorrowOpeningCashConfig: {
        todayActualClosingCashPaise: actualCashCountedPaise,
        suggestedTomorrowOpeningCashPaise,
        cashToRemoveDepositPaise,
      },
      bankAccounts,
    };
  }

  /**
   * Final atomic Day Closing execution.
   */
  static async closeBusinessDay(params: {
    outletId: string;
    staffId: string;
    staffName: string;
    staffRole: string;
    input: DayClosingCommitInput;
  }) {
    const { outletId, staffId, staffName, staffRole, input } = params;
    const {
      businessDate,
      actualCashPaise,
      varianceReason,
      varianceNote,
      denominations,
      tomorrowOpeningCashPaise,
      cashDepositDestination,
      cashDepositAccountId,
      cashDepositAccountName,
      notes,
    } = input;

    return await prisma.$transaction(async (tx) => {
      // 1. Check if day is already closed
      const existing = await tx.dayClosing.findUnique({
        where: { outletId_businessDate: { outletId, businessDate } },
      });

      if (existing && existing.status === 'closed') {
        throw new Error('DAY_ALREADY_CLOSED');
      }

      // 2. Validate no open cashier shifts remain
      const openShiftsCount = await tx.cashShift.count({
        where: { outletId, businessDate, status: 'open' },
      });
      if (openShiftsCount > 0) {
        throw new Error('CANNOT_CLOSE_OPEN_SHIFTS_REMAIN');
      }

      // 3. Re-calculate authoritative totals from database
      const outlet = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { id: true, timezone: true, settings: true },
      });
      if (!outlet) throw new Error('OUTLET_NOT_FOUND');

      const tz = outlet.timezone || DEFAULT_TIMEZONE;
      const bState = readBusinessDay(outlet.settings, new Date(), tz);
      const cutoffHour = bState.cutoffHour ?? 4;
      const { start: windowStart, end: windowEnd, tomorrowDate } = this.getBusinessDateWindow(
        businessDate,
        tz,
        cutoffHour
      );

      // Fetch orders to compute authoritative totals
      const orders = await tx.order.findMany({
        where: { outletId, placedAt: { gte: windowStart, lt: windowEnd } },
        include: { payments: true, refunds: true },
      });

      let grossSalesPaise = 0;
      let discountsPaise = 0;
      let taxPaise = 0;
      let cgstPaise = 0;
      let sgstPaise = 0;
      let igstPaise = 0;
      let completedOrdersCount = 0;
      let cancelledOrdersCount = 0;
      let refundedOrdersCount = 0;
      let cashSalesPaise = 0;
      let upiSalesPaise = 0;
      let cardSalesPaise = 0;
      let otherSalesPaise = 0;

      for (const o of orders) {
        if (o.status === OrderStatus.cancelled) {
          cancelledOrdersCount++;
        } else {
          grossSalesPaise += o.subtotalPaise || (o.totalPaise + o.discountPaise);
          discountsPaise += o.discountPaise || 0;
          cgstPaise += o.cgstPaise || 0;
          sgstPaise += o.sgstPaise || 0;
          igstPaise += o.igstPaise || 0;
          taxPaise += (o.cgstPaise || 0) + (o.sgstPaise || 0) + (o.igstPaise || 0);
          if (o.status === OrderStatus.settled) completedOrdersCount++;
        }
        if (o.refunds && o.refunds.length > 0) refundedOrdersCount++;
        if (o.payments) {
          for (const p of o.payments) {
            if (p.status !== 'failed') {
              if (p.method === PayMethod.cash) cashSalesPaise += p.amountPaise;
              else if (p.method === PayMethod.upi) upiSalesPaise += p.amountPaise;
              else if (p.method === PayMethod.card) cardSalesPaise += p.amountPaise;
              else otherSalesPaise += p.amountPaise;
            }
          }
        }
      }
      const netSalesPaise = Math.max(0, grossSalesPaise - discountsPaise);

      // Refunds in cash
      const refunds = await tx.refund.findMany({
        where: { order: { outletId }, createdAt: { gte: windowStart, lt: windowEnd } },
        include: { payment: true },
      });
      let cashRefundsPaise = 0;
      let refundsPaise = 0;
      for (const r of refunds) {
        refundsPaise += r.amountPaise;
        if (r.payment?.method === PayMethod.cash) cashRefundsPaise += r.amountPaise;
      }

      // Expenses in cash
      const expenses = await tx.expense.findMany({
        where: { outletId, businessDate, status: 'approved' },
      });
      let cashExpensesPaise = 0;
      for (const e of expenses) {
        if (e.method === 'cash') cashExpensesPaise += e.amountPaise;
      }

      // Cash movements
      const movements = await tx.cashMovement.findMany({
        where: { outletId, businessDate },
      });
      let cashInPaise = 0;
      let cashOutPaise = 0;
      for (const m of movements) {
        if (m.type === 'inflow') cashInPaise += m.amountPaise;
        else if (m.type === 'outflow') cashOutPaise += m.amountPaise;
      }

      // Opening Cash
      let openingCashPaise = 1500000;
      const openingRecord = await tx.openingCashBalance.findUnique({
        where: { outletId_businessDate: { outletId, businessDate } },
      });
      if (openingRecord) {
        openingCashPaise = openingRecord.amountPaise;
      }

      // Expected Cash
      const expectedCashPaise =
        openingCashPaise +
        cashSalesPaise +
        cashInPaise -
        cashExpensesPaise -
        cashOutPaise -
        cashRefundsPaise;

      const cashVariancePaise = actualCashPaise - expectedCashPaise;
      if (cashVariancePaise !== 0 && !varianceReason) {
        throw new Error('VARIANCE_REASON_REQUIRED');
      }

      // Calculate Cash to Remove / Deposit
      const cashRemovedPaise = Math.max(0, actualCashPaise - tomorrowOpeningCashPaise);

      // Generate sequence number for closing ID: DC-YYYY-MM-DD-001
      const countToday = await tx.dayClosing.count({ where: { outletId } });
      const seqStr = String(countToday + 1).padStart(3, '0');
      const closingNumber = `DC-${businessDate}-${seqStr}`;

      // 4. Create or update DayClosing
      const dayClosing = await tx.dayClosing.upsert({
        where: { outletId_businessDate: { outletId, businessDate } },
        create: {
          outletId,
          businessDate,
          closingNumber,
          status: 'closed',
          closedAt: new Date(),
          closedById: staffId,
          closedByName: staffName,
          closedByRole: staffRole,
          grossSalesPaise,
          netSalesPaise,
          discountsPaise,
          refundsPaise,
          taxPaise,
          cgstPaise,
          sgstPaise,
          igstPaise,
          ordersCount: orders.length,
          completedOrdersCount,
          cancelledOrdersCount,
          refundedOrdersCount,
          cashSalesPaise,
          upiSalesPaise,
          cardSalesPaise,
          otherSalesPaise,
          openingCashPaise,
          cashInPaise,
          cashOutPaise,
          cashExpensesPaise,
          cashRefundsPaise,
          expectedCashPaise,
          actualCashPaise,
          cashVariancePaise,
          varianceReason: varianceReason || null,
          varianceNote: varianceNote || null,
          denominations: (denominations as any) ?? Prisma.JsonNull,
          tomorrowOpeningCashPaise,
          cashRemovedPaise,
          cashDepositDestination,
          cashDepositAccountId: cashDepositAccountId || null,
          cashDepositAccountName: cashDepositAccountName || null,
          notes: notes || null,
        },
        update: {
          closingNumber,
          status: 'closed',
          closedAt: new Date(),
          closedById: staffId,
          closedByName: staffName,
          closedByRole: staffRole,
          grossSalesPaise,
          netSalesPaise,
          discountsPaise,
          refundsPaise,
          taxPaise,
          cgstPaise,
          sgstPaise,
          igstPaise,
          ordersCount: orders.length,
          completedOrdersCount,
          cancelledOrdersCount,
          refundedOrdersCount,
          cashSalesPaise,
          upiSalesPaise,
          cardSalesPaise,
          otherSalesPaise,
          openingCashPaise,
          cashInPaise,
          cashOutPaise,
          cashExpensesPaise,
          cashRefundsPaise,
          expectedCashPaise,
          actualCashPaise,
          cashVariancePaise,
          varianceReason: varianceReason || null,
          varianceNote: varianceNote || null,
          denominations: (denominations as any) ?? Prisma.JsonNull,
          tomorrowOpeningCashPaise,
          cashRemovedPaise,
          cashDepositDestination,
          cashDepositAccountId: cashDepositAccountId || null,
          cashDepositAccountName: cashDepositAccountName || null,
          notes: notes || null,
        },
      });

      // 5. Create Tomorrow's Opening Cash Balance Record (CRITICAL FEATURE)
      await tx.openingCashBalance.upsert({
        where: { outletId_businessDate: { outletId, businessDate: tomorrowDate } },
        create: {
          outletId,
          businessDate: tomorrowDate,
          amountPaise: tomorrowOpeningCashPaise,
          source: 'previous_day_closing',
          sourceClosingId: dayClosing.id,
          notes: `Carried forward from Day Closing ${closingNumber} (${businessDate})`,
        },
        update: {
          amountPaise: tomorrowOpeningCashPaise,
          source: 'previous_day_closing',
          sourceClosingId: dayClosing.id,
          notes: `Carried forward from Day Closing ${closingNumber} (${businessDate})`,
        },
      });

      // 6. Record Cash Deposit Movement if cash removed
      if (cashRemovedPaise > 0) {
        await tx.cashMovement.create({
          data: {
            outletId,
            staffId,
            staffName,
            businessDate,
            type: 'outflow',
            category: 'day_close_deposit',
            amountPaise: cashRemovedPaise,
            destination: cashDepositDestination,
            destAccount: cashDepositAccountName || cashDepositAccountId || cashDepositDestination,
            reason: `Cash removed during Day Closing for deposit (${businessDate})`,
            reference: closingNumber,
          },
        });
      }

      // 7. Write Audit Log
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: staffId,
          action: 'day_closing_finalized',
          entity: 'day_closing',
          entityId: dayClosing.id,
          before: { status: 'open', businessDate },
          after: {
            closingNumber,
            status: 'closed',
            actualCashPaise,
            expectedCashPaise,
            cashVariancePaise,
            tomorrowOpeningCashPaise,
            cashRemovedPaise,
            cashDepositDestination,
          },
        },
      });

      // 8. Update Outlet Business Day State (Roll over to tomorrow)
      const currentSettings = (outlet.settings as Record<string, any>) || {};
      const nextBusinessDayState: BusinessDayState = {
        ...bState,
        status: 'open',
        currentBusinessDate: tomorrowDate,
        lastClosedAt: new Date().toISOString(),
        isExtended: false,
        extendedUntil: null,
      };

      await tx.outlet.update({
        where: { id: outletId },
        data: {
          settings: {
            ...currentSettings,
            businessDay: nextBusinessDayState,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return dayClosing;
    });
  }

  /**
   * Reopens an already closed day (Manager / Owner authorization required).
   */
  static async reopenBusinessDay(params: {
    outletId: string;
    businessDate: string;
    staffId: string;
    staffName: string;
    reason: string;
  }) {
    const { outletId, businessDate, staffId, staffName, reason } = params;

    return await prisma.$transaction(async (tx) => {
      const closing = await tx.dayClosing.findUnique({
        where: { outletId_businessDate: { outletId, businessDate } },
      });
      if (!closing) throw new Error('CLOSING_NOT_FOUND');
      if (closing.status !== 'closed') throw new Error('DAY_NOT_CLOSED');

      const updated = await tx.dayClosing.update({
        where: { id: closing.id },
        data: {
          status: 'reopened',
          reopenReason: reason,
          reopenedAt: new Date(),
          reopenedById: staffId,
          reopenedByName: staffName,
        },
      });

      await tx.auditLog.create({
        data: {
          outletId,
          actorId: staffId,
          action: 'day_closing_reopened',
          entity: 'day_closing',
          entityId: closing.id,
          before: { status: 'closed' },
          after: { status: 'reopened', reason, reopenedByName: staffName },
        },
      });

      return updated;
    });
  }

  /**
   * Records an audited adjustment on a closed day.
   */
  static async adjustDayClosing(params: {
    closingId: string;
    staffId: string;
    staffName: string;
    field: string;
    beforeValue: any;
    afterValue: any;
    reason: string;
  }) {
    const { closingId, staffId, staffName, field, beforeValue, afterValue, reason } = params;

    const closing = await prisma.dayClosing.findUnique({ where: { id: closingId } });
    if (!closing) throw new Error('CLOSING_NOT_FOUND');

    const adjustments = (closing.adjustments as any[]) || [];
    const newAdjustment = {
      timestamp: new Date().toISOString(),
      actorId: staffId,
      actorName: staffName,
      field,
      beforeValue,
      afterValue,
      reason,
    };

    const updated = await prisma.dayClosing.update({
      where: { id: closingId },
      data: {
        adjustments: [...adjustments, newAdjustment],
      },
    });

    await prisma.auditLog.create({
      data: {
        outletId: closing.outletId,
        actorId: staffId,
        action: 'day_closing_adjusted',
        entity: 'day_closing',
        entityId: closingId,
        before: { [field]: beforeValue },
        after: { [field]: afterValue, reason, actorName: staffName },
      },
    });

    return updated;
  }

  /**
   * Allows manager to force-close an open cashier shift.
   */
  static async forceCloseShift(params: {
    shiftId: string;
    outletId: string;
    staffId: string;
    staffName: string;
    actualCashPaise: number;
    varianceReason?: string;
    notes?: string;
  }) {
    const { shiftId, outletId, staffId, staffName, actualCashPaise, varianceReason, notes } = params;

    const shift = await prisma.cashShift.findUnique({
      where: { id: shiftId },
    });
    if (!shift || shift.outletId !== outletId) throw new Error('SHIFT_NOT_FOUND');
    if (shift.status === 'closed') throw new Error('SHIFT_ALREADY_CLOSED');

    const expectedCashPaise = shift.expectedCashPaise || (shift.openingCashPaise + shift.cashSalesPaise);
    const cashVariancePaise = actualCashPaise - expectedCashPaise;

    const updated = await prisma.cashShift.update({
      where: { id: shiftId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        actualCashPaise,
        cashVariancePaise,
        varianceReason: varianceReason || (cashVariancePaise !== 0 ? 'Force closed by manager' : null),
        notes: notes ? `${shift.notes || ''}\n[Manager Force Close]: ${notes}`.trim() : shift.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        outletId,
        actorId: staffId,
        action: 'cash_shift_force_closed',
        entity: 'cash_shift',
        entityId: shiftId,
        before: { status: 'open' },
        after: { status: 'closed', actualCashPaise, cashVariancePaise, closedBy: staffName },
      },
    });

    return updated;
  }
}
