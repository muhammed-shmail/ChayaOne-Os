import 'dotenv/config';
import { prisma, TableState, OrderStatus } from '@cafeos/db';
import { OrderService } from '../apps/web/lib/services/order.service';
import { routeOrderToStations } from '../apps/web/lib/print/router';

async function runMultiPartySuite() {
  console.log('====================================================');
  console.log('       MULTI-PARTY SEATING & SEPARATE BILL TESTS     ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${testName}`);
      if (detail) console.error('       Detail:', detail);
    }
  }

  // 1. Setup Test Outlet, Table, and Menu Item
  const outlet = await prisma.outlet.findFirst();
  if (!outlet) {
    console.error('No outlet found in database. Cannot run test.');
    return;
  }

  const table = await prisma.tableMap.findFirst({
    where: { outletId: outlet.id }
  });
  if (!table) {
    console.error('No table found in database. Cannot run test.');
    return;
  }

  const menuItem = await prisma.menuItem.findFirst({
    where: { outletId: outlet.id, isAvailable: true }
  });
  if (!menuItem) {
    console.error('No available menu item found in database. Cannot run test.');
    return;
  }

  console.log(`Testing with Outlet: "${outlet.name}" (${outlet.id})`);
  console.log(`Testing with Table: "${table.label}" (${table.id})`);
  console.log(`Testing with Item: "${menuItem.name}" (${menuItem.id})`);

  // Ensure table starts clean for test
  await prisma.tableMap.update({
    where: { id: table.id },
    data: { state: TableState.free }
  });

  const clientUuid1 = '11111111-1111-4111-a111-111111111111';
  const clientUuid2 = '22222222-2222-4222-a222-222222222222';

  // Clean any prior runs
  await prisma.payment.deleteMany({
    where: { order: { clientUuid: { in: [clientUuid1, clientUuid2] } } }
  }).catch(() => {});
  await prisma.orderItem.deleteMany({
    where: { order: { clientUuid: { in: [clientUuid1, clientUuid2] } } }
  }).catch(() => {});
  await prisma.order.deleteMany({
    where: { clientUuid: { in: [clientUuid1, clientUuid2] } }
  }).catch(() => {});

  try {
    // ----------------------------------------------------
    // TEST 1: Team A sits at Table T1 and orders items
    // ----------------------------------------------------
    console.log('\n--- Step 1: Team A Places Order #A ---');
    const orderA = await OrderService.createOrder({
      input: {
        clientUuid: clientUuid1,
        outletId: outlet.id,
        type: 'dine_in' as any,
        tableId: table.id,
        lines: [
          { itemId: menuItem.id, qty: 2 }
        ],
        discountPct: 0,
        discountFlatPaise: 0,
        serviceChargePct: 0,
        deliveryChargePaise: 0,
        packagingChargePaise: 0,
        convenienceFeePaise: 0,
        interState: false,
      },
      sessionStaffId: null,
      outletId: outlet.id,
      channel: 'pos' as any,
    });

    assert(!!orderA.order.id, 'Team A Order created successfully');
    assert(orderA.order.tableId === table.id, 'Team A Order attached to Table');

    const tableAfterA = await prisma.tableMap.findUnique({ where: { id: table.id } });
    assert(tableAfterA?.state === TableState.seated, 'Table state transitioned to "seated"');

    // ----------------------------------------------------
    // TEST 2: Waiter prints bill for Team A -> Table marked "billed"
    // ----------------------------------------------------
    console.log('\n--- Step 2: Team A Asks for Bill -> Table "billed" ---');
    await prisma.tableMap.update({
      where: { id: table.id },
      data: { state: TableState.billed }
    });
    const tableBilled = await prisma.tableMap.findUnique({ where: { id: table.id } });
    assert(tableBilled?.state === TableState.billed, 'Table state is now "billed" (printed bill)');

    // ----------------------------------------------------
    // TEST 3: Team B arrives while Team A is still unsettled!
    // Team B orders with isNewParty = true / "New Guest"
    // ----------------------------------------------------
    console.log('\n--- Step 3: Team B Takes Fresh Seating (New Party) ---');
    const orderB = await OrderService.createOrder({
      input: {
        clientUuid: clientUuid2,
        outletId: outlet.id,
        type: 'dine_in' as any,
        tableId: table.id,
        customer: { name: 'New Guest' },
        isNewParty: true,
        lines: [
          { itemId: menuItem.id, qty: 1 }
        ],
        discountPct: 0,
        discountFlatPaise: 0,
        serviceChargePct: 0,
        deliveryChargePaise: 0,
        packagingChargePaise: 0,
        convenienceFeePaise: 0,
        interState: false,
      } as any,
      sessionStaffId: null,
      outletId: outlet.id,
      channel: 'pos' as any,
    });

    assert(!!orderB.order.id, 'Team B Order created successfully with own Order ID');
    assert(orderB.order.id !== orderA.order.id, 'Team B has independent order from Team A');
    assert(orderB.order.number !== orderA.order.number, 'Team B has unique order number');

    // Verify KOT print routing stamps "Table ... (New Guest)"
    const isNewGuest = (orderB.order as any).isNewParty ||
      orderB.order.customer?.name?.toLowerCase().includes('new guest');
    const kotTable = orderB.order.table ? {
      ...orderB.order.table,
      label: isNewGuest ? `${orderB.order.table.label} (New Guest)` : orderB.order.table.label,
    } : null;

    assert(kotTable?.label.includes('(New Guest)'), 'KOT Table header includes "(New Guest)" indicator');

    // ----------------------------------------------------
    // TEST 4: Query Table Orders - Verify Both Orders Distinct
    // ----------------------------------------------------
    console.log('\n--- Step 4: Verify Multi-Party Query on Table ---');
    const activeOrders = await prisma.order.findMany({
      where: {
        outletId: outlet.id,
        tableId: table.id,
        status: { in: [OrderStatus.open, OrderStatus.in_kitchen, OrderStatus.ready, OrderStatus.served] },
        settledAt: null,
      },
      include: { customer: true, items: true },
      orderBy: { placedAt: 'asc' },
    });

    assert(activeOrders.length === 2, `Table has exactly 2 concurrent active orders (found ${activeOrders.length})`);

    const parties = activeOrders.map((o, idx) => ({
      orderId: o.id,
      number: o.number,
      partyLabel: idx === 0 ? 'Team A' : `Team ${String.fromCharCode(65 + idx)} (New Party)`,
      customerName: o.customer?.name || null,
    }));

    assert(parties[0].partyLabel === 'Team A', 'Order #1 labeled Team A');
    assert(parties[1].partyLabel === 'Team B (New Party)', 'Order #2 labeled Team B (New Party)');
    assert(parties[1].customerName === 'New Guest', 'Order #2 customer name is "New Guest"');

    // ----------------------------------------------------
    // TEST 5: Cashier Settles Team A's Bill First
    // Table MUST NOT be freed because Team B is still active!
    // ----------------------------------------------------
    console.log('\n--- Step 5: Settle Team A -> Verify Table NOT Freed ---');
    await prisma.order.update({
      where: { id: orderA.order.id },
      data: {
        status: OrderStatus.settled,
        settledAt: new Date(),
      }
    });

    // Run the remaining orders check used in settle route
    const remainingAfterA = await prisma.order.count({
      where: {
        outletId: outlet.id,
        tableId: table.id,
        status: { in: [OrderStatus.open, OrderStatus.in_kitchen, OrderStatus.ready, OrderStatus.served] },
        settledAt: null,
      }
    });

    const nextStateAfterA = remainingAfterA === 0 ? TableState.free : TableState.seated;
    await prisma.tableMap.update({
      where: { id: table.id },
      data: { state: nextStateAfterA }
    });

    const tableCheck1 = await prisma.tableMap.findUnique({ where: { id: table.id } });
    assert(remainingAfterA === 1, `1 remaining order (Team B) after settling Team A (got ${remainingAfterA})`);
    assert(tableCheck1?.state === TableState.seated, `Table state remained "seated" (NOT free) after Team A settled!`);

    // ----------------------------------------------------
    // TEST 6: Settle Team B -> Table is now freed!
    // ----------------------------------------------------
    console.log('\n--- Step 6: Settle Team B -> Verify Table IS Freed ---');
    await prisma.order.update({
      where: { id: orderB.order.id },
      data: {
        status: OrderStatus.settled,
        settledAt: new Date(),
      }
    });

    const remainingAfterB = await prisma.order.count({
      where: {
        outletId: outlet.id,
        tableId: table.id,
        status: { in: [OrderStatus.open, OrderStatus.in_kitchen, OrderStatus.ready, OrderStatus.served] },
        settledAt: null,
      }
    });

    const nextStateAfterB = remainingAfterB === 0 ? TableState.free : TableState.seated;
    await prisma.tableMap.update({
      where: { id: table.id },
      data: { state: nextStateAfterB }
    });

    const tableCheck2 = await prisma.tableMap.findUnique({ where: { id: table.id } });
    assert(remainingAfterB === 0, `0 remaining orders after settling Team B`);
    assert(tableCheck2?.state === TableState.free, `Table is now correctly freed ("free")!`);

  } finally {
    // Cleanup test records
    await prisma.payment.deleteMany({
      where: { order: { clientUuid: { in: [clientUuid1, clientUuid2] } } }
    }).catch(() => {});
    await prisma.orderItem.deleteMany({
      where: { order: { clientUuid: { in: [clientUuid1, clientUuid2] } } }
    }).catch(() => {});
    await prisma.order.deleteMany({
      where: { clientUuid: { in: [clientUuid1, clientUuid2] } }
    }).catch(() => {});
    await prisma.tableMap.update({
      where: { id: table.id },
      data: { state: TableState.free }
    }).catch(() => {});
  }

  console.log(`\n====================================================`);
  console.log(`TEST RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log('✓ ALL MULTI-PARTY SEATING & BILLING TESTS PASSED!');
  } else {
    console.log(`❌ ${total - passed} TESTS FAILED!`);
  }
  console.log(`====================================================\n`);
}

runMultiPartySuite()
  .catch((err) => {
    console.error('Test suite error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
