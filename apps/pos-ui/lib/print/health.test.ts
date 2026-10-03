import net from 'net';
import { printerHealthCheck, parsePrinterEndpoint, ERROR_DIAGNOSTICS } from './health.ts';

async function runTests() {
  console.log('========================================');
  console.log('PRINTER HEALTH & CONNECTION TEST SUITE');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  // --- UNIT TESTS: parsePrinterEndpoint ---
  console.log('--- TEST GROUP 1: Endpoint Parsing & Validation ---');

  const ep1 = parsePrinterEndpoint({ host: '192.168.1.100', port: '9100' });
  assert(ep1.isValid && ep1.host === '192.168.1.100' && ep1.port === 9100, 'Valid host and port');

  const ep2 = parsePrinterEndpoint({ host: '192.168.1.100:9100' });
  assert(ep2.isValid && ep2.host === '192.168.1.100' && ep2.port === 9100, 'Combined host:port string');

  const ep3 = parsePrinterEndpoint({ target: '192.168.220.53:9' });
  assert(ep3.isValid && ep3.host === '192.168.220.53' && ep3.port === 9, 'Target string with port 9 parsed accurately');

  const ep4 = parsePrinterEndpoint({ host: '', target: '' });
  assert(!ep4.isValid && ep4.error === 'ERR_NOT_CONFIGURED', 'Empty host caught as ERR_NOT_CONFIGURED');

  const ep5 = parsePrinterEndpoint({ host: '192.168.1.1', port: 70000 });
  assert(!ep5.isValid && ep5.error === 'ERR_INVALID_PORT', 'Port > 65535 caught as ERR_INVALID_PORT');

  const ep6 = parsePrinterEndpoint({ host: '192.168.1.1', port: 0 });
  assert(!ep6.isValid && ep6.error === 'ERR_INVALID_PORT', 'Port 0 caught as ERR_INVALID_PORT');

  const ep7 = parsePrinterEndpoint({ host: '192.168.1.1', port: 'invalid' });
  assert(!ep7.isValid && ep7.error === 'ERR_INVALID_PORT', 'Non-numeric port caught as ERR_INVALID_PORT');

  // --- TEST GROUP 2: Diagnostics dictionary ---
  console.log('\n--- TEST GROUP 2: Error Diagnostics Mapping ---');
  assert(!!ERROR_DIAGNOSTICS.ECONNREFUSED, 'ECONNREFUSED mapped');
  assert(!!ERROR_DIAGNOSTICS.ETIMEDOUT, 'ETIMEDOUT mapped');
  assert(!!ERROR_DIAGNOSTICS.EHOSTUNREACH, 'EHOSTUNREACH mapped');
  assert(!!ERROR_DIAGNOSTICS.ERR_NOT_CONFIGURED, 'ERR_NOT_CONFIGURED mapped');

  // --- TEST GROUP 3: Unconfigured Printer Check ---
  console.log('\n--- TEST GROUP 3: Unconfigured / Invalid Printer Health Checks ---');
  const checkEmpty = await printerHealthCheck({ host: '' });
  assert(checkEmpty.status === 'NOT_CONFIGURED' && !checkEmpty.success, 'Empty printer returns status: NOT_CONFIGURED');

  const checkBadPort = await printerHealthCheck({ host: '192.168.1.100', port: 99999 });
  assert(checkBadPort.status === 'NOT_CONFIGURED' && checkBadPort.errorCode === 'ERR_INVALID_PORT', 'Invalid port returns status: NOT_CONFIGURED and ERR_INVALID_PORT');

  // --- TEST GROUP 4: Local Mock TCP Server (ONLINE & Connection Refused) ---
  console.log('\n--- TEST GROUP 4: TCP Socket Lifecycle & Connection State ---');

  // Find an available port for mock server
  const mockServer = net.createServer((socket) => {
    // Keep connection alive briefly, then end
    setTimeout(() => socket.end(), 100);
  });

  const mockPort = await new Promise<number>((resolve) => {
    mockServer.listen(0, '127.0.0.1', () => {
      const addr = mockServer.address() as net.AddressInfo;
      resolve(addr.port);
    });
  });

  // Test ONLINE against local mock server
  const checkOnline = await printerHealthCheck({
    host: '127.0.0.1',
    port: mockPort,
    timeoutMs: 1000
  });

  assert(checkOnline.success === true && checkOnline.status === 'ONLINE', 'Active TCP server returns ONLINE');
  assert(typeof checkOnline.latencyMs === 'number' && checkOnline.latencyMs >= 0, `Latency calculated accurately: ${checkOnline.latencyMs}ms`);

  // Close mock server
  await new Promise<void>((resolve) => mockServer.close(() => resolve()));

  // Test Connection Refused on closed mock port
  const checkRefused = await printerHealthCheck({
    host: '127.0.0.1',
    port: mockPort,
    timeoutMs: 1000
  });

  assert(checkRefused.success === false && checkRefused.status === 'UNREACHABLE', 'Closed port returns UNREACHABLE');
  assert(checkRefused.errorCode === 'ECONNREFUSED', `Closed port detected errorCode ECONNREFUSED (got ${checkRefused.errorCode})`);
  assert(checkRefused.message.includes('rejected'), 'User-friendly message returned for ECONNREFUSED');

  // Test Timeout Handling against non-routable IP
  console.log('\n--- TEST GROUP 5: Network Timeout Handling ---');
  const startTime = Date.now();
  const checkTimeout = await printerHealthCheck({
    host: '10.255.255.1', // Non-routable blackhole IP
    port: 9100,
    timeoutMs: 400
  });
  const elapsed = Date.now() - startTime;

  assert(checkTimeout.success === false && checkTimeout.status === 'UNREACHABLE', 'Timeout returns status: UNREACHABLE');
  assert(checkTimeout.errorCode === 'ETIMEDOUT', `Timeout detected errorCode ETIMEDOUT (got ${checkTimeout.errorCode})`);
  assert(elapsed >= 350 && elapsed < 1500, `Timeout respects timeoutMs (elapsed: ${elapsed}ms)`);

  // --- TEST GROUP 6: Real Subnet Device Testing ---
  console.log('\n--- TEST GROUP 6: Real Subnet Device Probe (192.168.220.53) ---');
  console.log('Testing user scenario: 192.168.220.53:9 vs 192.168.220.53:9100');

  const checkPort9 = await printerHealthCheck({
    host: '192.168.220.53',
    port: 9,
    timeoutMs: 1500
  });
  console.log('Result for 192.168.220.53:9 ->', {
    status: checkPort9.status,
    errorCode: checkPort9.errorCode,
    message: checkPort9.message
  });
  assert(checkPort9.status === 'UNREACHABLE' && checkPort9.success === false, 'Port 9 is UNREACHABLE on real network (confirms bug reproduction)');

  const checkPort9100 = await printerHealthCheck({
    host: '192.168.220.53',
    port: 9100,
    timeoutMs: 2000
  });
  console.log('Result for 192.168.220.53:9100 ->', {
    status: checkPort9100.status,
    latencyMs: checkPort9100.latencyMs,
    message: checkPort9100.message
  });
  assert(checkPort9100.status === 'ONLINE' && checkPort9100.success === true, 'Port 9100 is ONLINE on physical printer (~' + checkPort9100.latencyMs + 'ms)');

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
