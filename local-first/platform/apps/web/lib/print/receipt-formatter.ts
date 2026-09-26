/**
 * Cafe OS — Shared Receipt Formatter & Thermal Layout Engine
 *
 * Single source of truth for the final CUSTOMER BILLING RECEIPT across:
 * 1. Physical ESC/POS thermal printing (80mm standard & 58mm compact).
 * 2. Visual Receipt Preview modal in cashier/waiter/t-billing interface.
 * 3. Browser print dialog (hidden iframe to Windows thermal printer spooler).
 *
 * Layout & Typography Hierarchy (Standard 80mm POS Thermal Receipt):
 * - Business Logo: Centered at top, max width 50mm, max height 22mm, aspect ratio preserved.
 * - Business Name: Small/normal typography below logo (10pt bold), normal standard font without logo (11.5pt).
 * - Business Details: Address, Phone, GSTIN (only when GST enabled) in 8.5pt.
 * - Compact Metadata: TABLE and ORDER # on line 1, DATE and TIME (12h AM/PM) on line 2 (9pt).
 * - Columns: ITEM (left), QTY (center), AMOUNT (right-aligned to identical margin).
 * - Currency: Standard 2-decimal formatting (₹240.00 / Rs. 240.00). Thermal printer-safe, zero corruption.
 * - Totals: Subtotal, Discount, Tax (only when GST is active), Round Off, TOTAL (12pt bold).
 * - GST Conditional: Completely shrinks when GST is OFF (no empty rows or spaces).
 * - Dynamic UPI QR: Centered SVG, SCAN & PAY, exact bill total, "Scan to pay via UPI".
 * - Footer: Thank you message & subtle chaya.one branding.
 *
 * NOTE: DO NOT MODIFY KOT PRINTING. KOT IS MAINTAINED SEPARATELY.
 */

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
  header?: string | null;
  footer?: string | null;
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
  hasLogo: boolean;
  logoUrl: string | null;
  storeName: string;
  headerNote?: string | null;
  addressText?: string | null;
  phone?: string | null;
  gstin?: string | null;
  contactLine?: string | null;

  // Meta rows
  tableText: string;
  orderText: string;
  dateText: string;
  timeText: string;
  tableAndOrderRow: string;
  dateTimeRow: string;
  cashierLine?: string | null;
  customerLine?: string | null;

  // Items
  itemLines: Array<{
    name: string;
    qty: number;
    qtyText: string;
    amountText: string;
    extraLines: string[];
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

export interface FormatReceiptOptions {
  /** If true, format currency with 'Rs. ' instead of '₹' (safe for ESC/POS binary buffers) */
  useRsFallback?: boolean;
  /** Auto-launch browser print dialog in HTML */
  autoPrint?: boolean;
}

/**
 * Thermal-printer-safe currency formatter.
 * Always formats with standard 2 decimal places (e.g. ₹240.00, ₹0.00).
 * Prevents character encoding corruption such as "Γé╣240" or "â‚¹240".
 */
export function formatReceiptMoney(paise: number, options?: { useRsFallback?: boolean }): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise || 0);
  const rupees = absPaise / 100;
  const numStr = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = options?.useRsFallback ? 'Rs. ' : '₹';
  return (isNegative ? '-' : '') + prefix + numStr;
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
  const words = (text || '').split(/\s+/).filter(Boolean);
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
 * Format date and time according to Indian standard thermal receipt format.
 * Date: 25 Sep 2026
 * Time: 02:36 PM (12-hour format with AM/PM)
 */
export function formatReceiptDateTime(
  dateInput?: Date | string | null,
  timezone = 'Asia/Kolkata'
): { dateStr: string; timeStr: string } {
  let d: Date;
  if (!dateInput) {
    d = new Date();
  } else if (dateInput instanceof Date) {
    d = isNaN(dateInput.getTime()) ? new Date() : dateInput;
  } else {
    d = new Date(dateInput);
    if (isNaN(d.getTime())) d = new Date();
  }

  // 25 Sep 2026
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.toLocaleDateString('en-GB', { day: '2-digit', timeZone: timezone });
  const monthNum = parseInt(d.toLocaleDateString('en-US', { month: 'numeric', timeZone: timezone }), 10);
  const month = MONTH_NAMES[monthNum - 1] || 'Jan';
  const year = d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: timezone });
  const dateStr = `${day} ${month} ${year}`;

  // 02:36 PM
  const timeRaw = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
  const timeStr = timeRaw.replace(/[\u2000-\u206F\u00A0]/g, ' ').trim();

  return { dateStr, timeStr };
}

/**
 * Format 3-column receipt row (ITEM left, QTY center, AMOUNT right) in fixed-width monospace.
 */
export function formatItemRowMono(name: string, qty: number, amtText: string, width = 42): string {
  const qtyColWidth = width === 32 ? 4 : 5;
  const amtColWidth = width === 32 ? 10 : 12;
  const itemColWidth = width - qtyColWidth - amtColWidth - 1;

  const nameLines = wrapText(name.trim(), itemColWidth);
  const firstName = (nameLines[0] || '').padEnd(itemColWidth, ' ');

  const qtyStr = String(qty);
  const leftPad = Math.floor((qtyColWidth - qtyStr.length) / 2);
  const qtyCentered = ' '.repeat(Math.max(0, leftPad)) + qtyStr + ' '.repeat(Math.max(0, qtyColWidth - qtyStr.length - leftPad));
  const amtRight = amtText.padStart(amtColWidth, ' ');

  return `${firstName} ${qtyCentered}${amtRight}`;
}

/**
 * Build the single authoritative receipt model used by both ESC/POS printing and Web preview.
 */
export function formatReceiptModel(
  data: ReceiptInputData,
  requestedWidth?: ReceiptPaperWidth,
  options?: FormatReceiptOptions
): FormattedReceiptModel {
  const paperWidth: ReceiptPaperWidth = requestedWidth || data.receiptConfig?.paperWidth || '80mm';
  // Standard thermal printable characters: 32 chars for 58mm, 42 chars for 80mm
  const charsPerLine = paperWidth === '58mm' ? 32 : 42;
  const useRs = options?.useRsFallback ?? false;

  // 1. Authoritative GST State
  const hadHistoricalTax = (data.cgstPaise ?? 0) > 0 || (data.sgstPaise ?? 0) > 0 || (data.igstPaise ?? 0) > 0;
  const isGstActive = data.gstEnabled !== undefined ? Boolean(data.gstEnabled) : hadHistoricalTax;

  // 2. Date and Time (standard format)
  const timezone = data.timezone || 'Asia/Kolkata';
  const { dateStr, timeStr } = formatReceiptDateTime(data.placedAt || new Date(), timezone);

  // 3. Table / Where / Order Number
  let whereText = '';
  const orderType = (data.orderType || '').toLowerCase();
  if (orderType === 'takeaway') {
    whereText = 'TAKEAWAY';
  } else if (orderType === 'delivery') {
    whereText = 'DELIVERY';
  } else if (data.tableLabel) {
    const raw = String(data.tableLabel).trim();
    whereText = raw.toLowerCase().startsWith('table') ? raw : `Table ${raw}`;
  } else {
    whereText = 'Table';
  }

  const orderNumText = `Order #${data.orderNumber}`;
  const tableAndOrderRow = alignLeftRight(whereText, orderNumText, charsPerLine);
  const dateTimeRow = alignLeftRight(dateStr, timeStr, charsPerLine);

  const tableText = whereText.toUpperCase().startsWith('TABLE')
    ? `TABLE: ${whereText.replace(/^table\s*:?\s*/i, '').trim()}`
    : whereText.toUpperCase();
  const orderText = `ORDER #${data.orderNumber}`;

  const cashierLine = data.cashierName ? `Cashier: ${data.cashierName.trim()}` : null;
  const customerLine = data.customerName || data.customerPhone
    ? `Customer: ${[data.customerName, data.customerPhone].filter(Boolean).join(' · ')}`
    : null;

  // 4. Logo & Store Header
  const resolvedLogoUrl = data.receiptConfig?.showLogo !== false ? (data.logoUrl || null) : null;
  const hasLogo = Boolean(resolvedLogoUrl);

  let addressText: string | null = null;
  if (data.receiptConfig?.showAddress !== false && data.address) {
    if (typeof data.address === 'string') {
      addressText = data.address.trim();
    } else if (typeof data.address === 'object') {
      const parts = [data.address.line1, data.address.city, data.address.pincode].filter(Boolean);
      if (parts.length > 0) addressText = parts.join(', ');
    }
  }

  const phoneText = data.receiptConfig?.showPhone !== false && data.phone ? data.phone.trim() : null;
  const gstinText = isGstActive && data.receiptConfig?.showGstin !== false && data.gstin ? data.gstin.trim() : null;

  const contactParts: string[] = [];
  if (phoneText) contactParts.push(`Tel: ${phoneText}`);
  if (gstinText) contactParts.push(`GSTIN: ${gstinText}`);
  const contactLine = contactParts.length > 0 ? contactParts.join(' • ') : null;

  // 5. Item Columns & Consistency
  // 58mm (32 chars): QTY=4, AMOUNT=10, ITEM=17
  // 80mm (42 chars): QTY=5, AMOUNT=12, ITEM=24
  const qtyColWidth = paperWidth === '58mm' ? 4 : 5;
  const amtColWidth = paperWidth === '58mm' ? 10 : 12;
  const itemColWidth = charsPerLine - qtyColWidth - amtColWidth - 1;

  const itemLines: FormattedReceiptModel['itemLines'] = [];

  for (const item of data.items) {
    const itemTotalPaise = item.totalPaise ?? ((item.unitPricePaise ?? item.pricePaise ?? 0) * item.qty);
    const amtText = formatReceiptMoney(itemTotalPaise, { useRsFallback: useRs });
    const qtyText = String(item.qty);

    const nameLines = wrapText(item.name, itemColWidth);
    const firstNameLine = nameLines[0] || item.name;
    const remainingNameLines = nameLines.slice(1);

    const extraLines: string[] = [];

    // Additional wrapped name lines
    for (const line of remainingNameLines) {
      extraLines.push(line);
    }

    // Indented Modifiers
    if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modPrice = mod.pricePaise !== undefined && mod.pricePaise > 0 ? formatReceiptMoney(mod.pricePaise, { useRsFallback: useRs }) : '';
        const modText = `  + ${mod.name}`;
        if (modPrice) {
          extraLines.push(alignLeftRight(modText, modPrice, charsPerLine));
        } else {
          extraLines.push(modText);
        }
      }
    }

    // Indented Notes
    if (data.receiptConfig?.showItemNotes && item.notes) {
      extraLines.push(`  Note: ${item.notes}`);
    }

    itemLines.push({
      name: firstNameLine,
      qty: item.qty,
      qtyText,
      amountText: amtText,
      extraLines,
    });
  }

  // 6. Financial Calculations & Breakdown
  const subtotalText = formatReceiptMoney(data.subtotalPaise, { useRsFallback: useRs });
  const discountText =
    (data.receiptConfig?.showDiscount !== false) && data.discountPaise && data.discountPaise > 0
      ? `-${formatReceiptMoney(data.discountPaise, { useRsFallback: useRs })}`
      : null;

  // GST Breakdown (Only if GST is ON)
  const taxBreakdown: Array<{ label: string; amountText: string }> = [];
  if (isGstActive && data.receiptConfig?.showTaxDetails !== false) {
    if (data.cgstPaise && data.cgstPaise > 0) {
      taxBreakdown.push({ label: 'CGST', amountText: formatReceiptMoney(data.cgstPaise, { useRsFallback: useRs }) });
    }
    if (data.sgstPaise && data.sgstPaise > 0) {
      taxBreakdown.push({ label: 'SGST', amountText: formatReceiptMoney(data.sgstPaise, { useRsFallback: useRs }) });
    }
    if (data.igstPaise && data.igstPaise > 0) {
      taxBreakdown.push({ label: 'IGST', amountText: formatReceiptMoney(data.igstPaise, { useRsFallback: useRs }) });
    }
  }

  const serviceChargeText =
    data.serviceChargePaise && data.serviceChargePaise > 0
      ? formatReceiptMoney(data.serviceChargePaise, { useRsFallback: useRs })
      : null;

  const roundOffText =
    data.roundOffPaise && data.roundOffPaise !== 0
      ? formatReceiptMoney(data.roundOffPaise, { useRsFallback: useRs })
      : null;

  const totalText = formatReceiptMoney(data.totalPaise, { useRsFallback: useRs });

  // 7. Dynamic NPCI UPI QR Code
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
      ? `Scan & Pay ${totalText}`
      : null;

  return {
    paperWidth,
    charsPerLine,
    isReprint: !!data.isReprint,
    isCancelled: !!data.isCancelled,
    isGstActive,

    hasLogo,
    logoUrl: resolvedLogoUrl,
    storeName: (data.storeName || 'CHAYA CAFE').toUpperCase(),
    headerNote: data.receiptConfig?.header || null,
    addressText,
    phone: phoneText,
    gstin: gstinText,
    contactLine,

    tableText,
    orderText,
    dateText: dateStr,
    timeText: timeStr,
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
 *
 * Implements the standard 80mm thermal POS receipt layout:
 * - Proper printable margins & width (72mm on 80mm paper).
 * - Uploaded logo centered at top (max 50mm width, max 22mm height, aspect ratio preserved).
 * - Small/normal business name below logo (not oversized).
 * - Clean standard font for Date & Time (12h AM/PM).
 * - Strict columns: ITEM (left), QTY (center), AMOUNT (right).
 * - Standard ₹240.00 currency formatting throughout.
 * - Compact totals & dynamic GST collapse when GST is OFF.
 * - Dynamic UPI QR centered with SCAN & PAY caption.
 * - Clean footer & automatic print script.
 */
export function formatReceiptHtml(
  data: ReceiptInputData,
  requestedWidth?: ReceiptPaperWidth,
  options?: FormatReceiptOptions
): string {
  const is58 = requestedWidth === '58mm' || data.receiptConfig?.paperWidth === '58mm';
  const paperWidth: ReceiptPaperWidth = is58 ? '58mm' : '80mm';
  const model = formatReceiptModel(data, paperWidth, options);

  const esc = (s: string) =>
    (s || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));

  const docTitle = model.isGstActive ? 'TAX INVOICE' : 'INVOICE';
  const widthMm = is58 ? '48mm' : '72mm';
  const pageSizeMm = is58 ? '58mm' : '80mm';
  const qrPixelSize = is58 ? 105 : 120;
  const autoPrint = options?.autoPrint !== false;

  // Build items rows with exact 3-column alignment
  const itemRowsHtml = model.itemLines.map((line) => {
    const extraHtml = line.extraLines.length > 0
      ? `<div class="item-extra">${line.extraLines.map(esc).join('<br/>')}</div>`
      : '';
    return `
      <div class="item-row">
        <div class="col-item">
          <div>${esc(line.name)}</div>
          ${extraHtml}
        </div>
        <div class="col-qty">${esc(line.qtyText)}</div>
        <div class="col-amt">${esc(line.amountText)}</div>
      </div>
    `;
  }).join('');

  // Tax breakdown rows (Only when GST is ON)
  const taxRowsHtml = model.taxBreakdown.map((t) => `
    <div class="totals-row">
      <span>${esc(t.label)}:</span>
      <span>${esc(t.amountText)}</span>
    </div>
  `).join('');

  // Dynamic QR Code SVG
  let qrSectionHtml = '';
  if (model.showUpiQr && model.upiResult.uri) {
    const qrSvg = generateQrSvgSync(model.upiResult.uri, { size: qrPixelSize, margin: 2 });
    qrSectionHtml = `
      <div class="div-dashed"></div>
      <div class="qr-section">
        ${model.showScanAndPay ? '<div class="qr-title">SCAN &amp; PAY</div>' : ''}
        <div class="qr-box">${qrSvg}</div>
        ${model.showScanAndPay ? `
          <div class="qr-amount">${model.totalText}</div>
          <div class="qr-caption">Scan to pay via UPI</div>
        ` : ''}
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(docTitle)} - ${esc(String(data.orderNumber))}</title>
<style>
  @page {
    size: ${pageSizeMm} auto;
    margin: 0;
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
    margin: 0 auto;
    padding: 2mm 1.5mm;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, -apple-system, 'Segoe UI', monospace;
    font-size: ${is58 ? '9pt' : '9.5pt'};
    line-height: 1.3;
    color: #000;
    background: #fff;
  }
  .receipt {
    width: 100%;
    margin: 0;
    padding: 0;
  }

  /* Watermark badges */
  .watermark {
    text-align: center;
    font-weight: 700;
    font-size: 9.5pt;
    border: 1px solid #000;
    padding: 2pt 4pt;
    margin-bottom: 3pt;
  }
  .watermark.void {
    font-size: 10.5pt;
    border-width: 1.5px;
  }

  /* Logo */
  .logo-wrap {
    text-align: center;
    margin: 1mm auto 2mm auto;
    padding: 0;
  }
  .logo-wrap img {
    max-width: ${is58 ? '36mm' : '50mm'};
    max-height: ${is58 ? '18mm' : '22mm'};
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    margin: 0 auto;
    filter: grayscale(100%) contrast(125%);
  }

  /* Store title & details */
  .store-title {
    text-align: center;
    font-size: ${is58 ? '10.5pt' : '11.5pt'};
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin: 1pt 0 2pt 0;
    line-height: 1.25;
  }
  .store-title.with-logo {
    font-size: ${is58 ? '9pt' : '10pt'};
    font-weight: 700;
    letter-spacing: 0.3px;
    margin: 1.5pt 0;
  }
  .store-details {
    text-align: center;
    font-size: 8.5pt;
    color: #222;
    line-height: 1.25;
    margin: 0.5pt 0;
  }
  .doc-title {
    text-align: center;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 2pt 0 1pt 0;
  }

  /* Separator lines */
  .div-dashed {
    border-top: 1px dashed #000;
    margin: 2.5pt 0;
  }
  .div-solid {
    border-top: 1.5px solid #000;
    margin: 2.5pt 0;
  }

  /* Metadata rows */
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9pt;
    line-height: 1.35;
    padding: 0.5pt 0;
  }
  .meta-row.bold {
    font-weight: 700;
  }

  /* Items table */
  .items-hdr {
    display: flex;
    align-items: center;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    padding: 1.5pt 0;
  }
  .col-item {
    flex: 1;
    text-align: left;
    word-break: break-word;
    padding-right: 4pt;
  }
  .col-qty {
    width: 28pt;
    text-align: center;
    flex-shrink: 0;
  }
  .col-amt {
    width: 58pt;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .item-row {
    display: flex;
    align-items: flex-start;
    padding: 1pt 0;
    font-size: 9.5pt;
    line-height: 1.3;
  }
  .item-extra {
    font-size: 8.5pt;
    color: #444;
    padding-left: 6pt;
    line-height: 1.25;
  }

  /* Totals */
  .totals-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1pt 0;
    font-size: 9.5pt;
    line-height: 1.35;
  }
  .totals-row.discount {
    color: #1a7a1a;
  }
  .totals-row.grand {
    font-size: ${is58 ? '11.5pt' : '12pt'};
    font-weight: 800;
    padding: 2pt 0;
  }

  /* QR section */
  .qr-section {
    text-align: center;
    margin: 3pt 0 1pt 0;
    padding: 2pt 0;
  }
  .qr-title {
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 2pt;
  }
  .qr-box {
    display: flex;
    justify-content: center;
    margin: 2pt 0;
  }
  .qr-amount {
    font-size: 11pt;
    font-weight: 800;
    margin-top: 2pt;
  }
  .qr-caption {
    font-size: 8.5pt;
    color: #222;
    margin-top: 1pt;
  }

  /* Footer */
  .footer {
    text-align: center;
    margin-top: 3pt;
    padding-top: 2pt;
    font-size: 8.5pt;
    color: #222;
    line-height: 1.35;
  }
  .footer .thank-you {
    font-weight: 600;
    color: #000;
    margin-bottom: 1.5pt;
  }
  .footer .branding {
    font-size: 8pt;
    color: #444;
  }

  @media screen {
    body { background: #f0ede9; padding: 12px; }
    .receipt {
      background: #fff;
      padding: 10px 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border-radius: 4px;
    }
  }
</style>
</head>
<body>
<div class="receipt">
  ${model.isReprint ? '<div class="watermark">*** REPRINT ***</div>' : ''}
  ${model.isCancelled ? '<div class="watermark void">*** CANCELLED / VOID ***</div>' : ''}

  ${model.logoUrl ? `
    <div class="logo-wrap">
      <img src="${esc(model.logoUrl)}" alt="Logo"/>
    </div>
    <div class="store-title with-logo">${esc(model.storeName)}</div>
  ` : `
    <div class="store-title">${esc(model.storeName)}</div>
  `}

  ${model.addressText ? `<div class="store-details">${esc(model.addressText)}</div>` : ''}
  ${model.phone ? `<div class="store-details">Tel: ${esc(model.phone)}</div>` : ''}
  ${model.isGstActive && model.gstin ? `<div class="store-details">GSTIN: ${esc(model.gstin)}</div>` : ''}
  ${model.headerNote ? `<div class="store-details" style="font-style:italic;">${esc(model.headerNote)}</div>` : ''}
  ${model.isGstActive ? `<div class="doc-title">TAX INVOICE</div>` : ''}

  <div class="div-dashed"></div>
  <div class="meta-row bold">
    <span>${esc(model.tableText)}</span>
    <span>${esc(model.orderText)}</span>
  </div>
  <div class="meta-row">
    <span>${esc(model.dateText)}</span>
    <span>${esc(model.timeText)}</span>
  </div>
  ${model.cashierLine ? `<div class="meta-row"><span>${esc(model.cashierLine)}</span></div>` : ''}
  ${model.customerLine ? `<div class="meta-row"><span>${esc(model.customerLine)}</span></div>` : ''}

  <div class="div-dashed"></div>
  <div class="items-hdr">
    <div class="col-item">ITEM</div>
    <div class="col-qty">QTY</div>
    <div class="col-amt">AMOUNT</div>
  </div>
  <div class="div-dashed"></div>

  ${itemRowsHtml}

  <div class="div-dashed"></div>
  <div class="totals-row">
    <span>Subtotal:</span>
    <span>${model.subtotalText}</span>
  </div>
  ${model.discountText ? `
    <div class="totals-row discount">
      <span>Discount:</span>
      <span>${model.discountText}</span>
    </div>
  ` : ''}
  ${taxRowsHtml}
  ${model.serviceChargeText ? `
    <div class="totals-row">
      <span>Service Charge:</span>
      <span>${model.serviceChargeText}</span>
    </div>
  ` : ''}
  ${model.roundOffText ? `
    <div class="totals-row">
      <span>Round Off:</span>
      <span>${model.roundOffText}</span>
    </div>
  ` : ''}

  <div class="div-dashed"></div>
  <div class="totals-row grand">
    <span>TOTAL:</span>
    <span>${model.totalText}</span>
  </div>
  <div class="div-dashed"></div>

  ${data.paymentMethod ? `
    <div class="totals-row" style="font-weight:700;">
      <span>Payment:</span>
      <span>${esc(data.paymentMethod.toUpperCase())}</span>
    </div>
  ` : ''}

  ${qrSectionHtml}

  <div class="div-dashed"></div>
  <div class="footer">
    <div class="thank-you">${model.footerNote ? esc(model.footerNote) : 'Thank you! Visit again.'}</div>
    <div class="branding">${esc(model.brandingText)}</div>
  </div>
</div>
${autoPrint ? `
<script>
  window.onload = function() {
    window.print();
  };
</script>
` : ''}
</body>
</html>`;

  return html;
}
