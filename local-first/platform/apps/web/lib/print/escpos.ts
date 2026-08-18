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
  placedAt: string | Date;
  items: Array<{
    name: string;
    qty: number;
    notes?: string | null;
    modifiers?: Array<{ name: string }>;
  }>;
}

export interface ReceiptPrintPayload {
  storeName: string;
  header?: string | null;
  footer?: string | null;
  phone?: string | null;
  gstin?: string | null;
  orderNumber: number;
  tableLabel?: string | null;
  orderType: string;
  customerName?: string | null;
  paymentMethod?: string | null;
  placedAt: string | Date;
  lines: Array<{
    name: string;
    qty: number;
    pricePaise: number;
    totalPaise: number;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
}

/**
 * Pads or truncates text to fit a fixed column width (default 32 chars for 58mm, 42 chars for 80mm).
 */
export function formatColumnRow(left: string, right: string, width = 42): string {
  const availableLeftWidth = Math.max(1, width - right.length - 1);
  const truncatedLeft = left.length > availableLeftWidth ? left.slice(0, availableLeftWidth) : left;
  const padding = ' '.repeat(Math.max(1, width - truncatedLeft.length - right.length));
  return `${truncatedLeft}${padding}${right}`;
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
  add(COMMANDS.DOUBLE_SIZE);
  
  if (payload.isReprint) {
    add('*** REPRINT ***');
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
  add(COMMANDS.FULL_CUT);

  return Buffer.concat(chunks);
}

/**
 * Build ESC/POS binary buffer for a Customer Order Receipt / Invoice.
 */
export function buildReceiptEscposBuffer(payload: ReceiptPrintPayload, width = 42): Buffer {
  const chunks: Buffer[] = [];
  const add = (buf: Buffer | string) => {
    if (typeof buf === 'string') {
      chunks.push(Buffer.from(buf + '\n', 'utf-8'));
    } else {
      chunks.push(buf);
    }
  };

  const formatPaise = (p: number) => `INR ${(p / 100).toFixed(2)}`;

  add(COMMANDS.INIT);
  add(COMMANDS.ALIGN_CENTER);
  add(COMMANDS.BOLD_ON);
  add(COMMANDS.DOUBLE_HEIGHT);
  add(payload.storeName);
  add(COMMANDS.NORMAL);
  add(COMMANDS.BOLD_OFF);

  if (payload.header) add(payload.header);
  if (payload.phone) add(`Tel: ${payload.phone}`);
  if (payload.gstin) add(`GSTIN: ${payload.gstin}`);

  add(COMMANDS.ALIGN_LEFT);
  add('='.repeat(width));
  const where = payload.tableLabel ? `Table ${payload.tableLabel}` : payload.orderType.toUpperCase();
  add(formatColumnRow(`Order #${payload.orderNumber}`, where, width));
  add(formatColumnRow(`Date: ${new Date(payload.placedAt).toLocaleDateString()}`, new Date(payload.placedAt).toLocaleTimeString(), width));
  if (payload.customerName) add(`Customer: ${payload.customerName}`);
  add('-'.repeat(width));

  add(formatColumnRow('Item Qty x Price', 'Total', width));
  add('-'.repeat(width));

  for (const line of payload.lines) {
    const linePrice = formatPaise(line.totalPaise);
    add(formatColumnRow(`${line.qty}x ${line.name}`, linePrice, width));
  }

  add('-'.repeat(width));
  add(formatColumnRow('Subtotal:', formatPaise(payload.subtotalPaise), width));
  if (payload.discountPaise > 0) {
    add(formatColumnRow('Discount:', `-${formatPaise(payload.discountPaise)}`, width));
  }
  if (payload.cgstPaise > 0) {
    add(formatColumnRow('CGST:', formatPaise(payload.cgstPaise), width));
    add(formatColumnRow('SGST:', formatPaise(payload.sgstPaise), width));
  }
  if (payload.igstPaise > 0) {
    add(formatColumnRow('IGST:', formatPaise(payload.igstPaise), width));
  }

  add(COMMANDS.BOLD_ON);
  add(formatColumnRow('TOTAL:', formatPaise(payload.totalPaise), width));
  add(COMMANDS.BOLD_OFF);

  if (payload.paymentMethod) {
    add(formatColumnRow('Payment Method:', payload.paymentMethod.toUpperCase(), width));
  }

  add('='.repeat(width));
  add(COMMANDS.ALIGN_CENTER);
  if (payload.footer) add(payload.footer);
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.LINE_FEED);
  add(COMMANDS.CASH_DRAWER); // Pulse cash drawer
  add(COMMANDS.FULL_CUT);

  return Buffer.concat(chunks);
}
