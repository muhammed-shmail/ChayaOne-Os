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
