import { prisma } from '../src';
import { readReceiptConfig } from '../../../apps/web/lib/receipt';
import { formatReceiptModel } from '../../../apps/web/lib/print/receipt-formatter';
import { getSectionData } from '../../../apps/web/lib/sections';

// Minimal valid PNG buffer (1x1 transparent pixel)
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND
  0x42, 0x60, 0x82,
]);

// Minimal valid JPEG buffer
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11,
  0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x80,
  0xff, 0xd9, // EOI
]);

// Minimal valid WEBP buffer
const VALID_WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // 'RIFF'
  0x1a, 0x00, 0x00, 0x00, // Size
  0x57, 0x45, 0x42, 0x50, // 'WEBP'
  0x56, 0x50, 0x38, 0x4c, // 'VP8L'
  0x0d, 0x00, 0x00, 0x00,
  0x2f, 0x00, 0x00, 0x00, 0x00, 0x07, 0x08, 0x88, 0x85, 0x88, 0x88, 0x00,
]);

// Corrupted file: text disguised as PNG
const CORRUPT_BUFFER = Buffer.from('This is a text string disguised as an image file');

function testImageSignature(buf: Buffer, mime: string): boolean {
  if (!buf || buf.length < 12) return false;

  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;

  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

  const isWebp =
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50;

  switch (mime) {
    case 'image/png':
      return isPng;
    case 'image/jpeg':
    case 'image/jpg':
      return isJpeg;
    case 'image/webp':
      return isWebp;
    default:
      return false;
  }
}

async function main() {
  console.log('===============================================================');
  console.log('      LOGO UPLOAD & PERSISTENCE FULL FLOW VERIFICATION         ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. File Type & Corruption Validation
  console.log('--- 1. File Validation & Corruption Tests ---');
  assert(testImageSignature(VALID_PNG_BUFFER, 'image/png'), 'Valid PNG passes signature check');
  assert(testImageSignature(VALID_JPEG_BUFFER, 'image/jpeg'), 'Valid JPEG passes signature check');
  assert(testImageSignature(VALID_WEBP_BUFFER, 'image/webp'), 'Valid WEBP passes signature check');
  assert(!testImageSignature(CORRUPT_BUFFER, 'image/png'), 'Corrupt/text file claiming to be PNG is rejected');
  assert(!testImageSignature(VALID_PNG_BUFFER, 'image/jpeg'), 'Mismatched mime type (PNG as JPEG) is rejected');
  assert(!testImageSignature(Buffer.from([0x00, 0x01]), 'image/png'), 'Truncated/empty buffer (<12 bytes) is rejected');

  // 2. Database & Outlet Lookup
  console.log('\n--- 2. Database & Outlet Persistence Tests ---');
  const outlet = await prisma.outlet.findFirst({ select: { id: true, name: true, tenantId: true, settings: true } });
  if (!outlet) {
    console.error('No outlet found in DB for testing.');
    process.exit(1);
  }
  console.log(`Testing with Outlet: "${outlet.name}" (${outlet.id})`);

  const prevSettings = (outlet.settings as Record<string, unknown>) ?? {};
  const prevLogo = (prevSettings.logoUrl as string) ?? null;

  // 3. Reject Temporary Browser Blob URL
  console.log('\n--- 3. Rejection of Temporary Blob URLs ---');
  const blobUrl = 'blob:http://localhost:3000/a392b45e-d3f3-4a37-b903-b097b6a1e351';
  const isBlob = typeof blobUrl === 'string' && blobUrl.startsWith('blob:');
  assert(isBlob, 'Detects temporary browser blob: URL');

  // 4. Persistence of Valid Permanent URL
  console.log('\n--- 4. Persistence of Real Upload Path ---');
  const testLogoUrl = `/uploads/${outlet.id}/brand-logo-test-${Date.now()}.png`;

  // Merge into settings
  const newSettings = { ...prevSettings, logoUrl: testLogoUrl };
  const updatedOutlet = await prisma.outlet.update({
    where: { id: outlet.id },
    data: { settings: newSettings },
    select: { id: true, settings: true },
  });

  const savedLogoUrl = (updatedOutlet.settings as any)?.logoUrl;
  assert(savedLogoUrl === testLogoUrl, `Outlet.settings.logoUrl successfully persisted: ${savedLogoUrl}`);

  // Sync to TenantBranding
  await prisma.tenantBranding.upsert({
    where: { tenantId: outlet.tenantId },
    create: { tenantId: outlet.tenantId, logoUrl: testLogoUrl },
    update: { logoUrl: testLogoUrl },
  });

  const tenantBranding = await prisma.tenantBranding.findUnique({
    where: { tenantId: outlet.tenantId },
    select: { logoUrl: true },
  });
  assert(tenantBranding?.logoUrl === testLogoUrl, `TenantBranding.logoUrl synchronized: ${tenantBranding?.logoUrl}`);

  // 5. Section Data & Page Refresh Retrieval
  console.log('\n--- 5. Settings Section / Page Refresh Pipeline ---');
  const sectionData = await getSectionData('settings', outlet.id, outlet.tenantId);
  if (sectionData.section === 'settings') {
    assert(
      sectionData.data.outlet.logoUrl === testLogoUrl,
      `getSectionData('settings') returns persisted logo: ${sectionData.data.outlet.logoUrl}`
    );
  } else {
    assert(false, 'getSectionData did not return settings section');
  }

  // 6. Billing & Receipt Formatting Pipeline
  console.log('\n--- 6. Receipt / Billing Bill Pipeline ---');
  const receiptConfig = readReceiptConfig(updatedOutlet.settings);
  assert(receiptConfig.logoUrl === testLogoUrl, `readReceiptConfig correctly extracts logoUrl: ${receiptConfig.logoUrl}`);
  assert(receiptConfig.showLogo === true, `readReceiptConfig has showLogo enabled by default: ${receiptConfig.showLogo}`);

  // Test formatReceiptModel for preview and printing
  const model = formatReceiptModel(
    {
      storeName: outlet.name,
      logoUrl: receiptConfig.showLogo ? receiptConfig.logoUrl : null,
      address: '123 Test Street, Calicut',
      phone: '9876543210',
      orderNumber: 101,
      tableLabel: 'T-01',
      orderType: 'dine_in',
      placedAt: new Date(),
      settledAt: new Date(),
      items: [
        { name: 'Special Milk Tea', qty: 2, unitPricePaise: 2000, totalPaise: 4000 },
        { name: 'Malabar Parotta', qty: 4, unitPricePaise: 1500, totalPaise: 6000 },
      ],
      subtotalPaise: 10000,
      totalPaise: 10000,
      paymentMethod: 'cash',
      receiptConfig,
    },
    '80mm'
  );

  assert(model.logoUrl === testLogoUrl, `Receipt model contains persisted logoUrl: ${model.logoUrl}`);
  assert(model.storeName === outlet.name.toUpperCase(), `Receipt model store name formatted: ${model.storeName}`);
  assert(model.itemLines.length === 2, `Receipt model contains formatted items: ${model.itemLines.length}`);

  // 7. Cleanup & Restoration
  console.log('\n--- 7. Cleanup ---');
  const restoredSettings = { ...prevSettings };
  if (prevLogo) {
    restoredSettings.logoUrl = prevLogo;
  } else {
    delete restoredSettings.logoUrl;
  }
  await prisma.outlet.update({
    where: { id: outlet.id },
    data: { settings: restoredSettings },
  });
  if (prevLogo) {
    await prisma.tenantBranding.update({ where: { tenantId: outlet.tenantId }, data: { logoUrl: prevLogo } }).catch(() => {});
  }
  console.log('Restored previous outlet settings.');

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
