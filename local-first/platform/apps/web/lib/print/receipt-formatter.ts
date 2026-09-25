/**
 * Cafe OS — Shared Receipt Formatter & Thermal Layout Engine
 *
 * Implements the single source of truth for receipt layout across:
 * 1. Physical ESC/POS thermal printing (58mm & 80mm).
 * 2. Visual Receipt Preview modal in the cashier/waiter interface.
 *
 * Guaranteed consistent formatting:
 * - Table Number & Order Number on the SAME line.
 * - Date & Time on the SAME line (timezone respected).
 * - Exact columnar alignment with item wrapping.
 * - Modifiers & Notes cleanly indented.
 * - Subtotal, Taxes, Discounts (only shown when non-zero).
 * - Dynamic UPI QR code with exact finalized bill total.
 * - Subtle chaya.one branding at the bottom.
 */

import { formatINR } from '@cafeos/core';
import type { ReceiptConfig, ReceiptPaperWidth } from '../receipt';
import { generateAuthoritativeUpiUri, type UpiPaymentConfig, type UpiValidationResult } from './upi';
import { generateQrSvgSync } from './qr';

export interface ReceiptItemLine {
  name: string;
  qty: number;
  pricePaise?: number;
  unitPricePaise?: number;
  totalPaise: number;
  modifiers?: Array<{ name: string; pricePaise?: number }>;
  notes?: string | null;
}

export interface ReceiptInputData {
  storeName: string;
  logoUrl?: string | null;
  address?: { line1?: string; city?: string; pincode?: string } | string | null;
  phone?: string | null;
  gstin?: string | null;
  timezone?: string;

  orderNumber: number | string;
  tableLabel?: string | null;
  orderType?: 'dine_in' | 'takeaway' | 'delivery' | string;
  placedAt?: Date | string;
  settledAt?: Date | string | null;
  cashierName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;

  items: ReceiptItemLine[];

  subtotalPaise: number;
  discountPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  serviceChargePaise?: number;
  deliveryChargePaise?: number;
  packagingChargePaise?: number;
  convenienceFeePaise?: number;
  roundOffPaise?: number;
  totalPaise: number;

  /** Authoritative single source of truth: whether GST is active for this bill */
  gstEnabled?: boolean;

  paymentMethod?: string | null;
  isReprint?: boolean;
  isCancelled?: boolean;

  receiptConfig?: Partial<ReceiptConfig>;
  upiConfig?: Partial<UpiPaymentConfig>;
}

export interface FormattedReceiptModel {
  paperWidth: ReceiptPaperWidth;
  charsPerLine: number;
  isReprint: boolean;
  isCancelled: boolean;
  isGstActive: boolean;

  // Header lines
  logoUrl: string | null;
  storeName: string;
  headerNote?: string | null;
  addressText?: string | null;
  contactLine?: string | null; // e.g. "9876543210 • GSTIN: 32XXXXX" or separate

  // Meta rows (same line)
  tableAndOrderRow: string;
  dateTimeRow: string;
  cashierLine?: string | null;
  customerLine?: string | null;

  // Items
  itemLines: Array<{
    name: string;
    qtyText: string;
    amountText: string;
    extraLines: string[]; // wrapped item names, modifiers (+ Cheese ₹20), notes
  }>;

  // Financial summary
  subtotalText: string;
  discountText: string | null;
  taxBreakdown: Array<{ label: string; amountText: string }>;
  serviceChargeText?: string | null;
  roundOffText: string | null;
  totalText: string;
  totalPaise: number;

  // UPI QR
  upiResult: UpiValidationResult;
  showUpiQr: boolean;
  showScanAndPay: boolean;
  scanAndPayText: string | null;

  // Footer
  footerNote?: string | null;
  brandingText: string;
}

/**
 * Format a row with text on the far left and far right.
 */
export function alignLeftRight(left: string, right: string, width: number): string {
  const l = (left || '').trim();
  const r = (right || '').trim();
  if (!r) return l.slice(0, width);
  if (!l) return r.padStart(width, ' ');

  const spaceCount = width - l.length - r.length;
  if (spaceCount >= 1) {
    return l + ' '.repeat(spaceCount) + r;
  }
  // If text is too wide, truncate left side
  const availableLeft = Math.max(1, width - r.length - 1);
  return l.slice(0, availableLeft) + ' ' + r;
}

/**
 * Center text within a given column width.
 */
export function alignCenter(text: string, width: number): string {
  const t = (text || '').trim();
  if (t.length >= width) return t.slice(0, width);
  const leftPad = Math.floor((width - t.length) / 2);
  const rightPad = width - t.length - leftPad;
  return ' '.repeat(leftPad) + t + ' '.repeat(rightPad);
}

/**
 * Wrap text into lines of at most maxWidth characters.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

/**
 * Format date and time according to Indian cafe standard (or specified timezone).
 * Output: "10 Sep 2026               12:04 PM"
 */
export function formatReceiptDateTime(dateInput: Date | string, timezone = 'Asia/Kolkata'): { dateStr: string; timeStr: string } {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return {
      dateStr: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: timezone }),
      timeStr: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone }),
    };
  }

  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: timezone });
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone });
  return { dateStr, timeStr };
}

/**
 * Build the unified receipt model used by both ESC/POS printing and Web preview.
 */
export function formatReceiptModel(data: ReceiptInputData, requestedWidth?: ReceiptPaperWidth): FormattedReceiptModel {
  const paperWidth: ReceiptPaperWidth = requestedWidth || data.receiptConfig?.paperWidth || '80mm';
  // Standard thermal printable characters: 32 chars for 58mm, 42 chars for 80mm
  const charsPerLine = paperWidth === '58mm' ? 32 : 42;

  // 1. Authoritative GST State
  const hadHistoricalTax = (data.cgstPaise ?? 0) > 0 || (data.sgstPaise ?? 0) > 0 || (data.igstPaise ?? 0) > 0;
  const isGstActive = data.gstEnabled !== undefined ? Boolean(data.gstEnabled) : hadHistoricalTax;
  console.log(`[RECEIPT] GST section: ${isGstActive ? 'displayed' : 'hidden'}`);

  const timezone = data.timezone || 'Asia/Kolkata';
  const { dateStr, timeStr } = formatReceiptDateTime(data.placedAt || new Date(), timezone);

  // Where / Order Type
  let whereText = '';
  const orderType = (data.orderType || '').toLowerCase();
  if (orderType === 'takeaway') {
    whereText = 'TAKEAWAY';
  } else if (orderType === 'delivery') {
    whereText = 'DELIVERY';
  } else {
    whereText = data.tableLabel ? `Table ${data.tableLabel}` : 'Table';
  }

  const orderNumText = `Order #${data.orderNumber}`;
  const tableAndOrderRow = alignLeftRight(whereText, orderNumText, charsPerLine);
  const dateTimeRow = alignLeftRight(dateStr, timeStr, charsPerLine);

  const cashierLine = data.cashierName ? `Cashier: ${data.cashierName}` : null;
  const customerLine = data.customerName || data.customerPhone
    ? `Customer: ${[data.customerName, data.customerPhone].filter(Boolean).join(' · ')}`
    : null;

  // 2. Address & Contact header
  let addressText: string | null = null;
  if (data.receiptConfig?.showAddress !== false && data.address) {
    if (typeof data.address === 'string') {
      addressText = data.address.trim();
    } else if (typeof data.address === 'object') {
      const parts = [data.address.line1, data.address.city, data.address.pincode].filter(Boolean);
      if (parts.length > 0) addressText = parts.join(', ');
    }
  }

  const contactParts: string[] = [];
  if (data.receiptConfig?.showPhone !== false && data.phone) {
    contactParts.push(data.phone.trim());
  }
  // Only show GSTIN when GST is actively enabled!
  if (isGstActive && data.receiptConfig?.showGstin !== false && data.gstin) {
    contactParts.push(`GSTIN: ${data.gstin.trim()}`);
  }
  const contactLine = contactParts.length > 0 ? contactParts.join(' • ') : null;

  // 3. Item Column widths
  // 58mm (32 chars): QTY=3, AMOUNT=7, ITEM=20
  // 80mm (42 chars): QTY=4, AMOUNT=9, ITEM=27
  const qtyColWidth = paperWidth === '58mm' ? 3 : 4;
  const amtColWidth = paperWidth === '58mm' ? 7 : 9;
  const itemColWidth = charsPerLine - qtyColWidth - amtColWidth - 2;

  const itemLines: FormattedReceiptModel['itemLines'] = [];

  for (const item of data.items) {
    const qtyText = String(item.qty).padStart(qtyColWidth, ' ');
    const amtText = formatINR(item.totalPaise).padStart(amtColWidth, ' ');

    const nameLines = wrapText(item.name, itemColWidth);
    const firstNameLine = nameLines[0] || item.name;
    const remainingNameLines = nameLines.slice(1);

    const extraLines: string[] = [];

    // Additional wrapped item name lines
    for (const line of remainingNameLines) {
      extraLines.push(line);
    }

    // Modifiers: "  + Cheese               ₹20"
    if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modPrice = mod.pricePaise !== undefined && mod.pricePaise > 0 ? formatINR(mod.pricePaise) : '';
        const modText = `  + ${mod.name}`;
        if (modPrice) {
          extraLines.push(alignLeftRight(modText, modPrice, charsPerLine));
        } else {
          extraLines.push(modText);
        }
      }
    }

    // Notes
    if (data.receiptConfig?.showItemNotes && item.notes) {
      extraLines.push(`  Note: ${item.notes}`);
    }

    itemLines.push({
      name: firstNameLine,
      qtyText,
      amountText: amtText,
      extraLines,
    });
  }

  // 4. Financial Calculations & Breakdown
  const subtotalText = formatINR(data.subtotalPaise);
  const discountText =
    (data.receiptConfig?.showDiscount !== false) && data.discountPaise && data.discountPaise > 0
      ? `-${formatINR(data.discountPaise)}`
      : null;

  // Only display tax details if GST is active AND showTaxDetails is enabled
  const taxBreakdown: Array<{ label: string; amountText: string }> = [];
  if (isGstActive && data.receiptConfig?.showTaxDetails !== false) {
    if (data.cgstPaise && data.cgstPaise > 0) {
      taxBreakdown.push({ label: 'CGST', amountText: formatINR(data.cgstPaise) });
    }
    if (data.sgstPaise && data.sgstPaise > 0) {
      taxBreakdown.push({ label: 'SGST', amountText: formatINR(data.sgstPaise) });
    }
    if (data.igstPaise && data.igstPaise > 0) {
      taxBreakdown.push({ label: 'IGST', amountText: formatINR(data.igstPaise) });
    }
  }

  const serviceChargeText = data.serviceChargePaise && data.serviceChargePaise > 0 ? formatINR(data.serviceChargePaise) : null;
  const roundOffText = data.roundOffPaise ? formatINR(data.roundOffPaise) : null;
  const totalText = formatINR(data.totalPaise);

  // 5. Authoritative UPI QR Code
  const upiId = (data.upiConfig?.upiId || '').trim();
  const upiBusinessName = (data.upiConfig?.upiBusinessName || data.storeName || 'Chaya Cafe').trim();
  const upiEnabled = (data.upiConfig?.upiEnabled !== false) && (upiId.length > 0);
  const receiptQrEnabled = (data.upiConfig?.receiptQrEnabled !== false) && (data.receiptConfig?.showUpiQr !== false);

  const upiResult = generateAuthoritativeUpiUri({
    upiId,
    businessName: upiBusinessName,
    amountPaise: data.totalPaise,
    isCancelled: !!data.isCancelled,
  });

  const showUpiQr = upiEnabled && receiptQrEnabled && upiResult.valid;
  const showScanAndPay = (data.upiConfig?.showScanAndPayText !== false) && (data.receiptConfig?.showScanAndPay !== false);
  const scanAndPayText =
    showUpiQr && showScanAndPay
      ? `Scan & Pay ${formatINR(data.totalPaise)}`
      : null;

  return {
    paperWidth,
    charsPerLine,
    isReprint: !!data.isReprint,
    isCancelled: !!data.isCancelled,
    isGstActive,

    logoUrl: data.receiptConfig?.showLogo !== false ? (data.logoUrl || null) : null,
    storeName: (data.storeName || 'CHAYA CAFE').toUpperCase(),
    headerNote: data.receiptConfig?.header || null,
    addressText,
    contactLine,

    tableAndOrderRow,
    dateTimeRow,
    cashierLine,
    customerLine,

    itemLines,

    subtotalText,
    discountText,
    taxBreakdown,
    serviceChargeText,
    roundOffText,
    totalText,
    totalPaise: data.totalPaise,

    upiResult,
    showUpiQr,
    showScanAndPay,
    scanAndPayText,

    footerNote: data.receiptConfig?.footer || null,
    brandingText: 'chaya.one',
  };
}

/**
 * Format a complete, self-contained HTML thermal receipt document.
 * Universal across browser print dialog (iframe) and web preview.
 * Includes dynamic UPI QR code rendered as crisp inline SVG.
 */
export function formatReceiptHtml(data: ReceiptInputData, requestedWidth?: ReceiptPaperWidth): string {
  const is58 = requestedWidth === '58mm' || data.receiptConfig?.paperWidth === '58mm';
  const paperWidth: ReceiptPaperWidth = is58 ? '58mm' : '80mm';
  const model = formatReceiptModel(data, paperWidth);

  const esc = (s: string) =>
    s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));

  const docTitle = model.isGstActive ? 'TAX INVOICE' : 'INVOICE';
  const widthMm = is58 ? '48mm' : '72mm';
  const pageSizeMm = is58 ? '58mm' : '80mm';
  const qrPixelSize = is58 ? 120 : 150;

  // Build items rows
  const itemRowsHtml = model.itemLines.map((line) => {
    const extraHtml = line.extraLines.length > 0
      ? `<div style="font-size:8.5pt;color:#444;padding-left:6pt;">${line.extraLines.map(esc).join('<br/>')}</div>`
      : '';
    return `
      <div style="display:flex;justify-content:space-between;padding:1.5pt 0;align-items:flex-start;">
        <div style="flex:1;word-break:break-word;padding-right:4pt;">${esc(line.name)}${extraHtml}</div>
        <div style="width:24pt;text-align:center;">${line.qtyText.trim()}</div>
        <div style="min-width:44pt;text-align:right;font-weight:600;">${line.amountText.trim()}</div>
      </div>
    `;
  }).join('');

  // Tax breakdown rows
  const taxRowsHtml = model.taxBreakdown.map((t) => `
    <div style="display:flex;justify-content:space-between;padding:1pt 0;">
      <span>${esc(t.label)}</span>
      <span>${esc(t.amountText)}</span>
    </div>
  `).join('');

  // Dynamic QR Code SVG
  let qrSectionHtml = '';
  if (model.showUpiQr && model.upiResult.uri) {
    const qrSvg = generateQrSvgSync(model.upiResult.uri, { size: qrPixelSize, margin: 2 });
    qrSectionHtml = `
      <div style="border-top:1px dashed #000;margin:6pt 0;"></div>
      <div style="text-align:center;margin:6pt 0 4pt;">
        ${model.showScanAndPay ? '<div style="font-weight:700;font-size:10pt;letter-spacing:1px;margin-bottom:4pt;">SCAN & PAY</div>' : ''}
        <div style="display:flex;justify-content:center;margin:4pt 0;">
          ${qrSvg}
        </div>
        ${model.showScanAndPay ? `
          <div style="font-weight:800;font-size:11pt;margin-top:4pt;">${model.totalText}</div>
          <div style="font-size:8.5pt;color:#333;margin-top:2pt;">Scan to pay via UPI</div>
        ` : ''}
      </div>
      <div style="border-top:1px dashed #000;margin:6pt 0;"></div>
    `;
  }

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>${esc(docTitle)} - ${esc(String(data.orderNumber))}</title>
<style>
  @page {
    size: ${pageSizeMm} auto;
    margin: 3mm 4mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    width: ${widthMm};
    font-family: 'Courier New', Courier, 'Lucida Console', monospace;
    font-size: ${is58 ? '9.5pt' : '10.5pt'};
    line-height: 1.35;
    color: #000;
    background: #fff;
    margin: 0 auto;
  }
  .receipt { width: 100%; padding: 0; }
  .store-name { text-align: center; font-size: ${is58 ? '13pt' : '15pt'}; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2pt; }
  .store-sub { text-align: center; font-size: 8.5pt; color: #222; margin-bottom: 1pt; }
  .doc-title { text-align: center; font-size: 9.5pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 3pt 0 2pt; }
  .div-solid  { border-top: 1.5px solid #000; margin: 3pt 0; }
  .div-dashed { border-top: 1px dashed #000; margin: 3pt 0; }
  .meta-row { display: flex; justify-content: space-between; font-size: 8.5pt; line-height: 1.3; }
  .meta-row.bold { font-weight: 700; font-size: 9pt; }
  .items-hdr { display: flex; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; padding-bottom: 2pt; border-bottom: 1px dashed #000; margin-bottom: 2pt; }
  .totals-row { display: flex; justify-content: space-between; font-size: 9.5pt; line-height: 1.35; padding: 1pt 0; }
  .totals-row.grand { font-size: ${is58 ? '12pt' : '13pt'}; font-weight: 900; margin: 2pt 0; }
  .totals-row.discount { color: #1a7a1a; }
  .footer { text-align: center; font-size: 8.5pt; color: #333; margin-top: 6pt; line-height: 1.4; }
  .footer .thank-you { font-size: 10pt; font-weight: 700; color: #000; margin-bottom: 2pt; }
  .logo-wrap { text-align: center; margin-bottom: 3pt; }
  .logo-wrap img { max-height: 14mm; max-width: 40mm; object-fit: contain; }
  @media screen {
    body { background: #f5f5f5; padding: 8px; }
    .receipt { background: #fff; padding: 8px; box-shadow: 0 0 12px rgba(0,0,0,0.15); }
  }
</style>
</head><body>
<div class="receipt">
  ${model.isReprint ? '<div style="text-align:center;font-weight:700;font-size:9.5pt;border:1px solid #000;padding:2pt;margin-bottom:4pt;">*** REPRINT ***</div>' : ''}
  ${model.isCancelled ? '<div style="text-align:center;font-weight:700;font-size:11pt;border:1.5px solid #000;padding:3pt;margin-bottom:4pt;">*** CANCELLED / VOID ***</div>' : ''}
  ${model.logoUrl ? `<div class="logo-wrap"><img src="${esc(model.logoUrl)}" alt="Logo"/></div>` : ''}
  <div class="store-name">${esc(model.storeName)}</div>
  ${model.addressText ? `<div class="store-sub">${esc(model.addressText)}</div>` : ''}
  ${model.contactLine ? `<div class="store-sub">${esc(model.contactLine)}</div>` : ''}
  ${model.headerNote ? `<div class="store-sub">${esc(model.headerNote)}</div>` : ''}
  <div class="doc-title">${esc(docTitle)}</div>

  <div class="div-dashed"></div>
  <div class="meta-row bold">
    <span>${esc(model.tableAndOrderRow.split(/\s{2,}/)[0] || '')}</span>
    <span>${esc(model.tableAndOrderRow.split(/\s{2,}/)[1] || '')}</span>
  </div>
  <div class="meta-row">
    <span>${esc(model.dateTimeRow.split(/\s{2,}/)[0] || '')}</span>
    <span>${esc(model.dateTimeRow.split(/\s{2,}/)[1] || '')}</span>
  </div>
  ${model.cashierLine ? `<div class="meta-row"><span>${esc(model.cashierLine)}</span></div>` : ''}
  ${model.customerLine ? `<div class="meta-row"><span>${esc(model.customerLine)}</span></div>` : ''}

  <div class="div-solid"></div>
  <div class="items-hdr">
    <div style="flex:1;">ITEM</div>
    <div style="width:24pt;text-align:center;">QTY</div>
    <div style="min-width:44pt;text-align:right;">AMOUNT</div>
  </div>
  ${itemRowsHtml}

  <div class="div-solid"></div>
  <div class="totals-row">
    <span>Subtotal</span>
    <span>${model.subtotalText}</span>
  </div>
  ${model.discountText ? `<div class="totals-row discount"><span>Discount</span><span>${model.discountText}</span></div>` : ''}
  ${taxRowsHtml}
  ${model.serviceChargeText ? `<div class="totals-row"><span>Service Charge</span><span>${model.serviceChargeText}</span></div>` : ''}
  ${model.roundOffText ? `<div class="totals-row"><span>Round Off</span><span>${model.roundOffText}</span></div>` : ''}

  <div class="div-solid"></div>
  <div class="totals-row grand">
    <span>TOTAL</span>
    <span>${model.totalText}</span>
  </div>
  <div class="div-solid"></div>

  ${data.paymentMethod ? `
    <div class="totals-row" style="margin:2pt 0;font-weight:700;">
      <span>Payment</span>
      <span>${esc(data.paymentMethod.toUpperCase())}</span>
    </div>
  ` : ''}

  ${qrSectionHtml}

  <div class="footer">
    <div class="thank-you">${model.footerNote ? esc(model.footerNote) : 'Thank you! Visit again.'}</div>
    <div style="font-size:8pt;color:#666;">${esc(model.brandingText)}</div>
  </div>
</div>
<script>
  window.onload = function() {
    window.print();
  };
</script>
</body></html>`;

  return html;
}
