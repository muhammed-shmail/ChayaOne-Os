/**
 * Cafe OS — Authoritative UPI QR Payment Engine
 *
 * Implements dynamic UPI URI generation according to NPCI specifications:
 * upi://pay?pa=<upiId>&pn=<businessName>&am=<amount>&cu=INR
 *
 * Safety & Security Guarantees:
 * 1. The amount strictly reflects the authoritative finalized bill in paise (paise / 100 with 2 decimals).
 * 2. Client-supplied amounts are never trusted.
 * 3. Does not generate broken QR codes when UPI ID is missing or disabled.
 * 4. Cancelled or ₹0 orders never emit payable QR codes.
 * 5. Printing a QR code does NOT alter the payment status to PAID.
 */

export interface UpiPaymentConfig {
  upiEnabled: boolean;
  upiId: string;
  upiBusinessName: string;
  receiptQrEnabled: boolean;
  receiptQrSize: 'small' | 'medium' | 'large';
  showScanAndPayText: boolean;
}

export const DEFAULT_UPI_CONFIG: UpiPaymentConfig = {
  upiEnabled: true,
  upiId: '',
  upiBusinessName: '',
  receiptQrEnabled: true,
  receiptQrSize: 'medium',
  showScanAndPayText: true,
};

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v.trim() : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

/**
 * Read and normalize UPI payment configuration from Outlet.settings.
 * Checks both settings.payment and top-level settings.upi fallback.
 */
export function readUpiConfig(settings: unknown, defaultBusinessName = 'Chaya Cafe'): UpiPaymentConfig {
  const s = (settings as Record<string, unknown> | null) ?? {};
  const p = (s.payment as Record<string, unknown> | undefined) ?? (s.upi as Record<string, unknown> | undefined) ?? {};

  const upiId = str(p.upiId ?? s.upiVpa, DEFAULT_UPI_CONFIG.upiId);
  const upiBusinessName = str(p.upiBusinessName ?? s.upiBusinessName ?? p.businessName ?? defaultBusinessName, defaultBusinessName);
  const upiEnabled = bool(p.upiEnabled, upiId.length > 0);
  const receiptQrEnabled = bool(p.receiptQrEnabled ?? p.showQrOnReceipt, DEFAULT_UPI_CONFIG.receiptQrEnabled);
  const showScanAndPayText = bool(p.showScanAndPayText ?? p.showScanAndPay, DEFAULT_UPI_CONFIG.showScanAndPayText);

  const rawQrSize = p.receiptQrSize ?? p.qrSize;
  const receiptQrSize = rawQrSize === 'small' || rawQrSize === 'large' ? rawQrSize : 'medium';

  return {
    upiEnabled,
    upiId,
    upiBusinessName,
    receiptQrEnabled,
    receiptQrSize,
    showScanAndPayText,
  };
}

export interface BuildUpiUriParams {
  upiId: string;
  businessName?: string;
  payeeName?: string;
  amountPaise: number;
  orderNumber?: number | string;
  transactionRef?: string;
  notes?: string;
  merchantCode?: string;
  isCancelled?: boolean;
}

export interface UpiValidationResult {
  valid: boolean;
  uri: string | null;
  amountFormatted: string;
  reason?: string;
}

/**
 * Strictly format monetary paise to standard 2-decimal INR representation.
 * 19000 paise -> '190.00'
 * 34700 paise -> '347.00'
 * 125050 paise -> '1250.50'
 */
export function formatUpiAmount(amountPaise: number): string {
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return '0.00';
  return (amountPaise / 100).toFixed(2);
}

/**
 * Validate and assemble the dynamic UPI Payment URI.
 * Guarantees that invalid, cancelled, unconfigured, or ₹0 bills never emit a QR.
 */
export function generateAuthoritativeUpiUri(params: BuildUpiUriParams): UpiValidationResult {
  const amountFormatted = formatUpiAmount(params.amountPaise);

  if (params.isCancelled) {
    const reason = 'UPI QR skipped: Order is cancelled or voided';
    console.warn(`[UPI QR] ${reason}`);
    return {
      valid: false,
      uri: null,
      amountFormatted,
      reason,
    };
  }

  const upiId = (params.upiId || '').trim();
  if (!upiId) {
    const reason = 'UPI QR skipped - invalid/incomplete UPI configuration (UPI ID missing)';
    console.warn(`[UPI QR] ${reason}`);
    return {
      valid: false,
      uri: null,
      amountFormatted,
      reason,
    };
  }

  // Basic VPA validation: must contain @ and non-empty handle/provider
  if (!upiId.includes('@') || upiId.startsWith('@') || upiId.endsWith('@')) {
    const reason = `UPI QR skipped - invalid/incomplete UPI configuration (Invalid UPI ID format: ${upiId})`;
    console.warn(`[UPI QR] ${reason}`);
    return {
      valid: false,
      uri: null,
      amountFormatted,
      reason,
    };
  }

  const businessName = (params.businessName || params.payeeName || '').trim();
  if (!businessName) {
    const reason = 'UPI QR skipped - invalid/incomplete UPI configuration (Merchant name missing)';
    console.warn(`[UPI QR] ${reason}`);
    return {
      valid: false,
      uri: null,
      amountFormatted,
      reason,
    };
  }

  if (!Number.isFinite(params.amountPaise) || params.amountPaise <= 0) {
    const reason = 'UPI QR skipped: Payable amount must be greater than zero';
    console.warn(`[UPI QR] ${reason}`);
    return {
      valid: false,
      uri: null,
      amountFormatted,
      reason,
    };
  }

  const encodedName = encodeURIComponent(businessName);
  const encodedPa = encodeURIComponent(upiId);

  // Construct NPCI standard UPI URI: upi://pay?pa={VPA}&pn={MERCHANT_NAME}&am={FINAL_AMOUNT}&cu=INR
  let uri = `upi://pay?pa=${encodedPa}&pn=${encodedName}&am=${amountFormatted}&cu=INR`;

  if (params.merchantCode) {
    uri += `&mc=${encodeURIComponent(params.merchantCode)}`;
  }
  if (params.transactionRef) {
    uri += `&tr=${encodeURIComponent(params.transactionRef)}`;
  }
  if (params.notes) {
    uri += `&tn=${encodeURIComponent(params.notes)}`;
  }

  console.log('[UPI QR] Enabled: true');
  console.log(`[UPI QR] Amount: ${amountFormatted}`);
  console.log('[UPI QR] URI generated successfully');

  return {
    valid: true,
    uri,
    amountFormatted,
  };
}
