/**
 * Cafe OS — shared request/response contracts (zod).
 * Used by API route handlers (validation) and the POS client (types).
 */
import { z } from 'zod';

/** Built-in station slugs. Kept for reference; stations are now configurable
 *  per outlet (Outlet.settings.kitchens), so a cart line accepts any slug. */
export const StationEnum = z.enum(['kitchen', 'bar', 'dessert']);
/** A kitchen/station slug on a cart line — any configured kitchen id, or null. */
export const StationSchema = z.string().min(1).max(40);
export const OrderTypeEnum = z.enum(['dine_in', 'takeaway', 'delivery']);
export const PayMethodEnum = z.enum(['cash', 'card', 'upi', 'wallet', 'points']);

/** one line in an incoming cart */
export const CartLineSchema = z.object({
  itemId: z.string().uuid(),
  nameSnapshot: z.string().min(1),
  qty: z.number().int().positive().max(99),
  unitPricePaise: z.number().int().nonnegative(),
  gstRate: z.number().min(0).max(28),
  station: StationSchema.nullish(),
  modifiers: z
    .array(z.object({ name: z.string(), pricePaise: z.number().int().nonnegative() }))
    .default([]),
  notes: z.string().max(280).optional(),
});
export type CartLine = z.infer<typeof CartLineSchema>;

/** POST /api/orders — create/settle an order (idempotent via clientUuid) */
export const CreateOrderSchema = z.object({
  clientUuid: z.string().uuid(), // idempotency key (offline-safe)
  outletId: z.string().uuid(),
  type: OrderTypeEnum,
  tableId: z.string().uuid().nullish(),
  customerId: z.string().uuid().nullish(),
  /** optional walk-in captured at the POS; linked/created server-side by phoneHash */
  customer: z
    .object({
      name: z.string().max(60).optional(),
      phone: z.string().max(20).optional(),
    })
    .nullish(),
  staffId: z.string().uuid().nullish(),
  lines: z.array(CartLineSchema).min(1),
  discountPct: z.number().min(0).max(100).default(0),
  /** flat ₹-amount discount in paise, applied on top of discountPct */
  discountFlatPaise: z.number().int().min(0).default(0),
  serviceChargePct: z.number().min(0).max(100).default(0),
  deliveryChargePaise: z.number().int().min(0).default(0),
  packagingChargePaise: z.number().int().min(0).default(0),
  convenienceFeePaise: z.number().int().min(0).default(0),
  interState: z.boolean().default(false),
  /** when present, settle immediately with this payment */
  payment: z
    .object({
      method: PayMethodEnum,
      amountPaise: z.number().int().nonnegative(),
      tipPaise: z.number().int().nonnegative().default(0),
      providerRef: z.string().optional(),
    })
    .optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/** PATCH /api/orders/:id/status — KDS bump / lifecycle */
export const AdvanceOrderSchema = z.object({
  status: z.enum(['open', 'in_kitchen', 'ready', 'served', 'settled', 'cancelled']),
});

/** Cash Denominations breakdown (counts of bills and total coins paise) */
export const CashDenominationsSchema = z.object({
  d500: z.number().int().min(0).default(0),
  d200: z.number().int().min(0).default(0),
  d100: z.number().int().min(0).default(0),
  d50: z.number().int().min(0).default(0),
  d20: z.number().int().min(0).default(0),
  d10: z.number().int().min(0).default(0),
  coinsPaise: z.number().int().min(0).default(0),
});
export type CashDenominations = z.infer<typeof CashDenominationsSchema>;

/** Calculate total actual cash paise from denominations object */
export function calculateDenominationsTotalPaise(denoms: CashDenominations | null | undefined): number {
  if (!denoms) return 0;
  return (
    (denoms.d500 || 0) * 50000 +
    (denoms.d200 || 0) * 20000 +
    (denoms.d100 || 0) * 10000 +
    (denoms.d50 || 0) * 5000 +
    (denoms.d20 || 0) * 2000 +
    (denoms.d10 || 0) * 1000 +
    (denoms.coinsPaise || 0)
  );
}

/** Verification of physical cash counted by manager/cashier */
export const DayClosingVerifyCashSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  denominations: CashDenominationsSchema.optional(),
  actualCashPaise: z.number().int().min(0),
  varianceReason: z.string().optional(),
  varianceNote: z.string().optional(),
});
export type DayClosingVerifyCashInput = z.infer<typeof DayClosingVerifyCashSchema>;

/** Commitment / Final closure of a restaurant business day */
export const DayClosingCommitSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualCashPaise: z.number().int().min(0),
  varianceReason: z.string().optional(),
  varianceNote: z.string().optional(),
  denominations: CashDenominationsSchema.optional(),
  tomorrowOpeningCashPaise: z.number().int().min(0),
  tomorrowOption: z.enum(['same', 'entire', 'custom', 'zero']).default('same'),
  cashDepositDestination: z.enum(['bank', 'vault', 'owner_withdrawal', 'petty_cash', 'other']).default('vault'),
  cashDepositAccountId: z.string().optional(),
  cashDepositAccountName: z.string().optional(),
  notes: z.string().optional(),
  managerPin: z.string().optional(),
});
export type DayClosingCommitInput = z.infer<typeof DayClosingCommitSchema>;

/** Reopen an already closed business day (manager authorized) */
export const DayClosingReopenSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3),
  managerPin: z.string().optional(),
});
export type DayClosingReopenInput = z.infer<typeof DayClosingReopenSchema>;

/** Make an audited adjustment after day closing */
export const DayClosingAdjustSchema = z.object({
  closingId: z.string().uuid(),
  reason: z.string().min(3),
  field: z.string(),
  beforeValue: z.any(),
  afterValue: z.any(),
  managerPin: z.string().optional(),
});
export type DayClosingAdjustInput = z.infer<typeof DayClosingAdjustSchema>;

/** Force close an active cashier shift */
export const ForceCloseShiftSchema = z.object({
  shiftId: z.string().uuid(),
  actualCashPaise: z.number().int().min(0),
  varianceReason: z.string().optional(),
  notes: z.string().optional(),
  managerPin: z.string().optional(),
});
export type ForceCloseShiftInput = z.infer<typeof ForceCloseShiftSchema>;
