import { formatReceiptModel, formatReceiptHtml, type ReceiptInputData, formatReceiptAddress } from './lib/print/receipt-formatter';
import { readReceiptConfig } from './lib/receipt';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✓ ${msg}`);
  }
}

console.log('============================================================');
console.log('DYNAMIC BILLING CONFIGURATION VALIDATION SUITE');
console.log('============================================================\n');

// 1. Address Formatter Robustness
console.log('--- 1. Address Formatter Tests ---');
{
  assert(formatReceiptAddress(null) === null, 'Address null returns null');
  assert(formatReceiptAddress(' 123 Beach Road, Alappuzha ') === '123 Beach Road, Alappuzha', 'String address trimmed');
  
  const obj1 = { line1: 'Shop #4, Metro Pillar 32', city: 'Kochi', stateCode: 'KL', pincode: '682016' };
  assert(formatReceiptAddress(obj1) === 'Shop #4, Metro Pillar 32, Kochi, KL - 682016', 'Object address with stateCode & pincode formatted properly');

  const obj2 = { street: '45 MG Road', line2: '2nd Floor', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' };
  assert(formatReceiptAddress(obj2) === '45 MG Road, 2nd Floor, Bengaluru, Karnataka - 560001', 'Object with street, line2, state, postalCode formatted properly');
}

// 2. Billing Configuration Dynamic Toggles
console.log('\n--- 2. Billing Configuration Dynamic Visibility Toggles ---');
{
  const baseData: ReceiptInputData = {
    storeName: 'CHAYA CAFE',
    logoUrl: 'https://example.com/logo.png',
    address: { line1: 'Shop 12, Food Court', city: 'Calicut', pincode: '673001' },
    phone: '9876543210',
    gstin: '32AABCU9603R1ZM',
    header: 'Best Tea in Town!\nFreshly Brewed Every Day',
    footer: 'Thank you for your visit.\nPlease visit again!',
    orderNumber: 42,
    tableLabel: 'T-05',
    orderType: 'dine_in',
    placedAt: new Date('2026-09-27T14:30:00Z'),
    items: [
      {
        name: 'Special Masala Chai',
        qty: 2,
        unitPricePaise: 3000,
        totalPaise: 6000,
        modifiers: [{ name: 'Extra Ginger', pricePaise: 500 }],
        notes: 'Less sugar please',
      },
    ],
    subtotalPaise: 6500,
    discountPaise: 500,
    cgstPaise: 150,
    sgstPaise: 150,
    roundOffPaise: 0,
    totalPaise: 6300,
    gstEnabled: true,
    receiptConfig: {
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
      invoicePrefix: 'CHY-',
      invoiceNumberLength: 6,
    },
    upiConfig: {
      upiId: 'chayaone@okhdfcbank',
      upiBusinessName: 'Chaya Cafe',
      receiptQrEnabled: true,
      upiEnabled: true,
    },
  };

  // Run with ALL options ON
  const modelAllOn = formatReceiptModel(baseData, '80mm');
  const htmlAllOn = formatReceiptHtml(baseData, '80mm');

  assert(htmlAllOn.includes('logo-wrap'), 'Logo is rendered when showLogo: true');
  assert(htmlAllOn.includes('CHAYA CAFE'), 'Store name is rendered even when logo is on');
  assert(htmlAllOn.includes('Shop 12, Food Court, Calicut, 673001'), 'Address is rendered');
  assert(htmlAllOn.includes('Tel: 9876543210'), 'Phone is rendered');
  assert(htmlAllOn.includes('GSTIN: 32AABCU9603R1ZM'), 'GSTIN is rendered');
  assert(htmlAllOn.includes('TAX INVOICE'), 'TAX INVOICE header rendered for GST active bill');
  assert(htmlAllOn.includes('CHY-000042'), 'Invoice prefix & 6-digit padding applied to order number');
  assert(htmlAllOn.includes('TABLE: T-05'), 'Table number rendered');
  assert(htmlAllOn.includes('Extra Ginger'), 'Modifier rendered when showItemNotes: true');
  assert(htmlAllOn.includes('Less sugar please'), 'Item note rendered when showItemNotes: true');
  assert(htmlAllOn.includes('CGST') && htmlAllOn.includes('SGST'), 'Tax breakdown rendered');
  assert(htmlAllOn.includes('Discount:'), 'Discount line rendered');
  assert(htmlAllOn.includes('qr-section') && htmlAllOn.includes('<svg'), 'Dynamic UPI QR rendered');
  assert(htmlAllOn.includes('SCAN &amp; PAY') || htmlAllOn.includes('SCAN & PAY'), 'Scan & Pay caption rendered');
  assert(htmlAllOn.includes('Best Tea in Town!'), 'Multiline header note rendered');
  assert(htmlAllOn.includes('Please visit again!'), 'Multiline footer note rendered');

  // Run with toggles OFF
  const dataAllOff: ReceiptInputData = {
    ...baseData,
    receiptConfig: {
      showLogo: false,
      showAddress: false,
      showPhone: false,
      showGstin: false,
      showTableNumber: false,
      showOrderNumber: false,
      showDateTime: false,
      showItemNotes: false,
      showTaxDetails: false,
      showDiscount: false,
      showUpiQr: false,
      showScanAndPay: false,
      paperWidth: '80mm',
    },
  };

  const modelAllOff = formatReceiptModel(dataAllOff, '80mm');
  const htmlAllOff = formatReceiptHtml(dataAllOff, '80mm');

  assert(!htmlAllOff.includes('<div class="logo-wrap">'), 'Logo div is hidden when showLogo: false');
  assert(htmlAllOff.includes('CHAYA CAFE'), 'Store name still rendered when logo is off');
  assert(!htmlAllOff.includes('Shop 12, Food Court'), 'Address is hidden when showAddress: false');
  assert(!htmlAllOff.includes('Tel: 9876543210'), 'Phone is hidden when showPhone: false');
  assert(!htmlAllOff.includes('GSTIN:'), 'GSTIN is hidden when showGstin: false');
  assert(!htmlAllOff.includes('TABLE: T-05'), 'Table number hidden when showTableNumber: false');
  assert(!htmlAllOff.includes('ORDER #'), 'Order number hidden when showOrderNumber: false');
  assert(!htmlAllOff.includes('Extra Ginger'), 'Modifier hidden when showItemNotes: false');
  assert(!htmlAllOff.includes('Less sugar please'), 'Item note hidden when showItemNotes: false');
  assert(!htmlAllOff.includes('CGST') && !htmlAllOff.includes('SGST'), 'Tax breakdown hidden when showTaxDetails: false');
  assert(!htmlAllOff.includes('Discount:'), 'Discount line hidden when showDiscount: false');
  assert(!htmlAllOff.includes('<div class="qr-section">'), 'UPI QR div hidden when showUpiQr: false');
}

// 3. Compact 58mm Paper Profile
console.log('\n--- 3. 58mm Paper Profile Verification ---');
{
  const data58: ReceiptInputData = {
    storeName: 'CHAYA CAFE 58MM',
    orderNumber: 123,
    orderType: 'takeaway',
    placedAt: new Date(),
    items: [{ name: 'Espresso Single Shot Hot', qty: 1, unitPricePaise: 8000, totalPaise: 8000 }],
    subtotalPaise: 8000,
    totalPaise: 8000,
    receiptConfig: { paperWidth: '58mm' },
  };

  const model58 = formatReceiptModel(data58, '58mm');
  assert(model58.paperWidth === '58mm', 'Model paperWidth is 58mm');
  assert(model58.charsPerLine === 32, 'Model charsPerLine is 32 for 58mm');

  const html58 = formatReceiptHtml(data58, '58mm');
  assert(html58.includes('width: 48mm'), '58mm HTML uses 48mm print width');
}

console.log('\n============================================================');
console.log('🎉 ALL DYNAMIC BILLING CONFIGURATION TESTS PASSED!');
console.log('============================================================');
