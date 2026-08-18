import crypto from 'crypto';
import { prisma, DeviceRole } from '@cafeos/db';
import { generatePairingCode, claimPairingCode } from '../devices';

async function runDevicePairingConcurrencyTest() {
  console.log('--- Starting Step 8 Device Pairing Concurrency & Rate Limiting Tests ---');

  // 1. Fetch or create valid tenant & outlet for FK constraints
  let outlet = await prisma.outlet.findFirst();
  if (!outlet) {
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant' },
    });
    outlet = await prisma.outlet.create({
      data: { tenantId: tenant.id, name: 'Test Outlet' },
    });
  }

  const testTenantId = outlet.tenantId;
  const testOutletId = outlet.id;

  // 2. Generate active pairing code
  console.log('Test 1: Generating 6-digit pairing code...');
  const pairingCodeObj = await generatePairingCode({
    tenantId: testTenantId,
    outletId: testOutletId,
    targetRole: DeviceRole.POS,
  });

  const code = pairingCodeObj.code;
  console.assert(code.length === 6, 'Pairing code must be 6 digits');
  console.log(`✓ Pairing code generated: ${code}`);

  // 3. Simulate 5 simultaneous concurrent claim requests for the exact same code
  console.log('Test 2: Executing 5 simultaneous concurrent claim requests for the same code...');
  
  const devices = Array.from({ length: 5 }, (_, i) => ({
    deviceId: crypto.randomUUID(),
    deviceName: `Test Device ${i + 1}`,
  }));

  const results = await Promise.allSettled(
    devices.map((d) =>
      claimPairingCode({
        code,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        ipAddress: '192.168.1.105',
        userAgent: 'TestBrowser/1.0',
      })
    )
  );

  let successfulClaims = 0;
  let rejectedClaims = 0;

  for (const res of results) {
    if (res.status === 'fulfilled') {
      successfulClaims++;
    } else {
      rejectedClaims++;
      console.assert(
        res.reason?.message === 'INVALID_PAIRING_CODE',
        `Expected INVALID_PAIRING_CODE, got ${res.reason?.message}`
      );
    }
  }

  console.log(`Results: ${successfulClaims} successful claim(s), ${rejectedClaims} rejected claim(s).`);

  if (successfulClaims !== 1 || rejectedClaims !== 4) {
    throw new Error(`CONCURRENCY ASSERTION FAILED: Expected 1 success and 4 rejected, got ${successfulClaims} success and ${rejectedClaims} rejected.`);
  }

  console.log('✓ Test 2 PASSED (Strict Atomic Concurrency Guarantee verified: successfulClaims === 1)');

  // Clean up created test device records and pairing code
  const claimedDevice = results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>;
  if (claimedDevice?.value?.device?.id) {
    await prisma.device.delete({ where: { id: claimedDevice.value.device.id } });
  }
  await prisma.devicePairingCode.deleteMany({ where: { outletId: testOutletId } });

  console.log('✓ Cleaned up test device and pairing code records.');
  console.log('--- ALL DEVICE PAIRING CONCURRENCY TESTS PASSED SUCCESSFULLY ---');
}

runDevicePairingConcurrencyTest().catch((e) => {
  console.error('Device pairing concurrency test failed:', e);
  process.exit(1);
});
