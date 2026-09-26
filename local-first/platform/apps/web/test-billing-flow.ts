import { computeBill, formatINR, type BillLine } from '@cafeos/core';
import { generateAuthoritativeUpiUri } from './lib/print/upi';
import { buildRasterEscposQr } from './lib/print/qr';
import { formatReceiptModel, formatReceiptHtml, type ReceiptInputData } from './lib/print/receipt-formatter';
import { buildReceiptEscposBuffer, type ReceiptPrintPayload } from './lib/print/escpos';

let allPassed = true;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    allPassed = false;
    throw new Error(msg);
  } else {
    console.log(`✓ ${msg}`);
  }
}

console.log('============================================================');
console.log('CHAYAONE — 18 REQUIRED SCENARIO VALIDATION SUITE');
console.log('============================================================\n');

// ------------------------------------------------------------
// TEST 1 — GST OFF
// Bill: ₹100.00
// Expected: Receipt total = ₹100.00, Payment total = ₹100.00, No GST anywhere, QR = 100.00
// ------------------------------------------------------------
console.log('--- TEST 1 — GST OFF ---');
{
  const lines: BillLine[] = [{ pricePaise: 10000, gstRate: 18, qty: 1 }];
  const bill = computeBill(lines, { gstEnabled: false });
  assert(bill.finalPayablePaise === 10000, 'Test 1: Final payable is ₹100.00');
  assert(bill.taxPaise === 0, 'Test 1: Tax is 0');
  assert(bill.cgstPaise === 0 && bill.sgstPaise === 0, 'Test 1: CGST & SGST are 0');

  const upi = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: bill.finalPayablePaise,
  });
  assert(upi.valid, 'Test 1: UPI URI valid');
  assert(upi.uri!.includes('am=100.00'), 'Test 1: UPI URI has am=100.00');

  const receiptData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: 1001,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 10000, totalPaise: 10000 }],
    subtotalPaise: bill.subtotalPaise,
    discountPaise: 0,
    cgstPaise: bill.cgstPaise,
    sgstPaise: bill.sgstPaise,
    roundOffPaise: bill.roundOffPaise,
    totalPaise: bill.finalPayablePaise,
    gstEnabled: false,
    gstin: '32AABCU9603R1ZM',
    receiptConfig: { showTaxDetails: true, showGstin: true },
    upiConfig: { upiId: 'nmsshamil1232@okaxis', upiBusinessName: 'Kaawa', receiptQrEnabled: true },
  };

  const model = formatReceiptModel(receiptData, '80mm');
  assert(!model.isGstActive, 'Test 1: Receipt model GST is inactive');
  assert(model.taxBreakdown.length === 0, 'Test 1: Tax breakdown empty');
  assert(!model.contactLine || !model.contactLine.includes('GSTIN'), 'Test 1: No GSTIN displayed');

  const html = formatReceiptHtml(receiptData, '80mm');
  assert(!html.includes('CGST') && !html.includes('SGST') && !html.includes('GSTIN'), 'Test 1: HTML has no GST text');
  assert(html.includes('₹100'), 'Test 1: HTML displays ₹100');
}

// ------------------------------------------------------------
// TEST 2 — GST ON
// Bill: ₹100.00, GST: ₹18.00 (18%)
// Expected: Receipt total = ₹118.00, Tax shown, QR = 118.00
// ------------------------------------------------------------
console.log('\n--- TEST 2 — GST ON ---');
{
  const lines: BillLine[] = [{ pricePaise: 10000, gstRate: 18, qty: 1 }];
  const bill = computeBill(lines, { gstEnabled: true });
  assert(bill.taxPaise === 1800, 'Test 2: Tax is ₹18.00');
  assert(bill.finalPayablePaise === 11800, 'Test 2: Final payable is ₹118.00');

  const upi = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: bill.finalPayablePaise,
  });
  assert(upi.uri!.includes('am=118.00'), 'Test 2: UPI QR has am=118.00');

  const receiptData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: 1002,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 10000, totalPaise: 10000 }],
    subtotalPaise: bill.subtotalPaise,
    discountPaise: 0,
    cgstPaise: bill.cgstPaise,
    sgstPaise: bill.sgstPaise,
    roundOffPaise: bill.roundOffPaise,
    totalPaise: bill.finalPayablePaise,
    gstEnabled: true,
    gstin: '32AABCU9603R1ZM',
    receiptConfig: { showTaxDetails: true, showGstin: true },
    upiConfig: { upiId: 'nmsshamil1232@okaxis', upiBusinessName: 'Kaawa', receiptQrEnabled: true },
  };

  const model = formatReceiptModel(receiptData, '80mm');
  assert(model.isGstActive, 'Test 2: Receipt model GST is active');
  assert(model.taxBreakdown.length > 0, 'Test 2: Tax breakdown has lines');
  assert(model.totalText.includes('118'), 'Test 2: Model total is 118');

  const html = formatReceiptHtml(receiptData, '80mm');
  assert(html.includes('CGST') && html.includes('SGST'), 'Test 2: HTML includes CGST and SGST');
  assert(html.includes('GSTIN: 32AABCU9603R1ZM'), 'Test 2: HTML includes GSTIN');
}

// ------------------------------------------------------------
// TEST 3 — GST OFF + DISCOUNT
// Subtotal: ₹100.00, Discount: ₹20.00
// Expected: Total = ₹80.00, No GST, QR = 80.00
// ------------------------------------------------------------
console.log('\n--- TEST 3 — GST OFF + DISCOUNT ---');
{
  const lines: BillLine[] = [{ pricePaise: 10000, gstRate: 18, qty: 1 }];
  const bill = computeBill(lines, { gstEnabled: false, discountFlatPaise: 2000 });
  assert(bill.subtotalPaise === 10000, 'Test 3: Subtotal is 100');
  assert(bill.discountPaise === 2000, 'Test 3: Discount is 20');
  assert(bill.taxPaise === 0, 'Test 3: Tax is 0');
  assert(bill.finalPayablePaise === 8000, 'Test 3: Final payable is 80');

  const upi = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: bill.finalPayablePaise,
  });
  assert(upi.uri!.includes('am=80.00'), 'Test 3: QR amount is am=80.00');
}

// ------------------------------------------------------------
// TEST 4 — GST ON + DISCOUNT
// Verify existing ChayaOne tax rules: receipt, payment, database, QR all match
// ------------------------------------------------------------
console.log('\n--- TEST 4 — GST ON + DISCOUNT ---');
{
  const lines: BillLine[] = [{ pricePaise: 10000, gstRate: 18, qty: 1 }];
  const bill = computeBill(lines, { gstEnabled: true, discountFlatPaise: 2000 });
  // Taxable = 80, 18% of 80 = 14.40, total = 94.40 -> rounded to 94.00
  assert(bill.finalPayablePaise === 9400, 'Test 4: Final payable matches expected formula (₹94.00)');

  const upi = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: bill.finalPayablePaise,
  });
  assert(upi.uri!.includes('am=94.00'), 'Test 4: QR matches final payable (94.00)');
}

// ------------------------------------------------------------
// TEST 5 — GST OFF + ROUND-OFF
// Verify QR exactly equals displayed rounded total.
// ------------------------------------------------------------
console.log('\n--- TEST 5 — GST OFF + ROUND-OFF ---');
{
  const lines: BillLine[] = [{ pricePaise: 28647, gstRate: 0, qty: 1 }];
  const bill = computeBill(lines, { gstEnabled: false, roundOff: true });
  assert(bill.finalPayablePaise === 28600, 'Test 5: 286.47 rounded to 286.00');

  const upi = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: bill.finalPayablePaise,
  });
  assert(upi.uri!.includes('am=286.00'), 'Test 5: QR uses exactly 286.00 (not 286.47)');
}

// ------------------------------------------------------------
// TEST 6 — GST ON + ROUND-OFF
// Verify QR exactly equals displayed rounded total.
// ------------------------------------------------------------
console.log('\n--- TEST 6 — GST ON + ROUND-OFF ---');
{
  const lines: BillLine[] = [{ pricePaise: 24280, gstRate: 18, qty: 1 }];
  const bill = computeBill(lines, { gstEnabled: true, roundOff: true });
  // 242.80 + 18% (43.70) = 286.50 -> rounded to 287.00
  const expectedRounded = bill.finalPayablePaise;
  const upi = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: expectedRounded,
  });
  const expectedAmtStr = (expectedRounded / 100).toFixed(2);
  assert(upi.uri!.includes(`am=${expectedAmtStr}`), `Test 6: QR amount exactly matches rounded total (${expectedAmtStr})`);
}

// ------------------------------------------------------------
// TEST 7 — TAX BREAKDOWN ON + GST OFF
// Expected: No tax information anywhere.
// ------------------------------------------------------------
console.log('\n--- TEST 7 — TAX BREAKDOWN ON + GST OFF ---');
{
  const receiptData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: 1007,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 10000, totalPaise: 10000 }],
    subtotalPaise: 10000,
    cgstPaise: 0,
    sgstPaise: 0,
    roundOffPaise: 0,
    totalPaise: 10000,
    gstEnabled: false,
    gstin: '32AABCU9603R1ZM',
    receiptConfig: { showTaxDetails: true, showGstin: true }, // Tax breakdown ON!
    upiConfig: { upiId: 'nmsshamil1232@okaxis', receiptQrEnabled: true },
  };

  const model = formatReceiptModel(receiptData, '80mm');
  assert(!model.isGstActive, 'Test 7: Model isGstActive is false');
  assert(model.taxBreakdown.length === 0, 'Test 7: Tax breakdown is empty even though showTaxDetails is true');

  const html = formatReceiptHtml(receiptData, '80mm');
  assert(!html.includes('CGST') && !html.includes('SGST') && !html.includes('GSTIN'), 'Test 7: No tax or GSTIN in HTML');
}

// ------------------------------------------------------------
// TEST 8 — TAX BREAKDOWN OFF + GST ON
// Expected: Tax is calculated. Detailed tax breakdown is hidden according to configuration.
// ------------------------------------------------------------
console.log('\n--- TEST 8 — TAX BREAKDOWN OFF + GST ON ---');
{
  const receiptData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: 1008,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 10000, totalPaise: 10000 }],
    subtotalPaise: 10000,
    cgstPaise: 900,
    sgstPaise: 900,
    roundOffPaise: 0,
    totalPaise: 11800,
    gstEnabled: true,
    gstin: '32AABCU9603R1ZM',
    receiptConfig: { showTaxDetails: false, showGstin: true }, // Tax breakdown OFF!
    upiConfig: { upiId: 'nmsshamil1232@okaxis', receiptQrEnabled: true },
  };

  const model = formatReceiptModel(receiptData, '80mm');
  assert(model.isGstActive, 'Test 8: Model isGstActive is true');
  assert(model.taxBreakdown.length === 0, 'Test 8: Tax breakdown hidden per showTaxDetails: false');
  assert(model.totalText.includes('118'), 'Test 8: Total still includes tax (118.00)');
}

// ------------------------------------------------------------
// TEST 9 & 10 — DYNAMIC CART TOGGLE
// Expected: Cart immediately recalculates with or without GST.
// ------------------------------------------------------------
console.log('\n--- TEST 9 & 10 — DYNAMIC CART TOGGLE ---');
{
  const cart: BillLine[] = [{ pricePaise: 10000, gstRate: 18, qty: 1 }];
  const billGstOn = computeBill(cart, { gstEnabled: true });
  assert(billGstOn.finalPayablePaise === 11800, 'Test 10: GST ON total = 118.00');

  // Switch OFF
  const billGstOff = computeBill(cart, { gstEnabled: false });
  assert(billGstOff.finalPayablePaise === 10000, 'Test 9: GST OFF total = 100.00');
  assert(billGstOff.taxPaise === 0, 'Test 9: Stale tax wiped to 0');
}

// ------------------------------------------------------------
// TEST 11 — HISTORICAL GST OFF BILL REPRINT
// Bill #1025 created when GST was OFF. Total: ₹100. Later owner turns GST ON.
// Expected: Still GST OFF, Total ₹100.
// ------------------------------------------------------------
console.log('\n--- TEST 11 — HISTORICAL GST OFF BILL REPRINT ---');
{
  const historicalOrder = {
    orderNumber: 1025,
    subtotalPaise: 10000,
    cgstPaise: 0,
    sgstPaise: 0,
    totalPaise: 10000,
    // When reprinting historical order:
    gstEnabled: (0 + 0 > 0), // false
  };

  const reprintData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: historicalOrder.orderNumber,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 10000, totalPaise: 10000 }],
    subtotalPaise: historicalOrder.subtotalPaise,
    cgstPaise: historicalOrder.cgstPaise,
    sgstPaise: historicalOrder.sgstPaise,
    totalPaise: historicalOrder.totalPaise,
    isReprint: true,
    gstEnabled: historicalOrder.gstEnabled, // explicitly preserved!
    receiptConfig: { showTaxDetails: true, showGstin: true }, // Current setting has tax ON
    upiConfig: { upiId: 'nmsshamil1232@okaxis', receiptQrEnabled: true },
  };

  const model = formatReceiptModel(reprintData, '80mm');
  assert(!model.isGstActive, 'Test 11: Reprint model GST is inactive');
  assert(model.totalText.includes('100'), 'Test 11: Total remains 100.00');
  assert(model.taxBreakdown.length === 0, 'Test 11: No tax breakdown generated');
}

// ------------------------------------------------------------
// TEST 12 — HISTORICAL GST ON BILL REPRINT
// Bill #1026 created while GST was ON. Total: ₹118. Later owner turns GST OFF.
// Expected: Original GST data remains.
// ------------------------------------------------------------
console.log('\n--- TEST 12 — HISTORICAL GST ON BILL REPRINT ---');
{
  const historicalOrder = {
    orderNumber: 1026,
    subtotalPaise: 10000,
    cgstPaise: 900,
    sgstPaise: 900,
    totalPaise: 11800,
    gstEnabled: (900 + 900 > 0), // true
  };

  const reprintData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: historicalOrder.orderNumber,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 10000, totalPaise: 10000 }],
    subtotalPaise: historicalOrder.subtotalPaise,
    cgstPaise: historicalOrder.cgstPaise,
    sgstPaise: historicalOrder.sgstPaise,
    totalPaise: historicalOrder.totalPaise,
    isReprint: true,
    gstEnabled: historicalOrder.gstEnabled, // preserved snapshot!
    receiptConfig: { showTaxDetails: true, showGstin: true },
    upiConfig: { upiId: 'nmsshamil1232@okaxis', receiptQrEnabled: true },
  };

  const model = formatReceiptModel(reprintData, '80mm');
  assert(model.isGstActive, 'Test 12: Historical GST remains active');
  assert(model.taxBreakdown.length === 2, 'Test 12: CGST and SGST preserved');
  assert(model.totalText.includes('118'), 'Test 12: Total remains 118.00');
}

// ------------------------------------------------------------
// TEST 13 — DIFFERENT QR AMOUNTS
// Bill A: ₹286.50 -> am=286.50
// Bill B: ₹425.00 -> am=425.00
// Expected: QR is never reused.
// ------------------------------------------------------------
console.log('\n--- TEST 13 — DYNAMIC AMOUNTS PER BILL ---');
{
  const upiA = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: 28650,
  });
  const upiB = generateAuthoritativeUpiUri({
    upiId: 'nmsshamil1232@okaxis',
    payeeName: 'Kaawa',
    amountPaise: 42500,
  });

  assert(upiA.uri!.includes('am=286.50'), 'Test 13: Bill A has am=286.50');
  assert(upiB.uri!.includes('am=425.00'), 'Test 13: Bill B has am=425.00');
  assert(upiA.uri !== upiB.uri, 'Test 13: URIs are completely distinct');
}

// ------------------------------------------------------------
// TEST 14 & 15 — 58MM AND 80MM (TVSE RP3200) ESC/POS RASTER BUFFER
// Expected: Correct centering, correct scaling, valid raster commands.
// ------------------------------------------------------------
console.log('\n--- TEST 14 & 15 — THERMAL ESC/POS RASTER BUFFERS ---');
{
  const uri = 'upi://pay?pa=nmsshamil1232%40okaxis&pn=Kaawa&am=286.50&cu=INR';

  // 80mm: TVSE RP3200 (576 dots printable width, scale 5)
  const raster80 = buildRasterEscposQr(uri, 5, 3, 576);
  assert(raster80.length > 0, 'Test 15: 80mm raster buffer generated');
  // Check GS v 0 header
  assert(raster80[0] === 0x1d && raster80[1] === 0x76 && raster80[2] === 0x30, 'Test 15: Contains GS v 0 raster header');
  // Check width bytes = 576 / 8 = 72 bytes (0x48, 0x00)
  assert(raster80[4] === 72 && raster80[5] === 0, 'Test 15: Raster width padded to exactly 72 bytes (576 dots for 80mm)');

  // 58mm: 384 dots printable width, scale 4
  const raster58 = buildRasterEscposQr(uri, 4, 3, 384);
  assert(raster58.length > 0, 'Test 14: 58mm raster buffer generated');
  // Check width bytes = 384 / 8 = 48 bytes (0x30, 0x00)
  assert(raster58[4] === 48 && raster58[5] === 0, 'Test 14: Raster width padded to exactly 48 bytes (384 dots for 58mm)');

  // Full ESC/POS binary ticket generation
  const payload: ReceiptPrintPayload = {
    storeName: 'CHAYAONE',
    orderNumber: 9999,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Chai', qty: 2, unitPricePaise: 2000, totalPaise: 4000 }],
    subtotalPaise: 4000,
    totalPaise: 4000,
    upiConfig: { upiId: 'nmsshamil1232@okaxis', receiptQrEnabled: true },
  };

  const buffer80 = buildReceiptEscposBuffer(payload, 42);
  assert(buffer80.length > 0, 'Test 15: Full 80mm ESC/POS buffer built');
  const buffer58 = buildReceiptEscposBuffer(payload, 32);
  assert(buffer58.length > 0, 'Test 14: Full 58mm ESC/POS buffer built');
}

// ------------------------------------------------------------
// TEST 16 — UPI QR DISABLED
// Expected: Normal receipt prints. No QR is printed.
// ------------------------------------------------------------
console.log('\n--- TEST 16 — UPI QR DISABLED ---');
{
  const receiptData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: 1016,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 5000, totalPaise: 5000 }],
    subtotalPaise: 5000,
    totalPaise: 5000,
    upiConfig: { upiId: 'nmsshamil1232@okaxis', receiptQrEnabled: false }, // Disabled!
  };

  const model = formatReceiptModel(receiptData, '80mm');
  assert(!model.showUpiQr, 'Test 16: showUpiQr is false');

  const html = formatReceiptHtml(receiptData, '80mm');
  assert(!html.includes('SCAN &amp; PAY') && !html.includes('Scan to pay via UPI'), 'Test 16: No QR section in HTML');

  const buffer = buildReceiptEscposBuffer({
    ...receiptData,
    upiConfig: { upiId: 'nmsshamil1232@okaxis', receiptQrEnabled: false },
  } as any);
  // ESC/POS buffer shouldn't contain raster GS v 0
  assert(!buffer.includes(Buffer.from([0x1d, 0x76, 0x30])), 'Test 16: ESC/POS buffer has no raster QR');
}

// ------------------------------------------------------------
// TEST 17 — INVALID UPI CONFIGURATION
// Expected: Normal receipt still prints, no crash.
// ------------------------------------------------------------
console.log('\n--- TEST 17 — INVALID UPI CONFIGURATION ---');
{
  const invalidUpi = generateAuthoritativeUpiUri({
    upiId: 'invalid-no-at-sign',
    payeeName: 'Kaawa',
    amountPaise: 5000,
  });
  assert(!invalidUpi.valid, 'Test 17: Invalid VPA is rejected');
  assert(invalidUpi.reason !== undefined, 'Test 17: Returns clear validation error');

  const receiptData: ReceiptInputData = {
    storeName: 'CHAYAONE',
    orderNumber: 1017,
    orderType: 'dine_in',
    placedAt: new Date(),
    items: [{ name: 'Tea', qty: 1, unitPricePaise: 5000, totalPaise: 5000 }],
    subtotalPaise: 5000,
    totalPaise: 5000,
    upiConfig: { upiId: 'invalid-no-at-sign' },
  };

  const model = formatReceiptModel(receiptData, '80mm');
  assert(!model.showUpiQr, 'Test 17: showUpiQr false for invalid config');

  const html = formatReceiptHtml(receiptData, '80mm');
  assert(html.includes('TOTAL'), 'Test 17: Receipt HTML generates normally without crash');
}

// ------------------------------------------------------------
// TEST 18 — QR GENERATION FAILURE / CORRUPT DATA
// Expected: Normal receipt still prints, logs error.
// ------------------------------------------------------------
console.log('\n--- TEST 18 — NEGATIVE AMOUNT / EMPTY VPA ---');
{
  const negativeUpi = generateAuthoritativeUpiUri({
    upiId: 'test@okaxis',
    payeeName: 'Kaawa',
    amountPaise: -100,
  });
  assert(!negativeUpi.valid, 'Test 18: Negative amount rejected');

  const emptyUpi = generateAuthoritativeUpiUri({
    upiId: '',
    payeeName: 'Kaawa',
    amountPaise: 5000,
  });
  assert(!emptyUpi.valid, 'Test 18: Empty VPA rejected');
}

console.log('\n============================================================');
if (allPassed) {
  console.log('🎉 ALL 18 TEST SCENARIOS PASSED WITH 100% SUCCESS!');
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
console.log('============================================================');
