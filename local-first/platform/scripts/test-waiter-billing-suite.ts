import { prisma } from '@cafeos/db';
import { resolveReceiptPrinter, routeOrderToStations } from '../apps/web/lib/print/router';
import { normalizeStationId, isStationMatch, readWaiterStations } from '../apps/web/lib/waiter-stations';

async function runTestSuite() {
  console.log('====================================================');
  console.log('     COMPREHENSIVE WAITER BILLING & STATION TESTS   ');
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

  // 1. Check DB Outlets and current printer settings
  const outlets = await prisma.outlet.findMany({
    select: { id: true, name: true, settings: true }
  });
  console.log(`Found ${outlets.length} outlet(s) in DB.`);
  for (const o of outlets) {
    const s = o.settings as any;
    const devs = s?.devices || [];
    const stns = s?.waiterStations || [];
    console.log(`Outlet "${o.name}" (ID: ${o.id}):`);
    console.log(`  Devices count: ${devs.length}`);
    devs.forEach((d: any) => {
      console.log(`    - Device: "${d.name}" | Type: ${d.type} | Station: ${d.station || 'none'} | Default: ${d.isDefault}`);
    });
    console.log(`  Waiter Stations count: ${stns.length}`);
    stns.forEach((st: any) => {
      console.log(`    - Station: ${st.id} | Code: ${st.code} | Name: ${st.name}`);
    });
  }

  const staff = await prisma.staffUser.findMany({
    select: { id: true, name: true, role: true, permissions: true }
  });
  console.log(`\nConfigured staff in DB (${staff.length}):`);
  staff.forEach((s: any) => {
    console.log(`  - ${s.name} (${s.role}) -> Station: ${(s.permissions as any)?.station || 'unassigned'}`);
  });

  console.log('\n--- Normalization & Station Matching Tests ---');

  // Test 1: normalizeStationId variations
  assert(normalizeStationId('p1') === 'p1', 'normalizeStationId("p1") === "p1"');
  assert(normalizeStationId('P1') === 'p1', 'normalizeStationId("P1") === "p1"');
  assert(normalizeStationId('P1 (Lower)') === 'p1', 'normalizeStationId("P1 (Lower)") === "p1"');
  assert(normalizeStationId('station-p1') === 'p1', 'normalizeStationId("station-p1") === "p1"');
  assert(normalizeStationId('p2') === 'p2', 'normalizeStationId("p2") === "p2"');
  assert(normalizeStationId('P2') === 'p2', 'normalizeStationId("P2") === "p2"');
  assert(normalizeStationId('P2 (Upper)') === 'p2', 'normalizeStationId("P2 (Upper)") === "p2"');
  assert(normalizeStationId('p3') === 'p3', 'normalizeStationId("p3") === "p3"');
  assert(normalizeStationId('P3 (Terrace)') === 'p3', 'normalizeStationId("P3 (Terrace)") === "p3"');

  // Test 2: isStationMatch variations
  assert(isStationMatch('p1', 'P1'), 'isStationMatch("p1", "P1") === true');
  assert(isStationMatch('p1', 'P1 (Lower)'), 'isStationMatch("p1", "P1 (Lower)") === true');
  assert(isStationMatch('P1 (Lower)', 'p1'), 'isStationMatch("P1 (Lower)", "p1") === true');
  assert(isStationMatch('p2', 'P2'), 'isStationMatch("p2", "P2") === true');
  assert(isStationMatch('p2', 'P2 (Upper)'), 'isStationMatch("p2", "P2 (Upper)") === true');
  assert(!isStationMatch('p1', 'p2'), 'isStationMatch("p1", "p2") === false');
  assert(!isStationMatch('p1', 'P2 (Upper)'), 'isStationMatch("p1", "P2 (Upper)") === false');
  assert(isStationMatch('p3', 'P3'), 'isStationMatch("p3", "P3") === true');
  assert(isStationMatch('p3', 'p3-station'), 'isStationMatch("p3", "p3-station") === true');

  console.log('\n--- Dynamic Printer Resolution Tests ---');

  // Mock settings with multi-station setup: P1, P2, and newly added P3 & P4
  const testSettings = {
    waiterStations: [
      { id: 'p1', code: 'P1', name: 'P1 (Lower)', active: true },
      { id: 'p2', code: 'P2', name: 'P2 (Upper)', active: true },
      { id: 'p3', code: 'P3', name: 'P3 (Terrace)', active: true },
      { id: 'p4', code: 'P4', name: 'P4 (Garden)', active: true },
    ],
    devices: [
      { id: 'pr-p1', name: 'P1 Counter Thermal', type: 'receipt_printer', station: 'p1', ip: '192.168.1.101', port: 9100, copies: 1, isDefault: false },
      { id: 'pr-p2', name: 'P2 Upper Thermal', type: 'receipt_printer', station: 'P2 (Upper)', ip: '192.168.1.102', port: 9100, copies: 1, isDefault: true },
      { id: 'pr-p3', name: 'P3 Terrace Thermal', type: 'receipt_printer', station: 'p3', ip: '192.168.1.103', port: 9100, copies: 1, isDefault: false },
      { id: 'pr-p4', name: 'P4 Garden Thermal', type: 'both_printer', station: 'p4', ip: '192.168.1.104', port: 9100, copies: 1, isDefault: false },
      { id: 'pr-kitchen', name: 'Kitchen KOT Printer', type: 'kot_printer', station: 'kitchen', ip: '192.168.1.200', port: 9100, copies: 1, isDefault: false },
    ],
  };

  // Waiter assigned to P1 -> MUST route to pr-p1 (NOT pr-p2 even though pr-p2 is marked isDefault!)
  const p1Resolved = resolveReceiptPrinter(testSettings, 'p1');
  assert(p1Resolved?.id === 'pr-p1', 'Waiter assigned to "p1" routes to P1 printer (NOT default P2)', { resolved: p1Resolved });

  const p1UpperResolved = resolveReceiptPrinter(testSettings, 'P1');
  assert(p1UpperResolved?.id === 'pr-p1', 'Waiter assigned to "P1" routes to P1 printer', { resolved: p1UpperResolved });

  const p1WithLabelResolved = resolveReceiptPrinter(testSettings, 'P1 (Lower)');
  assert(p1WithLabelResolved?.id === 'pr-p1', 'Waiter assigned to "P1 (Lower)" routes to P1 printer', { resolved: p1WithLabelResolved });

  // Waiter assigned to P2 -> MUST route to pr-p2
  const p2Resolved = resolveReceiptPrinter(testSettings, 'p2');
  assert(p2Resolved?.id === 'pr-p2', 'Waiter assigned to "p2" routes to P2 printer', { resolved: p2Resolved });

  const p2UpperResolved = resolveReceiptPrinter(testSettings, 'P2 (Upper)');
  assert(p2UpperResolved?.id === 'pr-p2', 'Waiter assigned to "P2 (Upper)" routes to P2 printer', { resolved: p2UpperResolved });

  // Dynamically added station P3 -> MUST route to pr-p3
  const p3Resolved = resolveReceiptPrinter(testSettings, 'p3');
  assert(p3Resolved?.id === 'pr-p3', 'Dynamically added station P3 routes to P3 printer', { resolved: p3Resolved });

  // Dynamically added station P4 (both_printer) -> MUST route to pr-p4
  const p4Resolved = resolveReceiptPrinter(testSettings, 'p4');
  assert(p4Resolved?.id === 'pr-p4', 'Dynamically added station P4 routes to P4 both_printer', { resolved: p4Resolved });

  // Dynamically added station P5 without dedicated receipt printer -> Falls back to default printer
  const p5Resolved = resolveReceiptPrinter(testSettings, 'p5');
  assert(p5Resolved?.id === 'pr-p2', 'Newly added station without dedicated printer falls back to default receipt printer', { resolved: p5Resolved });

  // Unassigned waiter or null station -> Falls back safely to default printer (pr-p2)
  const defaultResolved = resolveReceiptPrinter(testSettings, null);
  assert(defaultResolved?.id === 'pr-p2', 'Unassigned waiter gracefully falls back to default receipt printer', { resolved: defaultResolved });

  console.log('\n--- Print Queue Manager Station Override Tests ---');
  // Scenario: A job was recorded with printerId = pr-p2 (default), but job.stationId = "p1"
  // Manager logic must override pr-p2 with pr-p1 to honor the waiter's station!
  function resolveManagerDevice(settings: any, job: { printerId?: string; stationId?: string; jobType: string }) {
    const devices = (settings.devices || []);
    let targetDevice = devices.find((d: any) => d.id === job.printerId) || null;
    const isReceiptJob = job.jobType === 'RECEIPT' || job.jobType === 'BILL_PREVIEW';
    const stations = readWaiterStations(settings);

    if (isReceiptJob && job.stationId) {
      if (!targetDevice || !isStationMatch(targetDevice.station, job.stationId, stations)) {
        const stationDevice = resolveReceiptPrinter(settings, job.stationId);
        if (stationDevice) {
          targetDevice = stationDevice;
        }
      }
    }
    return targetDevice;
  }

  const managerOverridden = resolveManagerDevice(testSettings, {
    printerId: 'pr-p2', // Erroneously pointing to P2
    stationId: 'p1',     // Waiter is assigned to P1
    jobType: 'BILL_PREVIEW',
  });
  assert(
    managerOverridden?.id === 'pr-p1',
    'Queue manager correctly overrides wrong/default printerId to waiter station printer (P1)',
    { resolved: managerOverridden }
  );

  const managerP2Correct = resolveManagerDevice(testSettings, {
    printerId: 'pr-p1',
    stationId: 'p2',     // Waiter is assigned to P2
    jobType: 'BILL_PREVIEW',
  });
  assert(
    managerP2Correct?.id === 'pr-p2',
    'Queue manager correctly overrides to P2 printer when waiter is P2',
    { resolved: managerP2Correct }
  );

  console.log('\n--- KOT Routing Regression Tests ---');
  // Verify KOT functionality remains untouched and functional
  const mockOrder = {
    id: 'ord-123',
    number: 42,
    table: { label: 'T-05' },
    type: 'DINE_IN',
    placedAt: new Date(),
    items: [
      { nameSnapshot: 'Chai', qty: 2, station: 'kitchen', modifiers: [], notes: 'Less sugar' },
      { nameSnapshot: 'Juice', qty: 1, station: 'juice', modifiers: [], notes: null },
    ],
  };

  const kotSettings = {
    devices: [
      { id: 'pr-kitchen', name: 'Kitchen KOT', type: 'kot_printer', station: 'kitchen', ip: '192.168.1.200', port: 9100, copies: 1, isDefault: false },
      { id: 'pr-juice', name: 'Juice KOT', type: 'kot_printer', station: 'juice', ip: '192.168.1.201', port: 9100, copies: 1, isDefault: false },
    ],
  };

  const kotJobs = routeOrderToStations(mockOrder, kotSettings, 'p1');
  assert(kotJobs.length === 2, 'KOT router produces 2 station jobs (Kitchen & Juice)');

  const kitchenJob = kotJobs.find((j) => j.targetDevice?.id === 'pr-kitchen');
  assert(Boolean(kitchenJob), 'Kitchen job exists and targets pr-kitchen');
  assert(kitchenJob?.payload.items[0]?.name === 'Chai', 'Kitchen job contains Chai');

  const juiceJob = kotJobs.find((j) => j.targetDevice?.id === 'pr-juice');
  assert(Boolean(juiceJob), 'Juice job exists and targets pr-juice');
  assert(juiceJob?.payload.items[0]?.name === 'Juice', 'Juice job contains Juice');

  console.log('\n====================================================');
  console.log(`RESULT: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((e) => {
    console.error('Test suite failed with exception:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
