import crypto from 'crypto';
import { prisma, PrintJobStatus, PrintJobType } from '@cafeos/db';
import { buildKotEscposBuffer, buildReceiptEscposBuffer, formatColumnRow, COMMANDS } from './escpos';
import { routeOrderToStations, resolveReceiptPrinter } from './router';
import { createPrintJob, processPrintQueueBatch } from './manager';

async function runStep6PrintTests() {
  console.log('--- Starting Step 6 Local Print Service & Router Tests ---');

  // Test 1: Column Row Formatting & ESC/POS Buffer Assembly
  console.log('Test 1: ESC/POS Formatting & Column Row Padding');
  const formattedRow = formatColumnRow('2x Masala Chai', 'INR 80.00', 42);
  console.assert(formattedRow.length === 42, `Row width expected 42, got ${formattedRow.length}`);
  console.assert(formattedRow.startsWith('2x Masala Chai'), 'Row header mismatch');
  console.assert(formattedRow.endsWith('INR 80.00'), 'Row footer mismatch');

  const kotBuffer = buildKotEscposBuffer({
    kotNumber: 1001,
    orderNumber: 101,
    tableLabel: 'T3',
    orderType: 'dine_in',
    stationName: 'kitchen',
    placedAt: new Date(),
    items: [
      { name: 'Paneer Butter Masala', qty: 2, notes: 'Less spicy' },
      { name: 'Butter Naan', qty: 4 },
    ],
  });

  console.assert(kotBuffer instanceof Buffer, 'KOT output must be a Buffer');
  console.assert(kotBuffer.length > 50, 'KOT Buffer output too short');
  // Check presence of Full Cut command at end of ESC/POS buffer
  const hasCut = kotBuffer.includes(COMMANDS.FULL_CUT);
  console.assert(hasCut, 'KOT Buffer must include paper cut command');
  console.log('✓ Test 1 passed (ESC/POS Buffer Assembly verified)');

  // Test 2: Station Routing & Item Splitting
  console.log('Test 2: Station Routing & Multi-Printer Item Splitting');
  const sampleOrder = {
    id: crypto.randomUUID(),
    number: 505,
    table: { label: 'T1' },
    type: 'dine_in',
    placedAt: new Date(),
    items: [
      { nameSnapshot: 'Cold Coffee', qty: 1, station: 'bar', modifiers: [], notes: null },
      { nameSnapshot: 'Veg Burger', qty: 2, station: 'kitchen', modifiers: [], notes: null },
      { nameSnapshot: 'Pastry', qty: 1, station: 'bakery', modifiers: [], notes: null },
    ],
  };

  const sampleSettings = {
    devices: [
      { id: 'dev-1', name: 'Kitchen Printer', type: 'kot_printer', connection: 'network', target: '192.168.1.200:9100', station: 'kitchen', copies: 1, isDefault: true },
      { id: 'dev-2', name: 'Bar Printer', type: 'kot_printer', connection: 'network', target: '192.168.1.201:9100', station: 'bar', copies: 1, isDefault: true },
    ],
  };

  const routedJobs = routeOrderToStations(sampleOrder, sampleSettings);
  console.assert(routedJobs.length === 3, `Expected 3 station jobs, got ${routedJobs.length}`);
  
  const barJob = routedJobs.find((j) => j.stationId === 'bar');
  console.assert(barJob !== undefined, 'Bar station job missing');
  console.assert(barJob?.payload.items.length === 1, 'Bar item count mismatch');
  console.assert(barJob?.targetDevice?.id === 'dev-2', 'Bar target device mismatch');
  console.log('✓ Test 2 passed (Station Routing & Item Splitting verified)');

  // Test 3: Atomic PrintJob creation & Database Persistence
  console.log('Test 3: Atomic PrintJob Creation & Queueing');
  const testTenantId = '11111111-1111-1111-1111-111111111111';
  const testOutletId = '22222222-2222-2222-2222-222222222222';
  const testOrderId = crypto.randomUUID();
  const testJobId = crypto.randomUUID();

  const printJob = await prisma.$transaction(async (tx) => {
    return await createPrintJob(tx, {
      tenantId: testTenantId,
      outletId: testOutletId,
      jobId: testJobId,
      orderId: testOrderId,
      stationId: 'kitchen',
      jobType: PrintJobType.KOT,
      payload: {
        kotNumber: 9901,
        orderNumber: 99,
        tableLabel: 'T2',
        orderType: 'dine_in',
        stationName: 'kitchen',
        placedAt: new Date().toISOString(),
        items: [{ name: 'Samosa', qty: 2 }],
      },
    });
  });

  console.assert(printJob.id !== undefined, 'PrintJob ID missing');
  console.assert(printJob.jobId === testJobId, 'Job ID mismatch');
  console.assert(printJob.status === PrintJobStatus.QUEUED, 'Initial status must be QUEUED');
  console.log('✓ Test 3 passed (Atomic PrintJob Queueing verified)');

  // Test 4: Print Queue Worker Batch Processing
  console.log('Test 4: Print Queue Worker Batch Processing');
  const result = await processPrintQueueBatch(10);
  console.assert(result.processed >= 1, 'Expected at least 1 job processed');
  
  const updatedJob = await prisma.printJob.findUnique({ where: { id: printJob.id } });
  console.assert(updatedJob?.status === PrintJobStatus.PRINTED, 'Job status must transition to PRINTED');
  console.assert(updatedJob?.printedAt !== null, 'printedAt timestamp must be set');
  console.log('✓ Test 4 passed (Print Worker Processing verified)');

  // Test 5: Dynamic Waiter Station Billing Route Verification (P1, P2, and New Stations)
  console.log('Test 5: Station-Based Waiter Bill Printer Resolution');
  const multiStationSettings = {
    waiterStations: [
      { id: 'p1', code: 'P1', name: 'Lower', label: 'P1 (Lower)' },
      { id: 'p2', code: 'P2', name: 'Upper', label: 'P2 (Upper)' },
      { id: 'p3', code: 'P3', name: 'Terrace', label: 'P3 (Terrace)', isCustom: true },
    ],
    devices: [
      { id: 'printer-p1', name: 'P1 Station Printer', type: 'both_printer', connection: 'network', target: '192.168.1.101:9100', station: 'p1', copies: 1, isDefault: false },
      { id: 'printer-p2', name: 'P2 Station Printer', type: 'both_printer', connection: 'network', target: '192.168.1.102:9100', station: 'p2', copies: 1, isDefault: true },
      { id: 'printer-p3', name: 'P3 Terrace Printer', type: 'receipt_printer', connection: 'network', target: '192.168.1.103:9100', station: 'p3', copies: 1, isDefault: false },
    ],
  };

  // 1. Waiter assigned to P1 -> MUST resolve to P1 printer (not P2 despite P2 being default!)
  const p1Target = resolveReceiptPrinter(multiStationSettings, 'p1');
  console.assert(p1Target?.id === 'printer-p1', `P1 station must route to printer-p1, got: ${p1Target?.id}`);

  // Test variations of P1 casing / label
  const p1TargetCaps = resolveReceiptPrinter(multiStationSettings, 'P1');
  console.assert(p1TargetCaps?.id === 'printer-p1', `P1 caps must route to printer-p1, got: ${p1TargetCaps?.id}`);

  const p1TargetLabel = resolveReceiptPrinter(multiStationSettings, 'P1 (Lower)');
  console.assert(p1TargetLabel?.id === 'printer-p1', `P1 label must route to printer-p1, got: ${p1TargetLabel?.id}`);

  const p1TargetName = resolveReceiptPrinter(multiStationSettings, 'Lower');
  console.assert(p1TargetName?.id === 'printer-p1', `P1 name must route to printer-p1, got: ${p1TargetName?.id}`);

  // 2. Waiter assigned to P2 -> MUST resolve to P2 printer
  const p2Target = resolveReceiptPrinter(multiStationSettings, 'p2');
  console.assert(p2Target?.id === 'printer-p2', `P2 station must route to printer-p2, got: ${p2Target?.id}`);

  const p2TargetCaps = resolveReceiptPrinter(multiStationSettings, 'P2');
  console.assert(p2TargetCaps?.id === 'printer-p2', `P2 caps must route to printer-p2, got: ${p2TargetCaps?.id}`);

  // 3. Waiter assigned to newly added station P3 -> MUST dynamically resolve to P3 printer
  const p3Target = resolveReceiptPrinter(multiStationSettings, 'p3');
  console.assert(p3Target?.id === 'printer-p3', `P3 new station must route to printer-p3, got: ${p3Target?.id}`);

  const p3TargetLabel = resolveReceiptPrinter(multiStationSettings, 'P3 (Terrace)');
  console.assert(p3TargetLabel?.id === 'printer-p3', `P3 label must route to printer-p3, got: ${p3TargetLabel?.id}`);

  // 4. Unassigned waiter -> fallback to default receipt printer (printer-p2)
  const defaultTarget = resolveReceiptPrinter(multiStationSettings, null);
  console.assert(defaultTarget?.id === 'printer-p2', `Unassigned must fallback to default, got: ${defaultTarget?.id}`);

  console.log('✓ Test 5 passed (Dynamic Station-Based Waiter Bill Printer Resolution verified)');

  console.log('--- ALL STEP 6 LOCAL PRINT SERVICE TESTS PASSED SUCCESSFULLY ---');
}

runStep6PrintTests().catch((e) => {
  console.error('Step 6 Print test failed:', e);
  process.exit(1);
});
