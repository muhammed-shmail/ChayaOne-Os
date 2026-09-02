/**
 * @cafeos/validation — Shared Zod validation schemas for ChayaOne OS.
 */
import { z } from 'zod';

export const StationEnum = z.enum(['kitchen', 'bar', 'dessert']);
export const StationSchema = z.string().min(1).max(40);
export const OrderTypeEnum = z.enum(['dine_in', 'takeaway', 'delivery']);
export const PayMethodEnum = z.enum(['cash', 'card', 'upi', 'wallet', 'points']);

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

export const CreateOrderSchema = z.object({
  clientUuid: z.string().uuid(),
  outletId: z.string().uuid(),
  type: OrderTypeEnum,
  tableId: z.string().uuid().nullish(),
  customerId: z.string().uuid().nullish(),
  customer: z
    .object({
      name: z.string().max(60).optional(),
      phone: z.string().max(20).optional(),
    })
    .nullish(),
  staffId: z.string().uuid().nullish(),
  lines: z.array(CartLineSchema).min(1),
  discountPct: z.number().min(0).max(100).default(0),
  discountFlatPaise: z.number().int().min(0).default(0),
  serviceChargePct: z.number().min(0).max(100).default(0),
  deliveryChargePaise: z.number().int().min(0).default(0),
  packagingChargePaise: z.number().int().min(0).default(0),
  convenienceFeePaise: z.number().int().min(0).default(0),
  interState: z.boolean().default(false),
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

export const AdvanceOrderSchema = z.object({
  status: z.enum(['open', 'in_kitchen', 'ready', 'served', 'settled', 'cancelled']),
});

export const TableTransferSchema = z.object({
  sourceTableId: z.string().uuid(),
  destTableId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

export const TableMergeSchema = z.object({
  sourceTableId: z.string().uuid(),
  destTableId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

export const TableSplitSchema = z.object({
  orderId: z.string().uuid(),
  itemSplits: z.array(
    z.object({
      orderItemId: z.string().uuid(),
      qtyToSplit: z.number().int().positive(),
    })
  ).min(1),
  targetTableId: z.string().uuid().optional(),
  reason: z.string().max(200).optional(),
});

export const AssistanceRequestSchema = z.object({
  t: z.string().min(1),
  requestType: z.enum(['call_waiter', 'assistance', 'water', 'bill']),
  notes: z.string().max(200).optional(),
});

export const FeedbackSubmissionSchema = z.object({
  t: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string()).max(10).optional(),
  comments: z.string().max(500).optional(),
});
