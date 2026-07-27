import { prisma } from '@cafeos/db';

export type GstType = 'exclusive' | 'inclusive';

export interface GstConfig {
  enabled: boolean;
  gstin: string;
  legalName: string;
  stateCode: string;
  registrationType: 'regular' | 'composition';
  
  gstType: GstType;
  inclusive: boolean;
  
  calculationMethod: 'per_item' | 'flat';
  defaultRate: number; // Flat GST default rate
  
  // Rules
  gstOnFood: boolean;
  gstOnBeverage: boolean;
  gstOnCombo: boolean;
  gstOnDelivery: boolean;
  gstOnPackaging: boolean;
  gstOnServiceCharge: boolean;
  gstOnConvenience: boolean;
  chargeGstRate: number; // rate for charges (default 5%)

  // Discount rules
  calculateGstBeforeDiscount: boolean;
  applyGstToCoupon: boolean;
  applyGstToManual: boolean;

  // Restaurant specific rates overrides
  dineInRate: number | null;
  takeawayRate: number | null;
  deliveryRate: number | null;
  qrOrderingRate: number | null;
  cloudKitchenRate: number | null;

  // Receipt Settings
  showGstin: boolean;
  showTaxSummary: boolean;
  showCgst: boolean;
  showSgst: boolean;
  showIgst: boolean;
  showHsn: boolean;
  showTaxPct: boolean;
  showTaxAmt: boolean;
  receiptFooter: string;
  taxInvoiceTitle: string;

  // Invoice Settings
  invoicePrefix: string;
  invoiceFormat: string;
  roundOff: boolean;
  roundingPrecision: number;
  printTaxInvoice: boolean;
  duplicateInvoice: boolean;
}

export function readGstConfig(settings: unknown): GstConfig {
  const s = (settings ?? {}) as Record<string, unknown>;
  const g = (s.gst ?? {}) as Record<string, unknown>;
  
  const enabled = g.enabled === undefined ? false : !!g.enabled;
  const gstin = typeof g.gstin === 'string' ? g.gstin : '';
  const legalName = typeof g.legalName === 'string' ? g.legalName : '';
  const stateCode = typeof g.stateCode === 'string' ? g.stateCode : '';
  const registrationType = g.registrationType === 'composition' ? 'composition' : 'regular';
  
  const gstType = g.gstType === 'inclusive' ? 'inclusive' : 'exclusive';
  const inclusive = gstType === 'inclusive';
  
  const calculationMethod = g.calculationMethod === 'flat' ? 'flat' : 'per_item';
  const defaultRate = typeof g.defaultRate === 'number' ? g.defaultRate : 5;
  
  const gstOnFood = g.gstOnFood === undefined ? true : !!g.gstOnFood;
  const gstOnBeverage = g.gstOnBeverage === undefined ? true : !!g.gstOnBeverage;
  const gstOnCombo = g.gstOnCombo === undefined ? true : !!g.gstOnCombo;
  const gstOnDelivery = !!g.gstOnDelivery;
  const gstOnPackaging = !!g.gstOnPackaging;
  const gstOnServiceCharge = !!g.gstOnServiceCharge;
  const gstOnConvenience = !!g.gstOnConvenience;
  const chargeGstRate = typeof g.chargeGstRate === 'number' ? g.chargeGstRate : 5;

  const calculateGstBeforeDiscount = !!g.calculateGstBeforeDiscount;
  const applyGstToCoupon = g.applyGstToCoupon === undefined ? true : !!g.applyGstToCoupon;
  const applyGstToManual = g.applyGstToManual === undefined ? true : !!g.applyGstToManual;

  const getNumOrNull = (v: any) => typeof v === 'number' ? v : null;
  const dineInRate = getNumOrNull(g.dineInRate);
  const takeawayRate = getNumOrNull(g.takeawayRate);
  const deliveryRate = getNumOrNull(g.deliveryRate);
  const qrOrderingRate = getNumOrNull(g.qrOrderingRate);
  const cloudKitchenRate = getNumOrNull(g.cloudKitchenRate);

  const showGstin = g.showGstin === undefined ? true : !!g.showGstin;
  const showTaxSummary = g.showTaxSummary === undefined ? true : !!g.showTaxSummary;
  const showCgst = g.showCgst === undefined ? true : !!g.showCgst;
  const showSgst = g.showSgst === undefined ? true : !!g.showSgst;
  const showIgst = g.showIgst === undefined ? true : !!g.showIgst;
  const showHsn = g.showHsn === undefined ? true : !!g.showHsn;
  const showTaxPct = g.showTaxPct === undefined ? true : !!g.showTaxPct;
  const showTaxAmt = g.showTaxAmt === undefined ? true : !!g.showTaxAmt;
  const receiptFooter = typeof g.receiptFooter === 'string' ? g.receiptFooter : 'Thank you! Visit again.';
  const taxInvoiceTitle = typeof g.taxInvoiceTitle === 'string' ? g.taxInvoiceTitle : 'TAX INVOICE';

  const invoicePrefix = typeof g.invoicePrefix === 'string' ? g.invoicePrefix : 'CHY';
  const invoiceFormat = typeof g.invoiceFormat === 'string' ? g.invoiceFormat : 'YYYY/MM/DD/NNNN';
  const roundOff = g.roundOff === undefined ? true : !!g.roundOff;
  const roundingPrecision = typeof g.roundingPrecision === 'number' ? g.roundingPrecision : 0;
  const printTaxInvoice = g.printTaxInvoice === undefined ? true : !!g.printTaxInvoice;
  const duplicateInvoice = g.duplicateInvoice === undefined ? true : !!g.duplicateInvoice;

  return {
    enabled,
    gstin,
    legalName,
    stateCode,
    registrationType,
    gstType,
    inclusive,
    calculationMethod,
    defaultRate,
    gstOnFood,
    gstOnBeverage,
    gstOnCombo,
    gstOnDelivery,
    gstOnPackaging,
    gstOnServiceCharge,
    gstOnConvenience,
    chargeGstRate,
    calculateGstBeforeDiscount,
    applyGstToCoupon,
    applyGstToManual,
    dineInRate,
    takeawayRate,
    deliveryRate,
    qrOrderingRate,
    cloudKitchenRate,
    showGstin,
    showTaxSummary,
    showCgst,
    showSgst,
    showIgst,
    showHsn,
    showTaxPct,
    showTaxAmt,
    receiptFooter,
    taxInvoiceTitle,
    invoicePrefix,
    invoiceFormat,
    roundOff,
    roundingPrecision,
    printTaxInvoice,
    duplicateInvoice
  };
}

/** Load an outlet's GST config (one small query). */
export async function getOutletGst(outletId: string): Promise<GstConfig> {
  const o = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
  return readGstConfig(o?.settings);
}

/** Spread-ready billing options for computeBill(). */
export function gstBillOptions(cfg: GstConfig, orderType?: string): Record<string, any> {
  let orderTypeRateOverride: number | null = null;
  if (orderType === 'dine_in') orderTypeRateOverride = cfg.dineInRate;
  else if (orderType === 'takeaway') orderTypeRateOverride = cfg.takeawayRate;
  else if (orderType === 'delivery') orderTypeRateOverride = cfg.deliveryRate;
  else if (orderType === 'qr') orderTypeRateOverride = cfg.qrOrderingRate;
  else if (orderType === 'cloud') orderTypeRateOverride = cfg.cloudKitchenRate;

  return {
    gstEnabled: cfg.enabled,
    gstRateOverride: cfg.calculationMethod === 'flat' ? cfg.defaultRate : null,
    gstInclusive: cfg.inclusive,
    gstOnFood: cfg.gstOnFood,
    gstOnBeverage: cfg.gstOnBeverage,
    gstOnCombo: cfg.gstOnCombo,
    gstOnDelivery: cfg.gstOnDelivery,
    gstOnPackaging: cfg.gstOnPackaging,
    gstOnServiceCharge: cfg.gstOnServiceCharge,
    gstOnConvenience: cfg.gstOnConvenience,
    chargeGstRate: cfg.chargeGstRate,
    calculateGstBeforeDiscount: cfg.calculateGstBeforeDiscount,
    applyGstToCoupon: cfg.applyGstToCoupon,
    applyGstToManual: cfg.applyGstToManual,
    orderTypeRateOverride,
  };
}

