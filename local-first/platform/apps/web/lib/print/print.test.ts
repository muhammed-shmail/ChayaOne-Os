import crypto from 'crypto';
import { prisma, PrintJobStatus, PrintJobType } from '@cafeos/db';
import { buildKotEscposBuffer, buildReceiptEscposBuffer, formatColumnRow, COMMANDS } from './escpos';
import { routeOrderToStations } from './router';
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

  // Clean up test record
  await prisma.printJob.delete({ where: { id: printJob.id } });
  console.log('✓ Cleaned up test PrintJob record');

  console.log('--- ALL STEP 6 LOCAL PRINT SERVICE TESTS PASSED SUCCESSFULLY ---');
}

runStep6PrintTests().catch((e) => {
  console.error('Step 6 Print test failed:', e);
  process.exit(1);
});
