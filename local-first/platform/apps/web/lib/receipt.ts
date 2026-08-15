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
  /** print the GSTIN line (when the outlet has one) */
  showGstin: boolean;
}

/** Max length for free-text receipt fields (a few short lines). */
export const RECEIPT_FIELD_MAX = 280;

export const RECEIPT_DEFAULTS: ReceiptConfig = {
  logoUrl: null,
  header: '',
  footer: 'Thank you! Visit again.',
  phone: '',
  showLogo: true,
  showGstin: true,
};

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v.slice(0, RECEIPT_FIELD_MAX) : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

/** Read & normalize the receipt config from Outlet.settings. Never throws. */
export function readReceiptConfig(settings: unknown): ReceiptConfig {
  const s = (settings as { logoUrl?: unknown; receipt?: unknown } | null) ?? {};
  const r = (s.receipt as Record<string, unknown> | undefined) ?? {};
  return {
    logoUrl: typeof s.logoUrl === 'string' && s.logoUrl ? s.logoUrl : null,
    header: str(r.header, RECEIPT_DEFAULTS.header),
    footer: str(r.footer, RECEIPT_DEFAULTS.footer),
    phone: str(r.phone, RECEIPT_DEFAULTS.phone),
    showLogo: bool(r.showLogo, RECEIPT_DEFAULTS.showLogo),
    showGstin: bool(r.showGstin, RECEIPT_DEFAULTS.showGstin),
  };
}
