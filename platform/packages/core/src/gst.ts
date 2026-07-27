import type { Paise } from './money';
import { roundToRupee } from './money';

export interface BillLine {
  /** base unit price in paise (tax-exclusive) */
  pricePaise: Paise;
  /** total of selected modifiers per unit, in paise */
  modPaise?: Paise;
  /** GST rate percent, e.g. 5, 12, 18 */
  gstRate: number;
  qty: number;
  categoryType?: string | null; // e.g. 'food', 'beverage', 'combo'
  taxExempt?: boolean;
  zeroRated?: boolean;
  nilRated?: boolean;
  hsnCode?: string | null;
}

export interface BillOptions {
  /** order-level discount percent (0–100) */
  discountPct?: number;
  /**
   * Flat order-level discount in paise, applied ON TOP of discountPct. The
   * combined discount is clamped to the subtotal so a bill never goes negative.
   * Use for "₹50 off" style manual discounts.
   */
  discountFlatPaise?: number;
  /** service charge percent applied on the post-discount taxable base */
  serviceChargePct?: number;
  /** true = inter-state supply → IGST instead of CGST/SGST */
  interState?: boolean;
  /**
   * Whether GST is charged at all. Defaults to true (registered outlet).
   * Set false for an unregistered shop — every line's tax becomes 0.
   */
  gstEnabled?: boolean;
  /**
   * Flat GST rate (percent) applied to EVERY line, overriding each item's own
   * gstRate. Use when a shop bills a single rate instead of per-item rates.
   * Ignored when GST is disabled or when null/undefined.
   */
  gstRateOverride?: number | null;
  /**
   * Tax mode. false/undefined (default) = EXCLUSIVE: the line price is the
   * pre-tax base and GST is added on top. true = INCLUSIVE: the line price
   * already contains GST, which is extracted out so the total equals the menu
   * price. Inclusive is implemented by billing each line's net-of-tax price
   * through the exact same exclusive math, so exclusive results never change.
   */
  gstInclusive?: boolean;

  // GST application rules (Section 8)
  gstOnFood?: boolean;
  gstOnBeverage?: boolean;
  gstOnCombo?: boolean;
  gstOnDelivery?: boolean;
  gstOnPackaging?: boolean;
  gstOnServiceCharge?: boolean;
  gstOnConvenience?: boolean;

  // Charge values (Section 8 & 12)
  deliveryChargePaise?: number;
  packagingChargePaise?: number;
  convenienceFeePaise?: number;
  chargeGstRate?: number; // rate for charges (default 5%)

  // Discount rules (Section 9)
  calculateGstBeforeDiscount?: boolean;
  applyGstToCoupon?: boolean;
  applyGstToManual?: boolean;

  // Restaurant-specific type rules (Section 12)
  orderTypeRateOverride?: number | null;
}

export interface Bill {
  subtotalPaise: Paise;
  discountPaise: Paise;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  serviceChargePaise: Paise;
  deliveryChargePaise: Paise;
  packagingChargePaise: Paise;
  convenienceFeePaise: Paise;
  roundOffPaise: Paise; // can be negative
  totalPaise: Paise;
  /** tax grouped by rate, for the receipt's GST summary */
  taxByRate: Record<string, Paise>;
}

/**
 * Compute a complete bill. Discount is distributed across lines pro-rata so
 * per-line tax is correct; CGST/SGST split halves the line tax (SGST takes the
 * rounding remainder so cgst+sgst === lineTax exactly).
 */
export function computeBill(lines: BillLine[], opts: BillOptions = {}): Bill {
  const discountPct = clampPct(opts.discountPct ?? 0);
  const flatDiscountPaise = Math.max(0, Math.round(opts.discountFlatPaise ?? 0));
  const scPct = clampPct(opts.serviceChargePct ?? 0);
  const interState = !!opts.interState;
  
  // GST gating
  const gstEnabled = opts.gstEnabled !== false;
  const rawOverride = opts.gstRateOverride;
  const rateOverride =
    gstEnabled && rawOverride != null && !Number.isNaN(rawOverride) && rawOverride > 0
      ? clampPct(rawOverride)
      : null;
  const orderTypeRate =
    gstEnabled && opts.orderTypeRateOverride != null && !Number.isNaN(opts.orderTypeRateOverride) && opts.orderTypeRateOverride > 0
      ? clampPct(opts.orderTypeRateOverride)
      : null;

  const inclusive = gstEnabled && !!opts.gstInclusive;

  // GST application rules defaults
  const gstOnFood = opts.gstOnFood !== false;
  const gstOnBeverage = opts.gstOnBeverage !== false;
  const gstOnCombo = opts.gstOnCombo !== false;
  const gstOnDelivery = !!opts.gstOnDelivery;
  const gstOnPackaging = !!opts.gstOnPackaging;
  const gstOnServiceCharge = !!opts.gstOnServiceCharge;
  const gstOnConvenience = !!opts.gstOnConvenience;

  const chargeGstRate = opts.chargeGstRate ?? 5; // default 5% charge tax

  // Normalize every line to (net-of-tax unit price, effective rate)
  const norm = lines.map((l) => {
    const unit = l.pricePaise + (l.modPaise ?? 0);
    
    // Determine effective rate
    let effRate = 0;
    if (gstEnabled) {
      if (l.taxExempt || l.zeroRated || l.nilRated) {
        effRate = 0;
      } else if (orderTypeRate != null) {
        effRate = orderTypeRate;
      } else if (rateOverride != null) {
        effRate = rateOverride;
      } else if (l.categoryType === 'food' && !gstOnFood) {
        effRate = 0;
      } else if (l.categoryType === 'beverage' && !gstOnBeverage) {
        effRate = 0;
      } else if (l.categoryType === 'combo' && !gstOnCombo) {
        effRate = 0;
      } else {
        effRate = l.gstRate;
      }
    }

    const unitNet = inclusive && effRate > 0 ? Math.round((unit * 100) / (100 + effRate)) : unit;
    return { gross: unitNet * l.qty, effRate };
  });

  const subtotalPaise = norm.reduce((sum, l) => sum + l.gross, 0);
  
  // Discount rules
  const applyGstToCoupon = opts.applyGstToCoupon !== false;
  const applyGstToManual = opts.applyGstToManual !== false;

  const discountPaise = Math.min(
    subtotalPaise,
    Math.round((subtotalPaise * discountPct) / 100) + flatDiscountPaise,
  );

  // Discount to deduct from taxable base for GST calculation
  const gstDiscountPct = applyGstToCoupon ? discountPct : 0;
  const gstFlatDiscount = applyGstToManual ? flatDiscountPaise : 0;
  const gstDiscountPaise = Math.min(
    subtotalPaise,
    Math.round((subtotalPaise * gstDiscountPct) / 100) + gstFlatDiscount,
  );

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  const taxByRate: Record<string, Paise> = {};

  const calculateGstBeforeDiscount = !!opts.calculateGstBeforeDiscount;

  for (const l of norm) {
    const gross = l.gross;
    const share = subtotalPaise > 0 ? gross / subtotalPaise : 0;
    
    // Taxable base for this line
    const lineTaxable = calculateGstBeforeDiscount
      ? gross
      : gross - Math.round(gstDiscountPaise * share);

    const effRate = l.effRate;
    const lineTax = Math.round((lineTaxable * effRate) / 100);

    if (interState) {
      igstPaise += lineTax;
    } else {
      const half = Math.round(lineTax / 2);
      cgstPaise += half;
      sgstPaise += lineTax - half;
    }
    
    const key = effRate.toFixed(2);
    if (lineTax > 0) {
      taxByRate[key] = (taxByRate[key] ?? 0) + lineTax;
    }
  }

  const taxablePaise = subtotalPaise - discountPaise;
  const serviceChargePaise = Math.round((taxablePaise * scPct) / 100);
  
  const deliveryChargePaise = opts.deliveryChargePaise ?? 0;
  const packagingChargePaise = opts.packagingChargePaise ?? 0;
  const convenienceFeePaise = opts.convenienceFeePaise ?? 0;

  // Calculate tax on charges
  let chargesTax = 0;
  const applyChargeTax = (chargeAmount: number, enabled: boolean) => {
    if (!gstEnabled || !enabled || chargeAmount <= 0) return 0;
    const tax = Math.round((chargeAmount * chargeGstRate) / 100);
    chargesTax += tax;
    const chargeKey = chargeGstRate.toFixed(2);
    taxByRate[chargeKey] = (taxByRate[chargeKey] ?? 0) + tax;
    return tax;
  };

  applyChargeTax(serviceChargePaise, gstOnServiceCharge);
  applyChargeTax(deliveryChargePaise, gstOnDelivery);
  applyChargeTax(packagingChargePaise, gstOnPackaging);
  applyChargeTax(convenienceFeePaise, gstOnConvenience);

  if (interState) {
    igstPaise += chargesTax;
  } else {
    const half = Math.round(chargesTax / 2);
    cgstPaise += half;
    sgstPaise += chargesTax - half;
  }

  const taxTotal = cgstPaise + sgstPaise + igstPaise;
  const preRound = taxablePaise + taxTotal + serviceChargePaise + deliveryChargePaise + packagingChargePaise + convenienceFeePaise;
  const totalPaise = roundToRupee(preRound);
  const roundOffPaise = totalPaise - preRound;

  return {
    subtotalPaise,
    discountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    serviceChargePaise,
    deliveryChargePaise,
    packagingChargePaise,
    convenienceFeePaise,
    roundOffPaise,
    totalPaise,
    taxByRate,
  };
}

function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

