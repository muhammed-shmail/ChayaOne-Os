import { prisma, OrderStatus, OrderType, OrderChannel, PayMethod, PayStatus } from '../src';
import { FinancialYearService } from '../../../apps/web/lib/services/financial-year.service';
import { DayBookService } from '../../../apps/web/lib/services/day-book.service';
import { DayClosingService } from '../../../apps/web/lib/services/day-closing.service';
import { formatINR } from '@cafeos/core';

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  CHAYAONE OS — DAY BOOK & FINANCIAL YEAR SETUP AUTOMATED TEST SUITE    ');
  console.log('========================================================================\n');

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

  // ──────────────────────────────────────────────────────────────────
  // 0. SETUP MULTI-TENANT TEST DATA
  // ──────────────────────────────────────────────────────────────────
  console.log('--- 0. SETUP MULTI-TENANT ENVIRONMENT ---');

  // Tenant A
  let tenantA = await prisma.tenant.findFirst({ where: { subdomain: 'test-daybook-tenant-a' } });
  if (!tenantA) {
    tenantA = await prisma.tenant.create({
      data: {
        name: 'DayBook Cafe A',
        subdomain: 'test-daybook-tenant-a',
        plan: 'pro',
      },
    });
  }

  let outletA = await prisma.outlet.findFirst({ where: { tenantId: tenantA.id } });
  if (!outletA) {
    outletA = await prisma.outlet.create({
      data: {
        tenantId: tenantA.id,
        name: 'Main Street Cafe',
        timezone: 'Asia/Kolkata',
        settings: {
          businessDay: {
            currentBusinessDate: '2026-09-24',
            status: 'open',
            cutoffHour: 4,
          },
        },
      },
    });
  }

  // Tenant B (for multi-tenant isolation testing)
  let tenantB = await prisma.tenant.findFirst({ where: { subdomain: 'test-daybook-tenant-b' } });
  if (!tenantB) {
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Isolated Cafe B',
        subdomain: 'test-daybook-tenant-b',
        plan: 'starter',
      },
    });
  }

  let outletB = await prisma.outlet.findFirst({ where: { tenantId: tenantB.id } });
  if (!outletB) {
    outletB = await prisma.outlet.create({
      data: {
        tenantId: tenantB.id,
        name: 'Secluded Branch B',
        timezone: 'Asia/Kolkata',
      },
    });
  }

  // Cleanup any old test FYs
  await prisma.financialYear.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.refund.deleteMany({ where: { order: { outletId: outletA.id } } });
  await prisma.payment.deleteMany({ where: { outletId: outletA.id } });
  await prisma.order.deleteMany({ where: { outletId: outletA.id } });
  await prisma.supplierPayment.deleteMany({ where: { outletId: outletA.id } });
  await prisma.vendor.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.expense.deleteMany({ where: { outletId: outletA.id } });
  await prisma.cashMovement.deleteMany({ where: { outletId: outletA.id } });
  await prisma.dayClosing.deleteMany({ where: { outletId: outletA.id } });
  await prisma.openingCashBalance.deleteMany({ where: { outletId: outletA.id } });

  console.log('Environment ready.\n');


  // ──────────────────────────────────────────────────────────────────
  // TEST 1-5: FINANCIAL YEAR CREATION, VALIDATION & DEFAULT INDIA (01 Apr – 31 Mar)
  // ──────────────────────────────────────────────────────────────────
  console.log('--- TEST 1-5: FINANCIAL YEAR CONFIGURATION & VALIDATION ---');

  // FY 2026-27 for Tenant A
  const fy26 = await FinancialYearService.createFinancialYear(tenantA.id, outletA.id, {
    name: 'FY 2026–27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isDefault: true,
    notes: 'Primary active fiscal year for India',
  });
  assert(fy26.status === 'active', 'TEST 1: Create active Financial Year 2026–27');
  assert(fy26.startDate === '2026-04-01' && fy26.endDate === '2027-03-31', 'TEST 2: FY dates span 01 Apr 2026 to 31 Mar 2027');

  // Overlap validation: trying to create another active FY overlapping FY 2026-27
  let overlapRejected = false;
  try {
    await FinancialYearService.createFinancialYear(tenantA.id, outletA.id, {
      name: 'FY 2026-27 Duplicate',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
    });
  } catch (e: any) {
    overlapRejected = e.message.includes('Overlaps with active financial year');
  }
  assert(overlapRejected, 'TEST 3: Overlapping active financial year correctly rejected with validation error');

  // Invalid date order: startDate > endDate
  let invalidOrderRejected = false;
  try {
    await FinancialYearService.createFinancialYear(tenantA.id, outletA.id, {
      name: 'Invalid FY',
      startDate: '2027-05-01',
      endDate: '2027-01-01',
    });
  } catch (e: any) {
    invalidOrderRejected = e.message.includes('Start date must be before end date');
  }
  assert(invalidOrderRejected, 'TEST 4: Start date after end date rejected');

  // Create FY 2027-28 (contiguous, non-overlapping)
  const fy27 = await FinancialYearService.createFinancialYear(tenantA.id, outletA.id, {
    name: 'FY 2027–28',
    startDate: '2027-04-01',
    endDate: '2028-03-31',
    isDefault: false,
    notes: 'Next financial year',
  });
  assert(fy27.name === 'FY 2027–28', 'TEST 5: Contiguous FY 2027–28 created successfully');

  // ──────────────────────────────────────────────────────────────────
  // TEST 6-7: FY DATE ASSOCIATION (31 March 2027 vs 01 April 2027)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6-7: FY DATE ASSOCIATION (User Spec Tests 6 & 7) ---');

  // Date 2027-03-31 must map to FY 2026-27
  const fyForMarch31 = await FinancialYearService.getActiveFinancialYear(tenantA.id, outletA.id, '2027-03-31');
  assert(fyForMarch31?.name === 'FY 2026–27', 'TEST 6: Transaction on 31 March 2027 belongs to FY 2026–27');

  // Date 2027-04-01 must map to FY 2027-28
  const fyForApril01 = await FinancialYearService.getActiveFinancialYear(tenantA.id, outletA.id, '2027-04-01');
  assert(fyForApril01?.name === 'FY 2027–28', 'TEST 7: Transaction on 01 April 2027 belongs to FY 2027–28');

  // ──────────────────────────────────────────────────────────────────
  // TEST 8-12: DAY BOOK TRANSACTION DERIVATION FROM EXISTING SYSTEMS
  // ──────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8-12: DAY BOOK TRANSACTION SOURCE OF TRUTH (POS, Expenses, Payouts) ---');

  // 1. Initial Opening Cash Balance for 2026-09-24
  await prisma.openingCashBalance.create({
    data: {
      outletId: outletA.id,
      businessDate: '2026-09-24',
      amountPaise: 1000000, // ₹10,000
      source: 'initial_float',
    },
  });

  // 2. POS Sale Order #1024 = ₹450 Cash
  const order1024 = await prisma.order.create({
    data: {
      clientUuid: '10240000-0000-0000-0000-000000001024',
      outletId: outletA.id,
      number: 1024,
      type: OrderType.dine_in,
      channel: OrderChannel.pos,
      status: OrderStatus.settled,
      subtotalPaise: 45000,
      totalPaise: 45000,
      placedAt: new Date('2026-09-24T09:10:00+05:30'),
    },
  });
  await prisma.payment.create({
    data: {
      orderId: order1024.id,
      outletId: outletA.id,
      method: PayMethod.cash,
      amountPaise: 45000,
      status: PayStatus.success,
      createdAt: new Date('2026-09-24T09:10:00+05:30'),
    },
  });

  // 3. POS Sale Order #1025 = ₹850 UPI
  const order1025 = await prisma.order.create({
    data: {
      clientUuid: '10250000-0000-0000-0000-000000001025',
      outletId: outletA.id,
      number: 1025,
      type: OrderType.dine_in,
      channel: OrderChannel.pos,
      status: OrderStatus.settled,
      subtotalPaise: 85000,
      totalPaise: 85000,
      placedAt: new Date('2026-09-24T10:15:00+05:30'),
    },
  });
  await prisma.payment.create({
    data: {
      orderId: order1025.id,
      outletId: outletA.id,
      method: PayMethod.upi,
      amountPaise: 85000,
      status: PayStatus.success,
      providerRef: 'upi-txn-98765',
      createdAt: new Date('2026-09-24T10:15:00+05:30'),
    },
  });

  // 4. POS Sale Order #1026 = ₹900 Card
  const order1026 = await prisma.order.create({
    data: {
      clientUuid: '10260000-0000-0000-0000-000000001026',
      outletId: outletA.id,
      number: 1026,
      type: OrderType.dine_in,
      channel: OrderChannel.pos,
      status: OrderStatus.settled,
      subtotalPaise: 90000,
      totalPaise: 90000,
      placedAt: new Date('2026-09-24T12:30:00+05:30'),
    },
  });
  await prisma.payment.create({
    data: {
      orderId: order1026.id,
      outletId: outletA.id,
      method: PayMethod.card,
      amountPaise: 90000,
      status: PayStatus.success,
      providerRef: 'card-auth-54321',
      createdAt: new Date('2026-09-24T12:30:00+05:30'),
    },
  });

  // 5. Expense: Milk purchase = ₹1,200 Cash
  await prisma.expense.create({
    data: {
      outletId: outletA.id,
      businessDate: '2026-09-24',
      category: 'Kitchen Supplies',
      vendor: 'Amul Agency',
      amountPaise: 120000,
      gstPaise: 6000,
      method: 'cash',
      status: 'approved',
      reference: 'EXP-021',
      paidAt: new Date('2026-09-24T09:35:00+05:30'),
      createdAt: new Date('2026-09-24T09:35:00+05:30'),
    },
  });

  // 6. Vendor Supplier Payment = ₹2,000 Bank
  const vendor = await prisma.vendor.create({
    data: {
      tenantId: tenantA.id,
      name: 'Fresh Coffee Suppliers',
      phone: '9876543210',
    },
  });

  await prisma.supplierPayment.create({
    data: {
      outletId: outletA.id,
      vendorId: vendor.id,
      amountPaise: 200000,
      method: 'bank',
      reference: 'PAY-045',
      note: 'Coffee bean delivery payment',
      paidAt: new Date('2026-09-24T11:00:00+05:30'),
      createdAt: new Date('2026-09-24T11:00:00+05:30'),
    },
  });

  // 7. Cash Drawer Inflow: Cash Float Top-up = ₹2,000
  await prisma.cashMovement.create({
    data: {
      outletId: outletA.id,
      businessDate: '2026-09-24',
      type: 'inflow',
      category: 'cash_in',
      amountPaise: 200000,
      reason: 'Petty cash drawer float top-up',
      createdAt: new Date('2026-09-24T08:30:00+05:30'),
    },
  });

  // Query Day Book for 2026-09-24
  const dayBook = await DayBookService.getDayBook(tenantA.id, outletA.id, {
    dateFrom: '2026-09-24',
    dateTo: '2026-09-24',
  });

  assert(dayBook.entries.length === 6, 'TEST 8: Day Book automatically derived 6 real transactions without manual duplicate entries');
  assert(dayBook.summary.openingBalancePaise === 1000000, 'TEST 9: Opening Balance matches ₹10,000');
  
  // Total Debits (Inflows):
  // Sale 1024 (450) + Sale 1025 (850) + Sale 1026 (900) + Cash In (2,000) = ₹4,200
  assert(dayBook.summary.totalDebitPaise === 420000, `TEST 10: Total Debits match ₹4,200 (Got: ${formatINR(dayBook.summary.totalDebitPaise)})`);

  // Total Credits (Outflows):
  // Expense (1,200) + Vendor Payment (2,000) = ₹3,200
  assert(dayBook.summary.totalCreditPaise === 320000, `TEST 11: Total Credits match ₹3,200 (Got: ${formatINR(dayBook.summary.totalCreditPaise)})`);

  // Net Movement = 4,200 - 3,200 = ₹1,000
  assert(dayBook.summary.netMovementPaise === 100000, 'TEST 12: Net Movement matches +₹1,000');

  // Closing Balance = Opening (10,000) + Net (1,000) = ₹11,000
  assert(dayBook.summary.closingBalancePaise === 1100000, `TEST 13: Closing Balance matches ₹11,000 (Got: ${formatINR(dayBook.summary.closingBalancePaise)})`);

  // ──────────────────────────────────────────────────────────────────
  // TEST 14-16: DAY BOOK FILTERING (TYPE, PAYMENT METHOD, SEARCH)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 14-16: DAY BOOK FILTERING & SEARCH ---');

  // Filter: Sales Only
  const salesOnly = await DayBookService.getDayBook(tenantA.id, outletA.id, {
    dateFrom: '2026-09-24',
    dateTo: '2026-09-24',
    type: 'sales',
  });
  assert(salesOnly.entries.length === 3 && salesOnly.entries.every((e) => e.type === 'sale'), 'TEST 14: Filter by [Sales] returns only sales records');

  // Filter: Method = Cash
  const cashOnly = await DayBookService.getDayBook(tenantA.id, outletA.id, {
    dateFrom: '2026-09-24',
    dateTo: '2026-09-24',
    paymentMethod: 'cash',
  });
  assert(cashOnly.entries.every((e) => e.method === 'cash'), 'TEST 15: Filter by [Cash] returns only cash transactions');

  // Search by Reference / Description
  const searchResult = await DayBookService.getDayBook(tenantA.id, outletA.id, {
    dateFrom: '2026-09-24',
    dateTo: '2026-09-24',
    search: 'Amul',
  });
  assert(searchResult.entries.length === 1 && searchResult.entries[0].reference === 'EXP-021', 'TEST 16: Search by vendor name "Amul" accurately locates EXP-021');

  // ──────────────────────────────────────────────────────────────────
  // TEST 17-19: DAY CLOSING INTEGRATION & RECONCILIATION CONSISTENCY
  // ──────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 17-19: DAY CLOSING INTEGRATION ---');

  // Perform Day Closing for 2026-09-24
  const closingRecord = await prisma.dayClosing.create({
    data: {
      outletId: outletA.id,
      businessDate: '2026-09-24',
      closingNumber: 'DC-2026-09-24-001',
      status: 'closed',
      closedByName: 'Manager Suresh',
      closedAt: new Date('2026-09-24T23:59:00+05:30'),
      openingCashPaise: 1000000,
      cashSalesPaise: 45000,
      upiSalesPaise: 85000,
      cardSalesPaise: 90000,
      grossSalesPaise: 220000,
      netSalesPaise: 220000,
      actualCashPaise: 1100000,
      tomorrowOpeningCashPaise: 1000000,
    },
  });

  const dayBookClosed = await DayBookService.getDayBook(tenantA.id, outletA.id, {
    dateFrom: '2026-09-24',
    dateTo: '2026-09-24',
  });

  assert(dayBookClosed.summary.dayClosingRecord !== null, 'TEST 17: Day Book detected finalized Day Closing record');
  assert(dayBookClosed.summary.dayClosingRecord?.closingNumber === 'DC-2026-09-24-001', 'TEST 18: Day Book references closing sequence DC-2026-09-24-001');
  assert(dayBookClosed.summary.closingBalancePaise === 1100000, 'TEST 19: Day Book closing balance remains consistent with Day Closing calculation');

  // ──────────────────────────────────────────────────────────────────
  // TEST 20-22: PERIOD LOCKING & CLOSED FINANCIAL YEAR ENFORCEMENT
  // ──────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 20-22: PERIOD LOCKING & CLOSED FY ENFORCEMENT ---');

  // Close FY 2026-27
  const closedFY = await FinancialYearService.closeFinancialYear(tenantA.id, fy26.id, {
    name: 'Owner Admin',
    role: 'owner',
  });
  assert(closedFY.status === 'closed', 'TEST 20: Financial Year 2026–27 status successfully updated to CLOSED');

  // Attempt to add an expense in the locked period (2026-09-24)
  let lockedBlocked = false;
  try {
    await FinancialYearService.assertDateNotLocked(tenantA.id, outletA.id, '2026-09-24');
  } catch (e: any) {
    lockedBlocked = e.message.includes('FINANCIAL_YEAR_LOCKED');
  }
  assert(lockedBlocked, 'TEST 21: Financial Year period locking strictly blocks new accounting records in closed FY');

  // Reopen Financial Year
  const reopenedFY = await FinancialYearService.reopenFinancialYear(tenantA.id, fy26.id, {
    name: 'Owner Admin',
    role: 'owner',
  });
  assert(reopenedFY.status === 'active', 'TEST 22: Manager/Owner authorized reopening restores FY active state');

  // ──────────────────────────────────────────────────────────────────
  // TEST 23-24: MULTI-TENANT ISOLATION (Tenant A vs Tenant B)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 23-24: MULTI-TENANT ISOLATION ---');

  // Tenant B queries Day Book
  const dayBookB = await DayBookService.getDayBook(tenantB.id, outletB.id, {
    dateFrom: '2026-09-24',
    dateTo: '2026-09-24',
  });

  assert(dayBookB.entries.length === 0, 'TEST 23: Tenant B sees zero transactions from Tenant A (complete tenant isolation)');

  const fysB = await FinancialYearService.listFinancialYears(tenantB.id, outletB.id);
  const containsTenantAFY = fysB.some((f) => f.id === fy26.id || f.id === fy27.id);
  assert(!containsTenantAFY, 'TEST 24: Tenant B cannot access or view Tenant A financial years');

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
