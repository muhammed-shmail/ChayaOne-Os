/**
 * Cafe OS — printed receipt / bill layout config.
 *
 * Stored in the existing Outlet.settings JSON (no schema change): the store
 * logo lives at `settings.logoUrl`; header / footer / phone and the show
 * toggles live under `settings.receipt`. Mirrors the devices/gst/floors pattern.
 *
 * Consumed by the bill/receipt print templates in DashboardClient (Orders) and
 * PosClient (dine-in bill + post-payment receipt). KOTs stay unbranded.
 */

export type ReceiptPaperWidth = '58mm' | '80mm';
export type ReceiptQrSize = 'small' | 'medium' | 'large';

export interface ReceiptConfig {
  /** store logo — read from settings.logoUrl (shared with the General logo section) */
  logoUrl: string | null;
  /** extra header line(s) printed under the business name */
  header: string;
  /** footer / thank-you text printed at the bottom */
  footer: string;
  /** business contact number, printed in the header */
  phone: string;
  /** print the logo at the top of the receipt */
  showLogo: boolean;
  /** print the address line when available */
  showAddress: boolean;
  /** print the contact phone */
  showPhone: boolean;
  /** print the GSTIN line (when the outlet has one) */
  showGstin: boolean;
  /** print table info */
  showTableNumber: boolean;
  /** print order number */
  showOrderNumber: boolean;
  /** print date and time */
  showDateTime: boolean;
  /** print special item notes */
  showItemNotes: boolean;
  /** print tax details (CGST/SGST/IGST breakdown) */
  showTaxDetails: boolean;
  /** print discount row when applicable */
  showDiscount: boolean;
  /** print dynamic UPI QR code on receipt */
  showUpiQr: boolean;
  /** print "Scan & Pay ₹AMOUNT" text under QR */
  showScanAndPay: boolean;
  /** thermal printer paper width profile */
  paperWidth: ReceiptPaperWidth;
  /** QR code size on paper */
  qrSize: ReceiptQrSize;
}

/** Max length for free-text receipt fields (a few short lines). */
export const RECEIPT_FIELD_MAX = 280;

export const RECEIPT_DEFAULTS: ReceiptConfig = {
  logoUrl: null,
  header: '',
  footer: 'chaya.one',
  phone: '',
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showGstin: true,
  showTableNumber: true,
  showOrderNumber: true,
  showDateTime: true,
  showItemNotes: false,
  showTaxDetails: true,
  showDiscount: true,
  showUpiQr: true,
  showScanAndPay: true,
  paperWidth: '80mm',
  qrSize: 'medium',
};

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v.slice(0, RECEIPT_FIELD_MAX) : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

/** Read & normalize the receipt config from Outlet.settings. Never throws. */
export function readReceiptConfig(settings: unknown): ReceiptConfig {
  const s = (settings as { logoUrl?: unknown; receipt?: unknown } | null) ?? {};
  const r = (s.receipt as Record<string, unknown> | undefined) ?? {};
  const widthVal = r.paperWidth === '58mm' ? '58mm' : '80mm';
  const qrSizeVal = r.qrSize === 'small' || r.qrSize === 'large' ? r.qrSize : 'medium';

  return {
    logoUrl: typeof s.logoUrl === 'string' && s.logoUrl ? s.logoUrl : null,
    header: str(r.header, RECEIPT_DEFAULTS.header),
    footer: str(r.footer, RECEIPT_DEFAULTS.footer),
    phone: str(r.phone, RECEIPT_DEFAULTS.phone),
    showLogo: bool(r.showLogo, RECEIPT_DEFAULTS.showLogo),
    showAddress: bool(r.showAddress, RECEIPT_DEFAULTS.showAddress),
    showPhone: bool(r.showPhone, RECEIPT_DEFAULTS.showPhone),
    showGstin: bool(r.showGstin, RECEIPT_DEFAULTS.showGstin),
    showTableNumber: bool(r.showTableNumber, RECEIPT_DEFAULTS.showTableNumber),
    showOrderNumber: bool(r.showOrderNumber, RECEIPT_DEFAULTS.showOrderNumber),
    showDateTime: bool(r.showDateTime, RECEIPT_DEFAULTS.showDateTime),
    showItemNotes: bool(r.showItemNotes, RECEIPT_DEFAULTS.showItemNotes),
    showTaxDetails: bool(r.showTaxDetails, RECEIPT_DEFAULTS.showTaxDetails),
    showDiscount: bool(r.showDiscount, RECEIPT_DEFAULTS.showDiscount),
    showUpiQr: bool(r.showUpiQr, RECEIPT_DEFAULTS.showUpiQr),
    showScanAndPay: bool(r.showScanAndPay, RECEIPT_DEFAULTS.showScanAndPay),
    paperWidth: widthVal,
    qrSize: qrSizeVal,
  };
}
