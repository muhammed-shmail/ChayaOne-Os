import { prisma, type Prisma } from '@cafeos/db';
import { applyRecipeConsumption, emitLowStockAlerts } from '../inventory';

export class InventoryService {
  /**
   * Returns current stock item inventory list for outlet.
   */
  static async getStockItems(outletId: string) {
    return await prisma.stockItem.findMany({
      where: { outletId },
      orderBy: { name: 'asc' },
      include: {
        recipes: { select: { item: { select: { id: true, name: true } } } },
      },
    });
  }

  /**
   * Records a manual stock purchase / receipt.
   */
  static async recordPurchase(
    outletId: string,
    stockItemId: string,
    qty: number,
    unitCostPaise: number,
    staffId?: string | null
  ) {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item || item.outletId !== outletId) throw new Error('STOCK_ITEM_NOT_FOUND');

      const updated = await tx.stockItem.update({
        where: { id: stockItemId },
        data: {
          qtyOnHand: { increment: qty },
          avgCostPaise: unitCostPaise > 0 ? unitCostPaise : undefined,
        },
      });

      await tx.stockLedger.create({
        data: {
          outletId,
          stockItemId,
          change: qty,
          reason: 'purchase',
        },
      });

      if (staffId) {
        await tx.auditLog.create({
          data: {
            outletId,
            actorId: staffId,
            action: 'inventory.purchase',
            entity: 'stock_item',
            entityId: stockItemId,
            after: { qty, newQtyOnHand: updated.qtyOnHand },
          },
        }).catch(() => {});
      }

      return updated;
    });
  }

  /**
   * Logs waste / spoilage / breakage.
   */
  static async logWaste(
    outletId: string,
    stockItemId: string,
    qty: number,
    reason: string,
    staffId?: string | null
  ) {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item || item.outletId !== outletId) throw new Error('STOCK_ITEM_NOT_FOUND');

      const updated = await tx.stockItem.update({
        where: { id: stockItemId },
        data: {
          qtyOnHand: { decrement: qty },
        },
      });

      await tx.stockLedger.create({
        data: {
          outletId,
          stockItemId,
          change: -qty,
          reason: 'waste',
        },
      });

      await tx.wasteLog.create({
        data: {
          outletId,
          stockItemId,
          qty,
          reason,
          loggedBy: staffId ?? undefined,
        },
      });

      return updated;
    });
  }

  /**
   * Consumes recipe ingredients for ordered dishes.
   */
  static async consumeForOrder(
    tx: Prisma.TransactionClient,
    outletId: string,
    lines: { itemId?: string | null; qty: number }[],
    orderId: string
  ) {
    return await applyRecipeConsumption(tx, { outletId, orderId, lines });
  }

  /**
   * Triggers low stock alert checks for touched stock items.
   */
  static async checkLowStock(outletId: string, stockItemIds: string[]) {
    return await emitLowStockAlerts(outletId, stockItemIds);
  }
}
