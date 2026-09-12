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

  orderNumber: number;
  tableLabel?: string | null;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | string;
  placedAt: Date | string;
  settledAt?: Date | string | null;

  items: ReceiptItemLine[];

  subtotalPaise: number;
  discountPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  roundOffPaise?: number;
  totalPaise: number;

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

  // Header lines
  logoUrl: string | null;
  storeName: string;
  headerNote?: string | null;
  addressText?: string | null;
  contactLine?: string | null; // e.g. "9876543210 • GSTIN: 32XXXXX" or separate

  // Meta rows (same line)
  tableAndOrderRow: string;
  dateTimeRow: string;

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
  roundOffText: string | null;
  totalText: string;
  totalPaise: number;

  // UPI QR
  upiResult: UpiValidationResult;
  showUpiQr: boolean;
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

  const timezone = data.timezone || 'Asia/Kolkata';
  const { dateStr, timeStr } = formatReceiptDateTime(data.placedAt, timezone);

  // 1. Where / Order Type
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
  if (data.receiptConfig?.showGstin !== false && data.gstin) {
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

  const taxBreakdown: Array<{ label: string; amountText: string }> = [];
  if (data.receiptConfig?.showTaxDetails !== false) {
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

  const roundOffText = data.roundOffPaise ? formatINR(data.roundOffPaise) : null;
  const totalText = formatINR(data.totalPaise);

  // 5. Authoritative UPI QR Code
  const upiId = data.upiConfig?.upiId || '';
  const upiBusinessName = data.upiConfig?.upiBusinessName || data.storeName || 'Chaya Cafe';
  const upiEnabled = data.upiConfig?.upiEnabled ?? (upiId.length > 0);
  const receiptQrEnabled = (data.upiConfig?.receiptQrEnabled !== false) && (data.receiptConfig?.showUpiQr !== false);

  const upiResult = generateAuthoritativeUpiUri({
    upiId,
    businessName: upiBusinessName,
    amountPaise: data.totalPaise,
    orderNumber: data.orderNumber,
    isCancelled: !!data.isCancelled,
  });

  const showUpiQr = upiEnabled && receiptQrEnabled && upiResult.valid;
  const scanAndPayText =
    showUpiQr && (data.receiptConfig?.showScanAndPay !== false)
      ? `Scan & Pay ${formatINR(data.totalPaise)}`
      : null;

  return {
    paperWidth,
    charsPerLine,
    isReprint: !!data.isReprint,
    isCancelled: !!data.isCancelled,

    logoUrl: data.receiptConfig?.showLogo !== false ? (data.logoUrl || null) : null,
    storeName: (data.storeName || 'CHAYA CAFE').toUpperCase(),
    headerNote: data.receiptConfig?.header || null,
    addressText,
    contactLine,

    tableAndOrderRow,
    dateTimeRow,

    itemLines,

    subtotalText,
    discountText,
    taxBreakdown,
    roundOffText,
    totalText,
    totalPaise: data.totalPaise,

    upiResult,
    showUpiQr,
    scanAndPayText,

    footerNote: data.receiptConfig?.footer || null,
    brandingText: 'chaya.one',
  };
}
