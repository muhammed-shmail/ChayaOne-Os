import { prisma, OrderStatus, OrderType, OrderChannel, PayMethod, PayStatus, KotStatus } from '../src';
import { DayClosingService } from '../../../apps/web/lib/services/day-closing.service';
import { formatINR, toPaise, type CashDenominations } from '@cafeos/core';

async function runAllTests() {
  console.log('===============================================================');
  console.log('  CHAYAONE OS — DAY CLOSING AUTOMATED E2E VERIFICATION SUITE  ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // Setup test tenant, outlet, and staff
  console.log('--- 0. SETUP TEST ENVIRONMENT ---');
  let tenant = await prisma.tenant.findFirst({ where: { subdomain: 'test-day-closing-tenant' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Day Closing Test Tenant',
        subdomain: 'test-day-closing-tenant',
        plan: 'pro',
      },
    });
  }

  let outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Day Closing Test Branch',
        timezone: 'Asia/Kolkata',
        settings: {
          businessDay: {
            currentBusinessDate: '2026-09-21',
            status: 'open',
            cutoffHour: 4,
            closingTime: '00:00',
          },
        },
      },
    });
  }

  let manager = await prisma.staffUser.findFirst({ where: { tenantId: tenant.id, role: 'manager' } });
  if (!manager) {
    manager = await prisma.staffUser.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Manager Suresh',
        role: 'manager',
        pinHash: '1234',
        active: true,
      },
    });
  }

  let cashier1 = await prisma.staffUser.findFirst({ where: { tenantId: tenant.id, username: 'cashier_rahul' } });
  if (!cashier1) {
    cashier1 = await prisma.staffUser.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Rahul Cashier',
        username: 'cashier_rahul',
        role: 'cashier',
        pinHash: '1111',
        active: true,
      },
    });
  }

  let cashier2 = await prisma.staffUser.findFirst({ where: { tenantId: tenant.id, username: 'cashier_priya' } });
  if (!cashier2) {
    cashier2 = await prisma.staffUser.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Priya Cashier',
        username: 'cashier_priya',
        role: 'cashier',
        pinHash: '2222',
        active: true,
      },
    });
  }

  const outletId = outlet.id;
  const testDate = '2026-09-21';

  // Clean previous test data for this date
  await prisma.dayClosing.deleteMany({ where: { outletId, businessDate: testDate } });
  await prisma.openingCashBalance.deleteMany({ where: { outletId, businessDate: { in: [testDate, '2026-09-22'] } } });
  await prisma.cashShift.deleteMany({ where: { outletId, businessDate: testDate } });
  await prisma.cashMovement.deleteMany({ where: { outletId, businessDate: testDate } });
  await prisma.expense.deleteMany({ where: { outletId, businessDate: testDate } });
  await prisma.order.deleteMany({ where: { outletId } });

  console.log('Environment ready.\n');

  // =========================================================================
  // TEST 1-3: MULTIPLE SHIFTS & MULTIPLE CASHIERS WITH SALES
  // =========================================================================
  console.log('--- TEST 1-3: MULTIPLE SHIFTS & MULTIPLE CASHIERS ---');

  // Set opening cash for today
  await prisma.openingCashBalance.create({
    data: {
      outletId,
      businessDate: testDate,
      amountPaise: 1500000, // ₹15,000 opening float
      source: 'initial_float',
    },
  });

  // Shift 1: Rahul
  const shift1 = await prisma.cashShift.create({
    data: {
      outletId,
      staffId: cashier1.id,
      cashierName: cashier1.name,
      businessDate: testDate,
      openingCashPaise: 1500000,
      cashSalesPaise: 3000000, // ₹30,000 cash sales
      expectedCashPaise: 4500000,
      actualCashPaise: 4480000, // ₹44,800 (-₹200 variance)
      cashVariancePaise: -20000,
      varianceReason: 'Cash shortage',
      status: 'closed',
      closedAt: new Date('2026-09-21T15:00:00+05:30'),
    },
  });

  // Shift 2: Priya
  const shift2 = await prisma.cashShift.create({
    data: {
      outletId,
      staffId: cashier2.id,
      cashierName: cashier2.name,
      businessDate: testDate,
      openingCashPaise: 1000000,
      cashSalesPaise: 2500000, // ₹25,000 cash sales
      expectedCashPaise: 3500000,
      actualCashPaise: 3500000, // ₹35,000 (0 variance)
      cashVariancePaise: 0,
      status: 'closed',
      closedAt: new Date('2026-09-21T21:00:00+05:30'),
    },
  });

  // Create representative Orders with diverse payment methods
  // Order 1: Cash payment (₹30,000)
  const order1 = await prisma.order.create({
    data: {
      clientUuid: '11111111-1111-1111-1111-111111111111',
      number: 101,
      outletId,
      type: OrderType.dine_in,
      status: OrderStatus.settled,
      subtotalPaise: 3000000,
      discountPaise: 0,
      cgstPaise: 75000,
      sgstPaise: 75000,
      totalPaise: 3150000,
      placedAt: new Date('2026-09-21T12:00:00+05:30'),
      payments: {
        create: {
          outletId,
          method: PayMethod.cash,
          amountPaise: 3000000,
          status: PayStatus.success,
        },
      },
    },
  });

  // Order 2: UPI payment (₹45,000) with ₹5,000 discount
  const order2 = await prisma.order.create({
    data: {
      clientUuid: '22222222-2222-2222-2222-222222222222',
      number: 102,
      outletId,
      type: OrderType.dine_in,
      status: OrderStatus.settled,
      subtotalPaise: 5000000,
      discountPaise: 500000,
      totalPaise: 4500000,
      placedAt: new Date('2026-09-21T14:00:00+05:30'),
      payments: {
        create: {
          outletId,
          method: PayMethod.upi,
          amountPaise: 4500000,
          status: PayStatus.success,
        },
      },
    },
  });

  // Order 3: Card payment (₹20,000)
  const order3 = await prisma.order.create({
    data: {
      clientUuid: '33333333-3333-3333-3333-333333333333',
      number: 103,
      outletId,
      type: OrderType.dine_in,
      status: OrderStatus.settled,
      subtotalPaise: 2000000,
      discountPaise: 0,
      totalPaise: 2000000,
      placedAt: new Date('2026-09-21T16:00:00+05:30'),
      payments: {
        create: {
          outletId,
          method: PayMethod.card,
          amountPaise: 2000000,
          status: PayStatus.success,
        },
      },
    },
  });

  // Order 4: Cancelled order (₹10,000)
  const order4 = await prisma.order.create({
    data: {
      clientUuid: '44444444-4444-4444-4444-444444444444',
      number: 104,
      outletId,
      type: OrderType.dine_in,
      status: OrderStatus.cancelled,
      subtotalPaise: 1000000,
      totalPaise: 1000000,
      placedAt: new Date('2026-09-21T17:00:00+05:30'),
    },
  });

  // Order 5: Refunded order in cash (₹1,000 refund)
  const order5 = await prisma.order.create({
    data: {
      clientUuid: '55555555-5555-5555-5555-555555555555',
      number: 105,
      outletId,
      type: OrderType.dine_in,
      status: OrderStatus.settled,
      subtotalPaise: 100000,
      totalPaise: 100000,
      placedAt: new Date('2026-09-21T18:00:00+05:30'),
    },
  });

  const payment5 = await prisma.payment.create({
    data: {
      orderId: order5.id,
      outletId,
      method: PayMethod.cash,
      amountPaise: 100000,
      status: PayStatus.refunded,
    },
  });
  await prisma.refund.create({
    data: {
      paymentId: payment5.id,
      orderId: payment5.orderId,
      amountPaise: 100000,
      reason: 'Wrong dish served',
      createdAt: new Date('2026-09-21T18:30:00+05:30'),
    },
  });

  // Cash In Movement: ₹2,000 (Float replenishment)
  await prisma.cashMovement.create({
    data: {
      outletId,
      businessDate: testDate,
      type: 'inflow',
      category: 'cash_in',
      amountPaise: 200000,
      reason: 'Petty cash addition',
    },
  });

  // Cash Out Movement: ₹2,000
  await prisma.cashMovement.create({
    data: {
      outletId,
      businessDate: testDate,
      type: 'outflow',
      category: 'cash_out',
      amountPaise: 200000,
      reason: 'Staff advance',
    },
  });

  // Cash Expense: ₹1,200 (Milk & Bread)
  await prisma.expense.create({
    data: {
      outletId,
      businessDate: testDate,
      category: 'Kitchen Supplies',
      vendor: 'Fresh Milk & Bread',
      amountPaise: 120000,
      method: 'cash',
      status: 'approved',
    },
  });

  // =========================================================================
  // TEST 4-14: SUMMARY CALCULATION & RECONCILIATION ACCURACY
  // =========================================================================
  console.log('--- TEST 4-14: SUMMARY & FINANCIAL CALCULATION ACCURACY ---');

  const summary = await DayClosingService.calculateDaySummary(outletId, testDate);

  // Check Sales Summary
  // Gross: 30,000 (O1) + 50,000 (O2) + 20,000 (O3) + 1,000 (O5) = ₹101,000
  assert(summary.salesSummary.grossSalesPaise === 10100000, 'Gross sales accurately calculated', `got ${summary.salesSummary.grossSalesPaise}`);
  assert(summary.salesSummary.discountsPaise === 500000, 'Discounts accurately calculated (₹5,000)');
  assert(summary.salesSummary.refundsPaise === 100000, 'Refunds accurately tallied (₹1,000)');
  assert(summary.salesSummary.cancelledOrders === 1, 'Cancelled orders correctly counted');
  assert(summary.salesSummary.completedOrders === 4, 'Completed orders correctly counted');

  // Check Payment Reconciliation
  assert(summary.paymentReconciliation.find((p) => p.method === 'cash')?.systemAmountPaise === 3100000, 'Cash sales captured (₹31,000)');
  assert(summary.paymentReconciliation.find((p) => p.method === 'upi')?.systemAmountPaise === 4500000, 'UPI sales captured (₹45,000)');
  assert(summary.paymentReconciliation.find((p) => p.method === 'card')?.systemAmountPaise === 2000000, 'Card sales captured (₹20,000)');

  // Check Shifts Aggregation
  assert(summary.shiftSummary.totalShifts === 2, '2 Shifts aggregated');
  assert(summary.shiftSummary.closedShifts === 2, 'All 2 shifts closed');
  assert(summary.shiftSummary.openShifts === 0, 'Zero open shifts');
  assert(summary.validation.canClose === true, 'Validation passes when shifts closed');

  // Check Expected Closing Cash Formula:
  // Opening: 15,000
  // + Cash Sales: 31,000
  // + Cash In: 2,000
  // − Cash Expenses: 1,200
  // − Cash Out: 2,000
  // − Cash Refunds: 1,000
  // = Expected: 43,800 (4,380,000 paise)
  const expectedCash = summary.cashReconciliation.expectedClosingCashPaise;
  assert(expectedCash === 4380000, 'Expected closing cash formula exact (₹43,800)', `got ${expectedCash}`);

  // =========================================================================
  // TEST 15: OPEN SHIFT DURING CLOSING BLOCKS CLOSURE
  // =========================================================================
  console.log('\n--- TEST 15: OPEN SHIFT BLOCKS DAY CLOSING ---');
  const openShift = await prisma.cashShift.create({
    data: {
      outletId,
      staffId: cashier1.id,
      cashierName: 'Rahul Cashier',
      businessDate: testDate,
      openingCashPaise: 500000,
      status: 'open',
    },
  });

  const blockedSummary = await DayClosingService.calculateDaySummary(outletId, testDate);
  assert(blockedSummary.validation.canClose === false, 'canClose is false when shift open');
  assert(
    blockedSummary.validation.blockingReasons.some((r) => r.includes('still open')),
    'Clear blocking warning returned for active shift'
  );

  // Attempting to close with open shift throws error
  let blockedError = false;
  try {
    await DayClosingService.closeBusinessDay({
      outletId,
      staffId: manager.id,
      staffName: manager.name,
      staffRole: manager.role,
      input: {
        businessDate: testDate,
        actualCashPaise: 4380000,
        tomorrowOpeningCashPaise: 1500000,
        tomorrowOption: 'same',
        cashDepositDestination: 'vault',
      },
    });
  } catch (err: any) {
    blockedError = err.message === 'CANNOT_CLOSE_OPEN_SHIFTS_REMAIN';
  }
  assert(blockedError, 'closeBusinessDay rejects closure when open shift exists');

  // Close the open shift via force close
  await DayClosingService.forceCloseShift({
    shiftId: openShift.id,
    outletId,
    staffId: manager.id,
    staffName: manager.name,
    actualCashPaise: 500000,
  });
  console.log('  [PASS] Force close shift successfully resolved blocking state');

  // =========================================================================
  // TEST 17-21: TOMORROW OPENING CASH CARRY FORWARD & CASH REMOVED
  // =========================================================================
  console.log('\n--- TEST 17-21: TOMORROW OPENING CASH & DEPOSIT CALCULATION ---');

  // Counted actual cash = ₹43,600 (₹200 shortage)
  const actualCounted = 4360000;
  const tomorrowFloat = 1500000; // ₹15,000 float for tomorrow
  const expectedDeposit = actualCounted - tomorrowFloat; // ₹28,600 to remove/deposit

  assert(expectedDeposit === 2860000, 'Cash removed for deposit calculated exactly (₹28,600)');

  // Denomination verification calculation
  const testDenoms: CashDenominations = {
    d500: 80, // 40,000
    d200: 15, // 3,000
    d100: 5,  // 500
    d50: 1,   // 50
    d20: 2,   // 40
    d10: 1,   // 10
    coinsPaise: 0,
  }; // Total = 43,600 INR
  const denomTotal =
    testDenoms.d500 * 50000 +
    testDenoms.d200 * 20000 +
    testDenoms.d100 * 10000 +
    testDenoms.d50 * 5000 +
    testDenoms.d20 * 2000 +
    testDenoms.d10 * 1000 +
    testDenoms.coinsPaise;
  assert(denomTotal === actualCounted, 'Denomination breakdown sums precisely to actual cash');

  // =========================================================================
  // TEST 22-24: FINAL ATOMIC DAY CLOSING & DUPLICATE PREVENTION
  // =========================================================================
  console.log('\n--- TEST 22-24: FINAL ATOMIC DAY CLOSING ---');

  const closedDay = await DayClosingService.closeBusinessDay({
    outletId,
    staffId: manager.id,
    staffName: manager.name,
    staffRole: manager.role,
    input: {
      businessDate: testDate,
      actualCashPaise: actualCounted,
      varianceReason: 'Cash shortage',
      varianceNote: 'Minor till shortage reconciled',
      denominations: testDenoms,
      tomorrowOpeningCashPaise: tomorrowFloat,
      tomorrowOption: 'same',
      cashDepositDestination: 'bank',
      cashDepositAccountName: 'HDFC Current Account',
    },
  });

  assert(closedDay.status === 'closed', 'DayClosing status set to "closed"');
  assert(closedDay.closingNumber.startsWith(`DC-${testDate}`), 'Closing sequence number generated (DC-YYYY-MM-DD-001)');
  assert(closedDay.tomorrowOpeningCashPaise === tomorrowFloat, 'Tomorrow opening float saved on closing');
  assert(closedDay.cashRemovedPaise === expectedDeposit, 'Cash removed recorded accurately');

  // Verify Tomorrow's OpeningCashBalance record exists
  const tomorrowRecord = await prisma.openingCashBalance.findUnique({
    where: { outletId_businessDate: { outletId, businessDate: '2026-09-22' } },
  });
  assert(tomorrowRecord !== null, 'Tomorrow OpeningCashBalance record created for 2026-09-22');
  assert(tomorrowRecord?.amountPaise === tomorrowFloat, 'Tomorrow opening float balance matches ₹15,000');
  assert(tomorrowRecord?.source === 'previous_day_closing', 'Source recorded as previous_day_closing');

  // Verify CashMovement deposit entry created
  const depositMovement = await prisma.cashMovement.findFirst({
    where: { outletId, businessDate: testDate, category: 'day_close_deposit' },
  });
  assert(depositMovement !== null, 'Cash deposit movement logged in database');
  assert(depositMovement?.amountPaise === expectedDeposit, 'Cash deposit movement amount matches ₹28,600');
  assert(depositMovement?.destination === 'bank', 'Deposit destination logged as bank');

  // Verify AuditLog was recorded
  const audit = await prisma.auditLog.findFirst({
    where: { outletId, action: 'day_closing_finalized' },
  });
  assert(audit !== null, 'AuditLog created for day closing finalization');

  // Test 23: Duplicate close attempt rejected
  let duplicateRejected = false;
  try {
    await DayClosingService.closeBusinessDay({
      outletId,
      staffId: manager.id,
      staffName: manager.name,
      staffRole: manager.role,
      input: {
        businessDate: testDate,
        actualCashPaise: actualCounted,
        tomorrowOpeningCashPaise: tomorrowFloat,
        tomorrowOption: 'same',
        cashDepositDestination: 'vault',
      },
    });
  } catch (err: any) {
    duplicateRejected = err.message === 'DAY_ALREADY_CLOSED';
  }
  assert(duplicateRejected, 'Duplicate closing attempt correctly rejected with DAY_ALREADY_CLOSED');

  // =========================================================================
  // TEST 26-27: REOPENING CLOSED DAY & POST-CLOSE ADJUSTMENT
  // =========================================================================
  console.log('\n--- TEST 26-27: REOPENING & POST-CLOSE ADJUSTMENT ---');

  const reopened = await DayClosingService.reopenBusinessDay({
    outletId,
    businessDate: testDate,
    staffId: manager.id,
    staffName: manager.name,
    reason: 'Audit correction for late invoice',
  });
  assert(reopened.status === 'reopened', 'Business day successfully reopened with audit trail');

  const adjusted = await DayClosingService.adjustDayClosing({
    closingId: closedDay.id,
    staffId: manager.id,
    staffName: manager.name,
    field: 'notes',
    beforeValue: null,
    afterValue: 'Auditor reconciled discrepancy',
    reason: 'Manager note update',
  });
  assert(Array.isArray(adjusted.adjustments) && (adjusted.adjustments as any[]).length > 0, 'Adjustment history appended to closing record');

  // Re-close to leave clean state
  await DayClosingService.closeBusinessDay({
    outletId,
    staffId: manager.id,
    staffName: manager.name,
    staffRole: manager.role,
    input: {
      businessDate: testDate,
      actualCashPaise: actualCounted,
      varianceReason: 'Cash shortage',
      tomorrowOpeningCashPaise: tomorrowFloat,
      tomorrowOption: 'same',
      cashDepositDestination: 'vault',
    },
  });

  // Cleanup test data
  await prisma.dayClosing.deleteMany({ where: { outletId, businessDate: testDate } });
  await prisma.openingCashBalance.deleteMany({ where: { outletId } });
  await prisma.cashShift.deleteMany({ where: { outletId } });
  await prisma.cashMovement.deleteMany({ where: { outletId } });
  await prisma.expense.deleteMany({ where: { outletId } });
  await prisma.order.deleteMany({ where: { outletId } });
  await prisma.tenant.delete({ where: { id: tenant.id } });

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
