/**
 * Cafe OS — Thermal Receipt Printing & Dynamic UPI QR Automated Test Suite
 *
 * Verifies:
 * 1. Authoritative NPCI UPI URI generation & exact amount formatting.
 * 2. Pure offline QR code Data URL & raster bit-image ESC/POS generation.
 * 3. Exact visual layout for both 58mm (32 cols) and 80mm (42 cols) profiles.
 * 4. Table Number + Order Number on the SAME line.
 * 5. Date + Time on the SAME line.
 * 6. Item wrapping without overlapping columns.
 * 7. Indented modifiers & item notes.
 * 8. Subtotal, taxes, discounts, and bold total.
 * 9. Safe reprint & void handling (*** REPRINT ***, *** CANCELLED / VOID ***).
 * 10. Thermal ESC/POS binary buffer construction.
 */

import { formatUpiAmount, generateAuthoritativeUpiUri, readUpiConfig } from '../apps/web/lib/print/upi';
import { generateQrDataUrl, generateQrSvg, buildRasterEscposQr, buildNativeEscposQr } from '../apps/web/lib/print/qr';
import {
  formatReceiptModel,
  wrapText,
  alignLeftRight,
  alignCenter,
  type ReceiptInputData,
} from '../apps/web/lib/print/receipt-formatter';
import { buildReceiptEscposBuffer } from '../apps/web/lib/print/escpos';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    testsFailed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log(' CHAYAONE: PRODUCTION RECEIPT & DYNAMIC UPI QR TEST SUITE');
  console.log('======================================================\n');

  // ── TEST 1: NPCI UPI URI Generation & Exact Amount Formatting ──
  console.log('--- 1. UPI Payment & Exact Amount Formatting ---');
  {
    assert(formatUpiAmount(19000) === '190.00', 'Paise 19000 formats to "190.00"');
    assert(formatUpiAmount(34700) === '347.00', 'Paise 34700 formats to "347.00"');
    assert(formatUpiAmount(125050) === '1250.50', 'Paise 125050 formats to "1250.50"');
    assert(formatUpiAmount(5) === '0.05', 'Paise 5 formats to "0.05"');
    assert(formatUpiAmount(0) === '0.00', 'Paise 0 formats to "0.00"');

    const res190 = generateAuthoritativeUpiUri({
      upiId: 'chayacafe@upi',
      payeeName: 'Chaya Cafe & Bakery',
      amountPaise: 19000,
      transactionRef: 'ORDER-1024',
    });

    assert(res190.valid === true, 'UPI validation succeeds for valid params');
    assert(res190.uri !== null && res190.uri.startsWith('upi://pay?'), 'URI scheme is upi://pay?');
    assert(res190.uri!.includes('pa=chayacafe%40upi') || res190.uri!.includes('pa=chayacafe@upi'), 'Payee VPA is properly encoded');
    assert(res190.uri!.includes('am=190.00'), 'Amount am=190.00 is present');
    assert(res190.uri!.includes('cu=INR'), 'Currency cu=INR is present');
    assert(res190.uri!.includes('tr=ORDER-1024'), 'Transaction reference is present');

    // Edge case: zero or negative amount must reject gracefully
    const resZero = generateAuthoritativeUpiUri({
      upiId: 'chaya@upi',
      payeeName: 'Cafe',
      amountPaise: 0,
    });
    assert(resZero.valid === false && resZero.uri === null, 'Rejects ₹0 bill and returns null URI');

    // Edge case: invalid UPI ID must reject gracefully
    const resInvalid = generateAuthoritativeUpiUri({
      upiId: 'invalid-vpa-no-at-sign',
      payeeName: 'Cafe',
      amountPaise: 10000,
    });
    assert(resInvalid.valid === false && resInvalid.uri === null, 'Rejects UPI ID without @ and returns null URI');
  }

  // ── TEST 2: Offline QR Code Generation & Thermal Raster Engine ──
  console.log('\n--- 2. Offline QR Code Generation & ESC/POS Raster ---');
  {
    const sampleUri = 'upi://pay?pa=chaya@upi&pn=Chaya%20One&am=190.00&cu=INR';

    const dataUrl = await generateQrDataUrl(sampleUri);
    assert(dataUrl.startsWith('data:image/png;base64,'), 'Offline QR Data URL generated as PNG base64');
    assert(dataUrl.length > 500, `Data URL contains valid PNG bytes (length: ${dataUrl.length})`);

    const svgString = await generateQrSvg(sampleUri);
    assert(svgString.includes('<svg') && svgString.includes('</svg>'), 'Offline QR SVG generated cleanly');

    const nativeEscpos = buildNativeEscposQr(sampleUri, 6);
    assert(Buffer.isBuffer(nativeEscpos), 'Native ESC/POS QR returns Buffer');
    assert(nativeEscpos.length > sampleUri.length + 10, 'Native ESC/POS QR contains headers and data commands');

    const rasterEscpos = buildRasterEscposQr(sampleUri, 4);
    assert(Buffer.isBuffer(rasterEscpos), 'Universal GS v 0 raster bit-image returns Buffer');
    assert(rasterEscpos[0] === 0x1d && rasterEscpos[1] === 0x76 && rasterEscpos[2] === 0x30, 'Raster buffer starts with GS v 0 [0x1d, 0x76, 0x30]');
  }

  // ── TEST 3: Text Alignment, Wrapping & Same-Line Rules ──
  console.log('\n--- 3. Thermal Text Formatting & Columnar Rules ---');
  {
    // 58mm (32 chars) same-line table + order
    const line58 = alignLeftRight('Table T05', 'Order #1024', 32);
    assert(line58.length === 32, '58mm same-line Table + Order exactly 32 chars');
    assert(line58.startsWith('Table T05') && line58.endsWith('Order #1024'), '58mm Table on left, Order on right');

    // 80mm (42 chars) same-line table + order
    const line80 = alignLeftRight('TAKEAWAY', 'Order #1024', 42);
    assert(line80.length === 42, '80mm same-line Takeaway + Order exactly 42 chars');
    assert(line80.startsWith('TAKEAWAY') && line80.endsWith('Order #1024'), '80mm Takeaway on left, Order on right');

    // Date & Time on same line
    const dtLine = alignLeftRight('10 Sep 2026', '12:04 PM', 32);
    assert(dtLine.length === 32, 'Date and Time on same line matches column width');
    assert(dtLine.startsWith('10 Sep 2026') && dtLine.endsWith('12:04 PM'), 'Date on left, Time on right');

    // Long item name wrapping without overlapping columns
    const longName = 'Special Masala Dosa with Extra Butter and Podi';
    const wrapped = wrapText(longName, 18);
    assert(wrapped.length > 1, 'Long item name wraps into multiple lines');
    assert(wrapped.every((l) => l.length <= 18), 'Every wrapped line is within maxWidth (18 chars)');
    assert(wrapped.join(' ') === longName, 'No words lost during wrapping');
  }

  // ── TEST 4: Unified Receipt Model Construction (58mm & 80mm) ──
  console.log('\n--- 4. Receipt Visual Hierarchy & Edge Cases ---');
  {
    const sampleReceiptData: ReceiptInputData = {
      storeName: 'Chaya Cafe & Bakery',
      address: '12 80ft Road, Indiranagar, Bengaluru - 560038',
      phone: '+91 98765 43210',
      gstin: '29ABCDE1234F1Z5',
      orderNumber: 1024,
      tableLabel: 'T05',
      orderType: 'dine_in',
      placedAt: '2026-09-10T12:04:00+05:30',
      items: [
        {
          name: 'Classic Cold Brew',
          qty: 2,
          unitPricePaise: 18000,
          totalPaise: 36000,
          modifiers: [{ name: 'Oat Milk', pricePaise: 4000 }],
          notes: 'Less ice please',
        },
        {
          name: 'Almond Croissant',
          qty: 1,
          unitPricePaise: 16000,
          totalPaise: 16000,
        },
      ],
      subtotalPaise: 52000,
      discountPaise: 5000,
      cgstPaise: 1175,
      sgstPaise: 1175,
      roundOffPaise: 50,
      totalPaise: 49400,
      paymentMethod: 'UPI',
      receiptConfig: {
        header: 'Welcome to Chaya One',
        footer: 'Thank you for visiting!',
        phone: '+91 98765 43210',
        showLogo: true,
        showAddress: true,
        showPhone: true,
        showGstin: true,
        showTableNumber: true,
        showOrderNumber: true,
        showDateTime: true,
        showItemNotes: true,
        showTaxDetails: true,
        showDiscount: true,
        showUpiQr: true,
        showScanAndPay: true,
        paperWidth: '80mm',
        qrSize: 'medium',
      },
      upiConfig: {
        upiEnabled: true,
        upiId: 'chayacafe@upi',
        payeeName: 'Chaya Cafe',
        receiptQrEnabled: true,
        receiptQrSize: 'medium',
        showScanAndPayText: true,
      },
    };

    // 80mm model
    const model80 = formatReceiptModel(sampleReceiptData, '80mm');
    assert(model80.paperWidth === '80mm', 'Model resolves 80mm profile');
    assert(model80.charsPerLine === 42, '80mm charsPerLine is 42');
    assert(model80.tableAndOrderRow.includes('Table T05') && model80.tableAndOrderRow.includes('Order #1024'), '80mm Table and Order on same line');
    assert(model80.dateTimeRow.length === 42 && model80.dateTimeRow.includes('2026'), '80mm Date and Time on same line');
    assert(model80.itemLines.length === 2, 'Two items formatted in model');
    assert(model80.itemLines[0]?.extraLines.some((l) => l.includes('Oat Milk')), 'Modifier preserved in item lines');
    assert(model80.itemLines[0]?.extraLines.some((l) => l.includes('Less ice please')), 'Item notes preserved');
    assert(model80.showUpiQr === true, 'Dynamic UPI QR enabled');
    assert(Boolean(model80.upiResult.uri && model80.upiResult.uri.includes('am=494.00')), 'UPI URI has exact bill total ₹494.00');
    assert(Boolean(model80.scanAndPayText?.includes('Scan & Pay') && model80.scanAndPayText?.includes('494')), 'Scan & Pay text formatted correctly');
    assert(model80.brandingText === 'chaya.one', 'Subtle chaya.one branding present');

    // 58mm model
    const model58 = formatReceiptModel(sampleReceiptData, '58mm');
    assert(model58.paperWidth === '58mm', 'Model resolves 58mm profile');
    assert(model58.charsPerLine === 32, '58mm charsPerLine is 32');
    assert(model58.tableAndOrderRow.length === 32, '58mm Table + Order line exactly 32 chars');
    assert(model58.dateTimeRow.length === 32, '58mm Date + Time line exactly 32 chars');
  }

  // ── TEST 5: Reprint & Void Handling ──
  console.log('\n--- 5. Safe Reprint & Void Handling ---');
  {
    const baseData: ReceiptInputData = {
      storeName: 'Chaya Cafe',
      orderNumber: 501,
      orderType: 'takeaway',
      placedAt: '2026-09-10T12:30:00+05:30',
      items: [{ name: 'Espresso', qty: 1, totalPaise: 12000 }],
      subtotalPaise: 12000,
      totalPaise: 12000,
      isReprint: true,
      upiConfig: {
        upiEnabled: true,
        upiId: 'chaya@upi',
        payeeName: 'Cafe',
      },
    };

    const reprintModel = formatReceiptModel(baseData, '58mm');
    assert(reprintModel.isReprint === true, 'Reprint flag recognized');

    const voidData: ReceiptInputData = {
      ...baseData,
      isCancelled: true,
      isReprint: false,
    };
    const voidModel = formatReceiptModel(voidData, '58mm');
    assert(voidModel.isCancelled === true, 'Cancelled flag recognized');
    assert(voidModel.showUpiQr === false, 'Payable UPI QR is omitted on cancelled bills');
  }

  // ── TEST 6: Thermal ESC/POS Binary Buffer Construction ──
  console.log('\n--- 6. ESC/POS Binary Buffer Assembly ---');
  {
    const buffer80 = buildReceiptEscposBuffer({
      storeName: 'Chaya Cafe',
      orderNumber: 1024,
      orderType: 'dine_in',
      tableLabel: 'T05',
      placedAt: new Date(),
      items: [
        {
          name: 'South Indian Filter Coffee with Extra Froth',
          qty: 2,
          unitPricePaise: 5000,
          totalPaise: 10000,
        },
      ],
      subtotalPaise: 10000,
      totalPaise: 10000,
      paperWidth: '80mm',
      upiConfig: {
        upiEnabled: true,
        upiId: 'chayacafe@upi',
        payeeName: 'Chaya Cafe',
        receiptQrEnabled: true,
      },
    });

    assert(Buffer.isBuffer(buffer80), 'ESC/POS 80mm receipt produces binary Buffer');
    assert(buffer80.length > 200, `ESC/POS buffer size (${buffer80.length} bytes) is non-empty and valid`);

    // Verify ESC/POS commands: Init (0x1B 0x40), GS v 0 (0x1D 0x76 0x30), Cut (0x1D 0x56)
    const hasInit = buffer80[0] === 0x1b && buffer80[1] === 0x40;
    assert(hasInit, 'ESC/POS buffer starts with INIT (ESC @)');

    let hasRasterQr = false;
    for (let i = 0; i < buffer80.length - 3; i++) {
      if (buffer80[i] === 0x1d && buffer80[i + 1] === 0x76 && buffer80[i + 2] === 0x30) {
        hasRasterQr = true;
        break;
      }
    }
    assert(hasRasterQr, 'ESC/POS buffer embeds GS v 0 raster bit-image for dynamic UPI QR');

    const lastCutIdx = buffer80.lastIndexOf(0x1d);
    const hasCut = lastCutIdx !== -1 && buffer80[lastCutIdx + 1] === 0x56;
    assert(hasCut, 'ESC/POS buffer ends with paper CUT command (GS V)');

    // 58mm buffer
    const buffer58 = buildReceiptEscposBuffer(
      {
        storeName: 'Chaya Express',
        orderNumber: 99,
        orderType: 'takeaway',
        placedAt: new Date(),
        items: [{ name: 'Tea', qty: 1, totalPaise: 2000 }],
        subtotalPaise: 2000,
        totalPaise: 2000,
        paperWidth: '58mm',
      },
      32
    );
    assert(Buffer.isBuffer(buffer58), 'ESC/POS 58mm receipt produces valid Buffer');
  }

  console.log('\n======================================================');
  console.log(` TEST RUN SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
