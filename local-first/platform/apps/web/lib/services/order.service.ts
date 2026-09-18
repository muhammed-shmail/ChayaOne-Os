import crypto from 'crypto';
import { prisma, type Prisma, OrderType, OrderStatus, OrderChannel, KotStatus, TableState, PrintJobType } from '@cafeos/db';
import { computeBill, type BillLine, type CreateOrderInput } from '@cafeos/core';
import { publish, toTicket } from '../realtime';
import { createOutboxEntry } from '../outbox';
import { createPrintJob, processPrintQueueBatch } from '../print/manager';
import { routeOrderToStations } from '../print/router';
import { readKitchenWorkflow } from '../kitchenWorkflow';
import { readReceiptConfig } from '../receipt';
import { readUpiConfig } from '../print/upi';
import { readDevices } from '../devices';
import { applyRecipeConsumption, emitLowStockAlerts } from '../inventory';
import { alertLargeDiscount, alertOrderCancelled } from '../alerts';
import { getOutletGst, gstBillOptions, type GstConfig } from '../tax';
import { getOutletPwa } from '../pwa';
import { findOrCreateCustomerByPhone, accrueLoyaltyOnSettle } from '../customer';
import { reverseWalletHold } from '../wallet';
import { isModuleEnabled } from '../modules';

export interface CreateOrderParams {
  input: CreateOrderInput;
  sessionStaffId: string | null;
  sessionStaffName?: string | null;
  sessionStaffRole?: string | null;
  outletId: string;
  tenantId?: string;
  channel?: OrderChannel;
}

export class OrderService {
  /**
   * Authoritatively creates an order on the Main PC database.
   * Idempotent on input.clientUuid.
   */
  static async createOrder(params: CreateOrderParams) {
    const { input, sessionStaffId, sessionStaffName, outletId, tenantId: paramTenantId, channel = OrderChannel.pos } = params;

    // 1. Idempotency: return existing order if clientUuid has already been committed
    const existing = await prisma.order.findUnique({
      where: { clientUuid: input.clientUuid },
      include: { items: true, payments: true, kots: true, table: { select: { label: true } } },
    });
    if (existing) {
      return { order: existing, bill: null, idempotent: true };
    }

    // 2. Resolve outlet and tenant
    let resolvedTenantId = paramTenantId;
    const outletRecord = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { tenantId: true, name: true, gstin: true, address: true, stateCode: true, settings: true },
    });
    if (!resolvedTenantId) {
      resolvedTenantId = outletRecord?.tenantId ?? '00000000-0000-0000-0000-000000000000';
    }

    // 3. Resolve requested menu items from database (never trust client prices)
    const itemIds = input.lines.map((l) => l.itemId);
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, outletId },
      include: { category: true },
    });
    const dbItemMap = new Map(dbItems.map((i) => [i.id, i]));

    for (const line of input.lines) {
      if (!dbItemMap.has(line.itemId)) {
        throw new Error(`MENU_ITEM_NOT_FOUND:${line.itemId}`);
      }
    }

    // 4. Compute authoritative bill server-side
    const billLines: BillLine[] = input.lines.map((l) => {
      const dbItem = dbItemMap.get(l.itemId)!;
      const catName = dbItem.category?.name?.toLowerCase() ?? '';
      let categoryType = 'food';
      if (
        catName.includes('beverage') ||
        catName.includes('drink') ||
        catName.includes('juice') ||
        catName.includes('coffee') ||
        catName.includes('tea') ||
        catName.includes('soda')
      ) {
        categoryType = 'beverage';
      } else if (catName.includes('combo') || catName.includes('meal')) {
        categoryType = 'combo';
      }

      const tags = dbItem.tags ?? [];
      const taxExempt = tags.includes('tax_exempt') || tags.includes('taxexempt');
      const zeroRated = tags.includes('zero_rated') || tags.includes('zerorated');
      const nilRated = tags.includes('nil_rated') || tags.includes('nilrated');

      const modPaise = (l.modifiers ?? []).reduce((s, m) => s + (m.pricePaise ?? 0), 0);
      return {
        pricePaise: dbItem.pricePaise,
        modPaise,
        gstRate: Number(dbItem.gstRate),
        qty: l.qty,
        categoryType,
        taxExempt,
        zeroRated,
        nilRated,
        hsnCode: dbItem.hsnCode ?? null,
      };
    });

    // Customer lookup or creation if customer details provided
    let resolvedCustomerId: string | null = input.customerId ?? null;
    if (!resolvedCustomerId && input.customer?.phone) {
      resolvedCustomerId = await findOrCreateCustomerByPhone(
        resolvedTenantId,
        {
          name: input.customer.name,
          phone: input.customer.phone,
        }
      );
    }

    // Automatically detect interstate supply
    let interState = !!input.interState;
    if (!interState && resolvedCustomerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: resolvedCustomerId },
        select: { address: true },
      });
      if (outletRecord?.stateCode && customer?.address) {
        const custAddrLower = customer.address.toLowerCase();
        const states = ["AN", "AP", "AR", "AS", "BR", "CH", "CT", "DN", "DD", "DL", "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB"];
        const matchState = states.find(
          (s) =>
            custAddrLower.includes(` ${s.toLowerCase()}`) ||
            custAddrLower.includes(`,${s.toLowerCase()}`) ||
            custAddrLower.includes(s.toLowerCase()),
        );
        if (matchState && matchState.toUpperCase() !== outletRecord.stateCode.toUpperCase()) {
          interState = true;
        }
      }
    }

    const gstConfig = await getOutletGst(outletId);
    const pwaConfig = await getOutletPwa(outletId);

    const bill = computeBill(billLines, {
      discountPct: input.discountPct ?? 0,
      discountFlatPaise: input.discountFlatPaise,
      serviceChargePct: input.serviceChargePct ?? 0,
      deliveryChargePaise: input.deliveryChargePaise,
      packagingChargePaise: input.packagingChargePaise,
      convenienceFeePaise: input.convenienceFeePaise,
      interState,
      ...gstBillOptions(gstConfig, input.type),
    });

    const settling = !!input.payment;
    let touchedStockItemIds: string[] = [];

    // 5. Execute atomic database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Per-outlet sequential order number
      const prev = await tx.order.findFirst({
        where: { outletId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const orderNumber = (prev?.number ?? 100) + 1;

      // Status: Dine-in or direct POS order is in_kitchen; customer QR order is pending_approval
      const status: OrderStatus = channel === OrderChannel.qr ? OrderStatus.pending_approval : OrderStatus.in_kitchen;

      // Stations needing a KOT
      const stations = Array.from(
        new Set(input.lines.map((l) => dbItemMap.get(l.itemId)?.station ?? l.station).filter((s): s is string => !!s)),
      );

      const createdOrder = await tx.order.create({
        data: {
          clientUuid: input.clientUuid,
          number: orderNumber,
          outletId,
          tableId: input.tableId ?? null,
          customerId: resolvedCustomerId,
          staffId: sessionStaffId,
          type: input.type,
          status,
          channel,
          subtotalPaise: bill.subtotalPaise,
          discountPaise: bill.discountPaise,
          cgstPaise: bill.cgstPaise,
          sgstPaise: bill.sgstPaise,
          igstPaise: bill.igstPaise,
          serviceChargePaise: bill.serviceChargePaise,
          roundOffPaise: bill.roundOffPaise,
          totalPaise: bill.totalPaise,
          settledAt: settling ? new Date() : null,
          items: {
            create: [
              ...input.lines.map((l) => {
                const dbItem = dbItemMap.get(l.itemId)!;
                return {
                  itemId: l.itemId,
                  nameSnapshot: dbItem.name,
                  qty: l.qty,
                  unitPricePaise: dbItem.pricePaise,
                  modifiers: (l.modifiers ?? []) as Prisma.InputJsonValue,
                  notes: l.notes ?? null,
                  station: dbItem.station ?? l.station ?? null,
                  kotStatus: status === OrderStatus.pending_approval ? KotStatus.queued : KotStatus.queued,
                };
              }),
              ...(input.deliveryChargePaise && input.deliveryChargePaise > 0
                ? [
                    {
                      itemId: null,
                      nameSnapshot: 'Delivery Charge',
                      qty: 1,
                      unitPricePaise: input.deliveryChargePaise,
                      modifiers: [] as any,
                      notes: null,
                      station: null,
                      kotStatus: KotStatus.served,
                    },
                  ]
                : []),
              ...(input.packagingChargePaise && input.packagingChargePaise > 0
                ? [
                    {
                      itemId: null,
                      nameSnapshot: 'Packaging Charge',
                      qty: 1,
                      unitPricePaise: input.packagingChargePaise,
                      modifiers: [] as any,
                      notes: null,
                      station: null,
                      kotStatus: KotStatus.served,
                    },
                  ]
                : []),
              ...(input.convenienceFeePaise && input.convenienceFeePaise > 0
                ? [
                    {
                      itemId: null,
                      nameSnapshot: 'Convenience Fee',
                      qty: 1,
                      unitPricePaise: input.convenienceFeePaise,
                      modifiers: [] as any,
                      notes: null,
                      station: null,
                      kotStatus: KotStatus.served,
                    },
                  ]
                : []),
            ],
          },
          kots: status !== OrderStatus.pending_approval
            ? {
                create: stations.map((station, idx) => ({
                  outletId,
                  station,
                  number: orderNumber * 10 + idx,
                  status: KotStatus.queued,
                })),
              }
            : undefined,
        },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true, phone: true } },
        },
      });

      // Update table state if tableId attached
      if (input.tableId) {
        await tx.tableMap.update({
          where: { id: input.tableId },
          data: { state: TableState.seated },
        }).catch(() => {});
      }

      // Decrement any daily limits stored in tags
      for (const line of input.lines) {
        const menuItem = await tx.menuItem.findFirst({
          where: { id: line.itemId, outletId },
          select: { id: true, tags: true, isAvailable: true },
        });
        if (menuItem) {
          const limitTag = menuItem.tags.find((t) => t.startsWith('limit:'));
          if (limitTag) {
            const currentLimit = parseInt(limitTag.split(':')[1] ?? '0') || 0;
            const newLimit = Math.max(0, currentLimit - line.qty);
            const otherTags = menuItem.tags.filter((t) => !t.startsWith('limit:'));
            const nextTags = [...otherTags, `limit:${newLimit}`];
            const isAvailable = newLimit > 0;
            await tx.menuItem.update({
              where: { id: menuItem.id },
              data: {
                tags: nextTags,
                isAvailable: isAvailable ? menuItem.isAvailable : false,
              },
            });
          }
        }
      }

      // If immediate payment provided (POS quick checkout / takeaway)
      if (input.payment) {
        await tx.payment.create({
          data: {
            orderId: createdOrder.id,
            outletId,
            method: input.payment.method,
            amountPaise: input.payment.amountPaise,
            status: 'success',
            providerRef: input.payment.providerRef,
            meta: { tipPaise: input.payment.tipPaise } as Prisma.InputJsonValue,
          },
        });

        // Loyalty accrual
        if (resolvedCustomerId) {
          await accrueLoyaltyOnSettle(tx, {
            customerId: resolvedCustomerId,
            outletId,
            totalPaise: bill.totalPaise,
            pwa: pwaConfig,
            refId: createdOrder.id,
          });
        }
      }

      // Generate KOTs and Print Jobs if order is confirmed (not pending approval)
      if (status !== OrderStatus.pending_approval) {
        const kw = readKitchenWorkflow(outletRecord?.settings);

        // Print routing
        if (kw.autoPrintKot || kw.mode !== 'digital') {
          const jobs = routeOrderToStations(
            {
              id: createdOrder.id,
              number: createdOrder.number,
              type: createdOrder.type,
              table: createdOrder.table,
              placedAt: createdOrder.placedAt,
              items: createdOrder.items.map((i) => ({
                nameSnapshot: i.nameSnapshot,
                qty: i.qty,
                station: i.station,
                modifiers: i.modifiers,
                notes: i.notes,
              })),
            },
            outletRecord?.settings
          );

          for (const job of jobs) {
            await createPrintJob(tx, {
              tenantId: resolvedTenantId,
              outletId,
              orderId: createdOrder.id,
              printerId: job.targetDevice?.id ?? null,
              stationId: job.stationId,
              payload: job.payload,
              priority: 0,
            });
          }
        }

        // Inventory: Deduct recipe stock items if inventory module is enabled
        const inventoryEnabled = await isModuleEnabled('inventory', outletId);
        if (inventoryEnabled) {
          touchedStockItemIds = await applyRecipeConsumption(tx, {
            outletId,
            orderId: createdOrder.id,
            lines: createdOrder.items.map((i) => ({ itemId: i.itemId, qty: i.qty })),
          });
        }
      }

      // PrintJob for Receipt Printer when order is settled with payment
      if (input.payment) {
        const rc = readReceiptConfig(outletRecord?.settings);
        const upiConfig = readUpiConfig(outletRecord?.settings, outletRecord?.name || 'Cafe');
        const devices = readDevices(outletRecord?.settings);
        const receiptDevice = devices.find((d) => (d.type === 'receipt_printer' || d.type === 'both_printer') && d.isDefault) ||
          devices.find((d) => d.type === 'receipt_printer' || d.type === 'both_printer') || null;

        await createPrintJob(tx, {
          tenantId: resolvedTenantId,
          outletId,
          jobId: `${createdOrder.id}-receipt`,
          orderId: createdOrder.id,
          printerId: receiptDevice?.id ?? null,
          stationId: 'receipt',
          jobType: PrintJobType.RECEIPT,
          payload: {
            storeName: outletRecord?.name || 'Cafe',
            logoUrl: rc.showLogo ? rc.logoUrl : null,
            header: rc.header,
            footer: rc.footer,
            phone: rc.showPhone ? rc.phone : null,
            gstin: rc.showGstin ? outletRecord?.gstin : null,
            address: rc.showAddress ? outletRecord?.address : null,
            orderNumber: orderNumber,
            tableLabel: createdOrder.table?.label ?? null,
            orderType: input.type,
            placedAt: createdOrder.placedAt,
            settledAt: new Date(),
            items: createdOrder.items.map((it) => ({
              name: it.nameSnapshot,
              qty: it.qty,
              unitPricePaise: it.unitPricePaise,
              totalPaise: it.unitPricePaise * it.qty,
            })),
            subtotalPaise: bill.subtotalPaise,
            discountPaise: bill.discountPaise,
            cgstPaise: bill.cgstPaise,
            sgstPaise: bill.sgstPaise,
            serviceChargePaise: bill.serviceChargePaise,
            roundOffPaise: bill.roundOffPaise,
            totalPaise: bill.totalPaise + (input.payment.tipPaise || 0),
            paymentMethod: input.payment.method,
            isReprint: false,
            paperWidth: rc.paperWidth || '80mm',
            receiptConfig: rc,
            upiConfig,
          } as any,
        });
      }

      // Outbox entry for offline/cloud synchronization
      await createOutboxEntry(tx, {
        tenantId: resolvedTenantId,
        outletId,
        eventId: input.clientUuid,
        entityType: 'Order',
        entityId: createdOrder.id,
        operation: 'CREATE',
        causalGroup: `order:${createdOrder.id}`,
        payload: {
          id: createdOrder.id,
          number: createdOrder.number,
          clientUuid: createdOrder.clientUuid,
          type: createdOrder.type,
          status: createdOrder.status,
          totalPaise: createdOrder.totalPaise,
          items: createdOrder.items,
          bill,
          settling,
        },
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: sessionStaffId,
          action: 'order.created',
          entity: 'order',
          entityId: createdOrder.id,
          after: {
            orderNumber: createdOrder.number,
            totalPaise: createdOrder.totalPaise,
            type: createdOrder.type,
            table: createdOrder.table?.label ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return createdOrder;
    });

    // Background jobs (non-blocking)
    processPrintQueueBatch().catch(() => {});
    if (touchedStockItemIds.length > 0) {
      emitLowStockAlerts(outletId, touchedStockItemIds).catch(() => {});
    }

    if (result.discountPaise > 0) {
      const effPct = bill.subtotalPaise > 0 ? Math.round((bill.discountPaise / bill.subtotalPaise) * 100) : 0;
      alertLargeDiscount(outletId, {
        number: result.number,
        discountPct: effPct,
        discountPaise: result.discountPaise,
      }).catch(() => {});
    }

    // Broadcast realtime event
    const ticket = toTicket(result);
    if (result.status === OrderStatus.pending_approval) {
      await publish(outletId, { type: 'order.pending', ticket });
    } else {
      await publish(outletId, { type: 'order.new', ticket });
    }
    if (input.tableId) {
      await publish(outletId, { type: 'table.updated', tableId: input.tableId, state: 'seated' });
    }

    return { order: result, bill, idempotent: false };
  }

  /**
   * Approves a customer QR order, moving it from pending_approval to in_kitchen.
   */
  static async approveOrder(orderId: string, approverId: string, approverName: string, outletId: string) {
    let touchedStockItemIds: string[] = [];

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: { orderBy: { id: 'asc' } },
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      if (!order || order.outletId !== outletId) {
        throw new Error('ORDER_NOT_FOUND');
      }
      if (order.status !== OrderStatus.pending_approval) {
        throw new Error('ORDER_NOT_PENDING');
      }

      // Stations for KOTs
      const stations = Array.from(
        new Set(order.items.map((i) => i.station).filter((s): s is string => !!s)),
      );

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.in_kitchen,
          approvedById: approverId,
          approvedAt: new Date(),
          kots: {
            create: stations.map((station, idx) => ({
              outletId,
              station,
              number: order.number * 10 + idx,
              status: KotStatus.queued,
            })),
          },
        },
        include: {
          items: { orderBy: { id: 'asc' } },
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      // Update Table state to seated
      if (updated.tableId) {
        await tx.tableMap.update({
          where: { id: updated.tableId },
          data: { state: TableState.seated },
        }).catch(() => {});
      }

      const outletRecord = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { tenantId: true, settings: true },
      });
      const resolvedTenantId = outletRecord?.tenantId ?? '00000000-0000-0000-0000-000000000000';

      // Print routing
      const kw = readKitchenWorkflow(outletRecord?.settings);
      if (kw.autoPrintKot || kw.mode !== 'digital') {
        const jobs = routeOrderToStations(
          {
            id: updated.id,
            number: updated.number,
            type: updated.type,
            table: updated.table,
            placedAt: updated.placedAt,
            items: updated.items.map((i) => ({
              nameSnapshot: i.nameSnapshot,
              qty: i.qty,
              station: i.station,
              modifiers: i.modifiers,
              notes: i.notes,
            })),
          },
          outletRecord?.settings
        );

        for (const job of jobs) {
          await createPrintJob(tx, {
            tenantId: resolvedTenantId,
            outletId,
            jobId: `approve-${updated.id}-${job.stationId}`,
            orderId: updated.id,
            printerId: job.targetDevice?.id ?? null,
            stationId: job.stationId,
            jobType: PrintJobType.KOT,
            payload: job.payload,
            priority: 0,
          });
        }
      }

      // Deduct inventory
      const inventoryEnabled = await isModuleEnabled('inventory', outletId);
      if (inventoryEnabled) {
        touchedStockItemIds = await applyRecipeConsumption(tx, {
          outletId,
          orderId: updated.id,
          lines: updated.items.map((i) => ({ itemId: i.itemId, qty: i.qty })),
        });
      }

      // Clear pending QR notification
      await tx.notification.updateMany({
        where: { entity: 'order', entityId: orderId, type: 'qr_order', readAt: null },
        data: { readAt: new Date() },
      });

      // Outbox entry
      await createOutboxEntry(tx, {
        tenantId: resolvedTenantId,
        outletId,
        entityType: 'Order',
        entityId: updated.id,
        operation: 'UPDATE',
        causalGroup: `order:${updated.id}`,
        payload: {
          orderId: updated.id,
          action: 'approve',
          approvedBy: approverName,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: approverId,
          action: 'order.approved',
          entity: 'order',
          entityId: updated.id,
          after: { approvedBy: approverName } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    processPrintQueueBatch().catch(() => {});
    if (touchedStockItemIds.length > 0) {
      emitLowStockAlerts(outletId, touchedStockItemIds).catch(() => {});
    }

    const ticket = toTicket(result);
    await publish(outletId, { type: 'order.new', ticket });
    if (result.tableId) {
      await publish(outletId, { type: 'table.updated', tableId: result.tableId, state: 'seated' });
    }

    return result;
  }

  /**
   * Rejects/cancels a pending customer QR order.
   */
  static async rejectOrder(orderId: string, rejectorId: string, rejectorName: string, reason: string | null, outletId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: { orderBy: { id: 'asc' } },
          table: { select: { label: true } },
        },
      });

      if (!order || order.outletId !== outletId) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.cancelled,
          approvedById: rejectorId,
          approvedAt: new Date(),
        },
        include: {
          items: { orderBy: { id: 'asc' } },
          table: { select: { label: true } },
        },
      });

      // Clear notification
      await tx.notification.updateMany({
        where: { entity: 'order', entityId: orderId, type: 'qr_order', readAt: null },
        data: { readAt: new Date() },
      });

      const outletRecord = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { tenantId: true },
      });
      const resolvedTenantId = outletRecord?.tenantId ?? '00000000-0000-0000-0000-000000000000';

      await tx.auditLog.create({
        data: {
          outletId,
          actorId: rejectorId,
          action: 'order.rejected',
          entity: 'order',
          entityId: orderId,
          after: { reason: reason ?? null } as Prisma.InputJsonValue,
        },
      });

      await createOutboxEntry(tx, {
        tenantId: resolvedTenantId,
        outletId,
        entityType: 'Order',
        entityId: orderId,
        operation: 'UPDATE',
        causalGroup: `order:${orderId}`,
        payload: { orderId, action: 'reject', reason: reason ?? null },
      });

      return updated;
    });

    await reverseWalletHold(orderId);
    const ticket = toTicket(result as any);
    await publish(outletId, { type: 'order.updated', ticket });
    alertOrderCancelled(outletId, {
      number: result.number,
      by: rejectorName,
      totalPaise: result.totalPaise,
    }).catch(() => {});

    return result;
  }

  /**
   * Updates a pending order item's quantity and recomputes the bill.
   */
  static async updatePendingItem(orderId: string, itemId: string, qty: number, outletId: string, staffId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.outletId !== outletId) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== OrderStatus.pending_approval) throw new Error('ORDER_NOT_PENDING');

    const target = order.items.find((i) => i.id === itemId);
    if (!target) throw new Error('ITEM_NOT_FOUND');

    const gst = await getOutletGst(outletId);
    const nextLines = order.items.map((i) => (i.id === itemId ? { ...i, qty } : i));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.update({ where: { id: itemId }, data: { qty } });
      const bill = await this.recomputePendingBill(tx, order, nextLines, gst);
      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotalPaise: bill.subtotalPaise,
          discountPaise: bill.discountPaise,
          cgstPaise: bill.cgstPaise,
          sgstPaise: bill.sgstPaise,
          igstPaise: bill.igstPaise,
          serviceChargePaise: bill.serviceChargePaise,
          roundOffPaise: bill.roundOffPaise,
          totalPaise: bill.totalPaise,
        },
      });
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: staffId,
          action: 'order.item_qty_changed',
          entity: 'order_item',
          entityId: itemId,
          after: { from: target.qty, to: qty, name: target.nameSnapshot } as Prisma.InputJsonValue,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { orderBy: { id: 'asc' } }, table: { select: { label: true } } },
      });
    });

    return updated;
  }

  /**
   * Deletes a pending order item and recomputes the bill.
   */
  static async deletePendingItem(orderId: string, itemId: string, reason: string, outletId: string, staffId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.outletId !== outletId) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== OrderStatus.pending_approval) throw new Error('ORDER_NOT_PENDING');

    const target = order.items.find((i) => i.id === itemId);
    if (!target) throw new Error('ITEM_NOT_FOUND');

    const remaining = order.items.filter((i) => i.id !== itemId);
    if (remaining.length === 0) {
      throw new Error('LAST_ITEM');
    }

    const gst = await getOutletGst(outletId);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });
      const bill = await this.recomputePendingBill(tx, order, remaining, gst);
      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotalPaise: bill.subtotalPaise,
          discountPaise: bill.discountPaise,
          cgstPaise: bill.cgstPaise,
          sgstPaise: bill.sgstPaise,
          igstPaise: bill.igstPaise,
          serviceChargePaise: bill.serviceChargePaise,
          roundOffPaise: bill.roundOffPaise,
          totalPaise: bill.totalPaise,
        },
      });
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: staffId,
          action: 'order.item_removed',
          entity: 'order_item',
          entityId: itemId,
          after: { name: target.nameSnapshot, qty: target.qty, reason } as Prisma.InputJsonValue,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { orderBy: { id: 'asc' } }, table: { select: { label: true } } },
      });
    });

    return updated;
  }

  private static async recomputePendingBill(
    tx: Prisma.TransactionClient,
    order: { subtotalPaise: number; discountPaise: number; serviceChargePaise: number; igstPaise: number; type: OrderType },
    lines: { itemId: string | null; unitPricePaise: number; qty: number; modifiers: unknown }[],
    gst: GstConfig,
  ) {
    const ids = lines.map((l) => l.itemId).filter((id): id is string => !!id);
    const gstByItem = new Map<string, number>();
    if (ids.length) {
      const mis = await tx.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true, gstRate: true } });
      for (const m of mis) gstByItem.set(m.id, Number(m.gstRate));
    }
    const billLines: BillLine[] = lines.map((l) => ({
      pricePaise: l.unitPricePaise,
      modPaise: Array.isArray(l.modifiers) ? (l.modifiers as { pricePaise: number }[]).reduce((s, m) => s + (m.pricePaise ?? 0), 0) : 0,
      gstRate: (l.itemId && gstByItem.get(l.itemId)) || 0,
      qty: l.qty,
    }));
    const taxable = order.subtotalPaise - order.discountPaise;
    const discountPct = order.subtotalPaise > 0 ? (order.discountPaise / order.subtotalPaise) * 100 : 0;
    const serviceChargePct = taxable > 0 ? (order.serviceChargePaise / taxable) * 100 : 0;
    return computeBill(billLines, { discountPct, serviceChargePct, interState: order.igstPaise > 0, ...gstBillOptions(gst, order.type) });
  }

  /**
   * Updates order progression status (e.g. in_kitchen -> ready -> served).
   */
  static async updateStatus(orderId: string, newStatus: OrderStatus, staffId?: string | null, outletId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        table: { select: { label: true } },
        customer: { select: { name: true } },
      },
    });

    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (outletId && order.outletId !== outletId) throw new Error('FORBIDDEN_OUTLET');

    let itemKotStatus: KotStatus = KotStatus.queued;
    if (newStatus === OrderStatus.in_kitchen) itemKotStatus = KotStatus.preparing;
    if (newStatus === OrderStatus.ready) itemKotStatus = KotStatus.ready;
    if (newStatus === OrderStatus.served) itemKotStatus = KotStatus.served;
    if (newStatus === OrderStatus.cancelled) itemKotStatus = KotStatus.void;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          settledAt: newStatus === OrderStatus.settled ? new Date() : undefined,
        },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      await tx.orderItem.updateMany({
        where: { orderId },
        data: { kotStatus: itemKotStatus },
      });

      return res;
    });

    const ticket = toTicket(updated);
    await publish(order.outletId, { type: 'order.updated', ticket });

    return updated;
  }
}
