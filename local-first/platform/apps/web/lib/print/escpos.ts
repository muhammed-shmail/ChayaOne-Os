/**
 * Cafe OS — Binary ESC/POS Command Encoder for Thermal Printers.
 * Encodes structured ticket & receipt payloads into raw ESC/POS binary buffers.
 */

// ESC/POS Command Constants (Buffer byte arrays)
export const ESC = 0x1b;
export const GS = 0x1d;

export const COMMANDS = {
  INIT: Buffer.from([ESC, 0x40]), // ESC @
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]), // ESC a 0
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]), // ESC a 1
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]), // ESC a 2
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]), // ESC E 1
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]), // ESC E 0
  DOUBLE_SIZE: Buffer.from([ESC, 0x21, 0x30]), // ESC ! 48
  DOUBLE_HEIGHT: Buffer.from([ESC, 0x21, 0x10]), // ESC ! 16
  NORMAL: Buffer.from([ESC, 0x21, 0x00]), // ESC ! 0
  LINE_FEED: Buffer.from([0x0a]),
  CASH_DRAWER: Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]), // ESC p 0 25 250
  FULL_CUT: Buffer.from([GS, 0x56, 0x42, 0x00]), // GS V 66 0 (Full paper cut)
  PARTIAL_CUT: Buffer.from([GS, 0x56, 0x41, 0x00]), // GS V 65 0
};

export interface KotPrintPayload {
  kotNumber: number;
  orderNumber: number;
  tableLabel?: string | null;
  orderType: string;
  stationName: string;
  isReprint?: boolean;
  isTransfer?: boolean;
  fromTableLabel?: string | null;
  toTableLabel?: string | null;
  transferredBy?: string | null;
  placedAt: string | Date;
  items: Array<{
    name: string;
    qty: number;
    notes?: string | null;
    modifiers?: Array<{ name: string }>;
  }>;
}

import {
  formatReceiptModel,
  alignLeftRight,
  alignCenter,
  type ReceiptInputData,
  type ReceiptItemLine,
} from './receipt-formatter';
import { buildRasterEscposQr } from './qr';
import type { ReceiptConfig, ReceiptPaperWidth } from '../receipt';
import type { UpiPaymentConfig } from './upi';

export interface ReceiptPrintPayload {
  storeName: string;
  logoUrl?: string | null;
  header?: string | null;
  footer?: string | null;
  phone?: string | null;
  gstin?: string | null;
  address?: { line1?: string; city?: string; pincode?: string } | string | null;
  timezone?: string;

  orderNumber: number | string;
  tableLabel?: string | null;
  orderType: string;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod?: string | null;
  placedAt: string | Date;
  settledAt?: string | Date | null;

  items?: ReceiptItemLine[];
  lines?: Array<{
    name: string;
    qty: number;
    pricePaise?: number;
    unitPricePaise?: number;
    totalPaise: number;
    modifiers?: Array<{ name: string; pricePaise?: number }>;
    notes?: string | null;
  }>;

  subtotalPaise: number;
  discountPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  roundOffPaise?: number;
  totalPaise: number;

  isReprint?: boolean;
  isCancelled?: boolean;
  isBillPreview?: boolean;
  paperWidth?: ReceiptPaperWidth;
  receiptConfig?: Partial<ReceiptConfig>;
  upiConfig?: Partial<UpiPaymentConfig>;
}

/**
 * Pads or truncates text to fit a fixed column width (default 32 chars for 58mm, 42 chars for 80mm).
 */
export function formatColumnRow(left: string, right: string, width = 42): string {
  return alignLeftRight(left, right, width);
}

/**
 * Build ESC/POS binary buffer for a Kitchen Order Ticket (KOT).
 */
export function buildKotEscposBuffer(payload: KotPrintPayload, width = 42): Buffer {
  const chunks: Buffer[] = [];
  const add = (buf: Buffer | string) => {
    if (typeof buf === 'string') {
      chunks.push(Buffer.from(buf + '\n', 'utf-8'));
    } else {
      chunks.push(buf);
    }
  };

  add(COMMANDS.INIT);
  add(COMMANDS.ALIGN_CENTER);

  if (payload.isTransfer) {
    add(COMMANDS.DOUBLE_SIZE);
    add('********************************');
    add('***      TABLE TRANSFER      ***');
    add('********************************');
    add(COMMANDS.NORMAL);
    add(COMMANDS.BOLD_ON);
    add(`FROM: ${payload.fromTableLabel ?? '—'}`);
    add(`TO:   ${payload.toTableLabel ?? '—'}`);
    add(`ORDER: #${payload.orderNumber}`);
    if (payload.transferredBy) {
      add(`BY: ${payload.transferredBy}`);
    }
    add(COMMANDS.BOLD_OFF);
    add('-'.repeat(width));
    add(COMMANDS.ALIGN_LEFT);
    add(formatColumnRow(`Station: ${payload.stationName.toUpperCase()}`, `TRANSFER SLIP`, width));
    const timeStr = new Date(payload.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    add(formatColumnRow(`Time: ${timeStr}`, `KOT #${payload.kotNumber}`, width));
    add('-'.repeat(width));

    if (payload.items.length > 0) {
      add(COMMANDS.BOLD_ON);
      add('CURRENT ITEMS:');
      for (const item of payload.items) {
        const qtyStr = `${item.qty}x `;
        add(formatColumnRow(`${qtyStr}${item.name}`, '', width));

        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            add(`   + ${mod.name}`);
          }
        }
        if (item.notes) {
          add(`   Note: ${item.notes}`);
        }
      }
      add(COMMANDS.BOLD_OFF);
      add('-'.repeat(width));
    }
    add(COMMANDS.LINE_FEED);
    add(COMMANDS.LINE_FEED);
    add(COMMANDS.LINE_FEED);
    add(COMMANDS.FULL_CUT);
    add(COMMANDS.LINE_FEED);
    return Buffer.concat(chunks);
  }

  add(COMMANDS.DOUBLE_SIZE);

  if (payload.isReprint) {
    add('********************************');
    add('***     REPRINT / RETRY      ***');
    add('*** CHECK FOR DUPLICATE KOT  ***');
    add('********************************');
  }
  add(`KOT #${payload.kotNumber}`);

  add(COMMANDS.NORMAL);
  add(COMMANDS.BOLD_ON);
  add(`Station: ${payload.stationName.toUpperCase()}`);
  add(COMMANDS.BOLD_OFF);
  add(COMMANDS.ALIGN_LEFT);
  add('-'.repeat(width));

  const where = payload.tableLabel ? `Table: ${payload.tableLabel}` : payload.orderType.toUpperCase();
  const dateStr = new Date(payload.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  add(formatColumnRow(`Order #${payload.orderNumber} (${where})`, dateStr, width));
  add('-'.repeat(width));

  add(COMMANDS.BOLD_ON);
  for (const item of payload.items) {
    const qtyStr = `${item.qty}x `;
    add(formatColumnRow(`${qtyStr}${item.name}`, '', width));
    
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        add(`   + ${mod.name}`);
      }
    }
    if (item.notes) {
      add(`   Note: ${item.notes}`);
    }
  }
  add(COMMANDS.BOLD_OFF);
  add('-'.repeat(width));
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.FULL_CUT);
  add(COMMANDS.LINE_FEED);

  return Buffer.concat(chunks);
}

/**
 * Build ESC/POS binary buffer for a Customer Order Receipt / Invoice.
 * Supports both 58mm (32 chars) and 80mm (42 chars) printer profiles with dynamic UPI QR.
 */
export function buildReceiptEscposBuffer(payload: ReceiptPrintPayload, widthOverride?: number): Buffer {
  const chunks: Buffer[] = [];
  const add = (buf: Buffer | string) => {
    if (typeof buf === 'string') {
      chunks.push(Buffer.from(buf + '\n', 'utf-8'));
    } else {
      chunks.push(buf);
    }
  };

  // 1. Normalize line items
  const rawItems = payload.items || payload.lines || [];
  const items: ReceiptItemLine[] = rawItems.map((it: any) => ({
    name: it.name,
    qty: it.qty,
    unitPricePaise: it.unitPricePaise ?? it.pricePaise ?? 0,
    totalPaise: it.totalPaise ?? ((it.unitPricePaise ?? it.pricePaise ?? 0) * it.qty),
    modifiers: it.modifiers,
    notes: it.notes,
  }));

  // 2. Resolve paper width profile
  const resolvedPaperWidth: ReceiptPaperWidth =
    widthOverride === 32 || payload.paperWidth === '58mm' ? '58mm' : '80mm';

  // 3. Build unified receipt model
  const model = formatReceiptModel(
    {
      storeName: payload.storeName,
      logoUrl: payload.logoUrl,
      address: payload.address,
      phone: payload.phone,
      gstin: payload.gstin,
      timezone: payload.timezone,
      orderNumber: payload.orderNumber,
      tableLabel: payload.tableLabel,
      orderType: payload.orderType,
      placedAt: payload.placedAt,
      settledAt: payload.settledAt,
      items,
      subtotalPaise: payload.subtotalPaise,
      discountPaise: payload.discountPaise,
      cgstPaise: payload.cgstPaise,
      sgstPaise: payload.sgstPaise,
      igstPaise: payload.igstPaise,
      roundOffPaise: payload.roundOffPaise,
      totalPaise: payload.totalPaise,
      paymentMethod: payload.paymentMethod,
      isReprint: payload.isReprint,
      isCancelled: payload.isCancelled,
      receiptConfig: payload.receiptConfig,
      upiConfig: payload.upiConfig,
    },
    resolvedPaperWidth,
  );

  const width = model.charsPerLine;
  const divider = '-'.repeat(width);

  // Initialize printer
  add(COMMANDS.INIT);

  // Status Watermark if Reprint / Void
  if (model.isReprint) {
    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.BOLD_ON);
    add('*** REPRINT ***');
    add(COMMANDS.BOLD_OFF);
  }
  if (model.isCancelled) {
    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.DOUBLE_HEIGHT);
    add(COMMANDS.BOLD_ON);
    add('*** CANCELLED / VOID ***');
    add(COMMANDS.NORMAL);
    add(COMMANDS.BOLD_OFF);
  }

  // Header: Shop Name & Details
  add(COMMANDS.ALIGN_CENTER);
  add(COMMANDS.DOUBLE_HEIGHT);
  add(COMMANDS.BOLD_ON);
  add(model.storeName);
  add(COMMANDS.NORMAL);
  add(COMMANDS.BOLD_OFF);

  if (model.addressText) {
    add(model.addressText);
  }
  if (model.contactLine) {
    add(model.contactLine);
  }
  if (model.headerNote) {
    add(model.headerNote);
  }

  // Meta: Table + Order Number (SAME ROW) & Date + Time (SAME ROW)
  add(COMMANDS.ALIGN_LEFT);
  add(divider);
  add(model.tableAndOrderRow);
  add(model.dateTimeRow);
  add(divider);

  // Column Headers
  const colHeaderRight = resolvedPaperWidth === '58mm' ? 'QTY AMOUNT' : 'QTY    AMOUNT';
  add(alignLeftRight('ITEM', colHeaderRight, width));
  add(divider);

  // Items
  for (const line of model.itemLines) {
    const mainRow = alignLeftRight(line.name, `${line.qtyText} ${line.amountText}`, width);
    add(mainRow);
    for (const extra of line.extraLines) {
      add(extra);
    }
  }

  // Subtotal, Discounts, Taxes
  add(divider);
  add(alignLeftRight('Subtotal', model.subtotalText, width));

  for (const tax of model.taxBreakdown) {
    add(alignLeftRight(tax.label, tax.amountText, width));
  }

  if (model.discountText) {
    add(alignLeftRight('Discount', model.discountText, width));
  }

  if (model.roundOffText) {
    add(alignLeftRight('Round Off', model.roundOffText, width));
  }

  // Final Total (Emphasized bold / double height)
  add(divider);
  add(COMMANDS.ALIGN_LEFT);
  add(COMMANDS.BOLD_ON);
  add(COMMANDS.DOUBLE_HEIGHT);
  add(alignLeftRight('TOTAL', model.totalText, Math.floor(width / (resolvedPaperWidth === '58mm' ? 1 : 1))));
  add(COMMANDS.NORMAL);
  add(COMMANDS.BOLD_OFF);
  add(divider);

  // Dynamic UPI QR Code
  if (model.showUpiQr && model.upiResult.uri) {
    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.LINE_FEED);

    // Raster QR: 4 dots per module for 58mm, 5 dots for 80mm
    const qrScale = resolvedPaperWidth === '58mm' ? 4 : 5;
    const qrBuffer = buildRasterEscposQr(model.upiResult.uri, qrScale, 3);
    add(qrBuffer);

    if (model.scanAndPayText) {
      add(COMMANDS.BOLD_ON);
      add(model.scanAndPayText);
      add(COMMANDS.BOLD_OFF);
    }
    add(COMMANDS.LINE_FEED);
    add(divider);
  }

  // Footer: Branding
  add(COMMANDS.ALIGN_CENTER);
  if (model.footerNote && model.footerNote.toLowerCase() !== 'chaya.one') {
    add(model.footerNote);
  }
  add(model.brandingText);

  // Feed & Cut
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.LINE_FEED);

  // Pulse cash drawer only for settled cash receipts at checkout counter (never for bill previews or reprints)
  if (!payload.isBillPreview && !payload.isReprint && payload.paymentMethod === 'CASH') {
    add(COMMANDS.CASH_DRAWER);
  }

  add(COMMANDS.FULL_CUT);
  add(COMMANDS.LINE_FEED);

  return Buffer.concat(chunks);
}
