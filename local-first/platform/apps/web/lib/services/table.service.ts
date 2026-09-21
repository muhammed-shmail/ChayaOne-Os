import { prisma, type Prisma, TableState } from '@cafeos/db';
import { publish, toTicket } from '../realtime';
import { createOutboxEntry } from '../outbox';
import { createPrintJob, processPrintQueueBatch } from '../print/manager';
import { routeTransferToStations } from '../print/router';
import { readKitchenWorkflow } from '../kitchenWorkflow';

const ACTIVE_STATUS = ['open', 'pending_approval', 'approved', 'in_kitchen', 'ready', 'served'] as const;

export interface TableTransferParams {
  outletId: string;
  fromTableId: string;
  toTableId: string;
  staffId: string | null;
  staffName?: string | null;
  orderId?: string | null;
  reason?: string | null;
}

export interface TableMergeParams {
  outletId: string;
  sourceTableId: string;
  destTableId: string;
  staffId: string | null;
  staffName?: string | null;
  reason?: string | null;
}

export class TableService {
  /**
   * Returns table layout map for outlet with active order details.
   */
  static async getTables(outletId: string) {
    const tables = await prisma.tableMap.findMany({
      where: { outletId },
      orderBy: { label: 'asc' },
      include: {
        orders: {
          where: {
            status: { in: [...ACTIVE_STATUS] },
            settledAt: null,
          },
          select: {
            id: true,
            number: true,
            status: true,
            totalPaise: true,
            placedAt: true,
            customer: { select: { name: true, phone: true } },
            staff: { select: { name: true } },
          },
          orderBy: { placedAt: 'desc' },
          take: 1,
        },
      },
    });

    return tables.map((t) => {
      const activeOrder = t.orders[0] || null;
      return {
        id: t.id,
        label: t.label,
        seats: t.seats,
        state: activeOrder ? 'seated' : t.state,
        qrToken: t.qrToken,
        activeOrder: activeOrder
          ? {
              id: activeOrder.id,
              number: activeOrder.number,
              status: activeOrder.status,
              totalPaise: activeOrder.totalPaise,
              placedAt: activeOrder.placedAt.getTime(),
              customerName: activeOrder.customer?.name ?? null,
              staffName: activeOrder.staff?.name ?? null,
            }
          : null,
      };
    });
  }

  /**
   * Resolve table by secure QR token without exposing database IDs.
   */
  static async resolveTableByQrToken(qrToken: string) {
    const table = await prisma.tableMap.findUnique({
      where: { qrToken },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            settings: true,
          },
        },
      },
    });

    if (!table) return null;

    return {
      tableId: table.id,
      label: table.label,
      seats: table.seats,
      state: table.state,
      outletId: table.outlet.id,
      outletName: table.outlet.name,
      tenantId: table.outlet.tenantId,
      settings: table.outlet.settings,
    };
  }

  /**
   * Atomically transfers active running order(s) from a source table to a destination table.
   * Preserves exact same order ID, number, items, modifiers, notes, KOT records, and bills.
   */
  static async transferTable(params: TableTransferParams) {
    const { outletId, fromTableId, toTableId, staffId, staffName, orderId, reason } = params;

    if (!fromTableId || !toTableId) {
      throw new Error('MISSING_TABLES');
    }
    if (fromTableId === toTableId) {
      throw new Error('SAME_TABLE');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and verify both tables exist in this outlet
      const [fromTable, toTable] = await Promise.all([
        tx.tableMap.findFirst({ where: { id: fromTableId, outletId } }),
        tx.tableMap.findFirst({ where: { id: toTableId, outletId } }),
      ]);

      if (!fromTable || !toTable) {
        throw new Error('TABLE_NOT_FOUND');
      }

      // 2. Fetch active running order(s) on source table
      const activeOrders = await tx.order.findMany({
        where: {
          outletId,
          tableId: fromTableId,
          status: { in: [...ACTIVE_STATUS] },
          settledAt: null,
          ...(orderId ? { id: orderId } : {}),
        },
        include: {
          items: { where: { kotStatus: { not: 'void' } } },
          customer: { select: { name: true, phone: true } },
        },
      });

      if (activeOrders.length === 0) {
        throw new Error('NO_ACTIVE_ORDER');
      }

      // 3. Verify destination table is NOT occupied by active orders
      const destOrders = await tx.order.findMany({
        where: {
          outletId,
          tableId: toTableId,
          status: { in: [...ACTIVE_STATUS] },
          settledAt: null,
        },
        select: { id: true, number: true },
      });

      if (destOrders.length > 0) {
        throw new Error(`DESTINATION_OCCUPIED:${toTable.label}`);
      }

      // 4. Update the order's tableId to destination table
      const orderIds = activeOrders.map((o) => o.id);
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { tableId: toTableId },
      });

      // 5. Update TableMap state flags
      const remainingOnFrom = await tx.order.count({
        where: {
          outletId,
          tableId: fromTableId,
          id: { notIn: orderIds },
          status: { in: [...ACTIVE_STATUS] },
          settledAt: null,
        },
      });

      if (remainingOnFrom === 0) {
        await tx.tableMap.update({ where: { id: fromTableId }, data: { state: TableState.free } });
      }
      await tx.tableMap.update({ where: { id: toTableId }, data: { state: TableState.seated } });

      // 6. Resolve safe staff ID for relational tables
      let validStaffId: string | null = null;
      if (staffId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) {
        const staffExists = await tx.staffUser.findUnique({ where: { id: staffId }, select: { id: true } });
        if (staffExists) {
          validStaffId = staffId;
        }
      }

      // 6. Record TableTransfer ledger entries
      for (const o of activeOrders) {
        await tx.tableTransfer.create({
          data: {
            outletId,
            orderId: o.id,
            fromTableId,
            toTableId,
            transferredBy: validStaffId,
            reason: reason?.trim() || null,
          },
        }).catch((err) => {
          console.warn('[TABLE TRANSFER LEDGER WARN]', err);
        });
      }

      // 7. Record in AuditLog ledger
      for (const o of activeOrders) {
        await tx.auditLog.create({
          data: {
            outletId,
            actorId: validStaffId,
            action: 'table.transferred',
            entity: 'table',
            entityId: toTableId,
            before: {
              tableId: fromTableId,
              tableLabel: fromTable.label,
              orderId: o.id,
              orderNumber: o.number,
            },
            after: {
              tableId: toTableId,
              tableLabel: toTable.label,
              orderId: o.id,
              orderNumber: o.number,
              transferredBy: staffName ?? 'Staff',
              reason: reason?.trim() || null,
            },
          },
        }).catch((err) => {
          console.warn('[AUDIT LOG WARN]', err);
        });
      }

      // 8. Create SyncOutbox entries for offline/cloud replication
      const outletObj = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { tenantId: true, settings: true },
      });
      const resolvedTenantId = outletObj?.tenantId ?? '00000000-0000-0000-0000-000000000000';

      for (const o of activeOrders) {
        await createOutboxEntry(tx, {
          tenantId: resolvedTenantId,
          outletId,
          entityType: 'TableTransfer',
          entityId: o.id,
          operation: 'CREATE',
          causalGroup: `order:${o.id}`,
          payload: {
            orderId: o.id,
            orderNumber: o.number,
            fromTableId,
            fromTableLabel: fromTable.label,
            toTableId,
            toTableLabel: toTable.label,
            transferredBy: validStaffId,
            transferredByName: staffName ?? null,
            reason: reason?.trim() || null,
          },
        }).catch((err) => {
          console.warn('[OUTBOX WARN]', err);
        });
      }

      // 9. Generate dedicated KOT print job(s) for table transfer notification
      const kw = readKitchenWorkflow(outletObj?.settings);
      if (kw.autoPrintKot || kw.mode !== 'digital') {
        for (const o of activeOrders) {
          const transferJobs = routeTransferToStations(
            {
              id: o.id,
              number: o.number,
              type: o.type,
              items: o.items,
            },
            fromTable.label,
            toTable.label,
            staffName ?? null,
            outletObj?.settings
          );

          for (const job of transferJobs) {
            try {
              await createPrintJob(tx, {
                tenantId: resolvedTenantId,
                outletId,
                jobId: crypto.randomUUID(),
                orderId: o.id,
                printerId: job.targetDevice?.id ?? null,
                stationId: job.stationId,
                payload: job.payload,
                priority: 1,
              });
            } catch (printErr) {
              console.warn('[TABLE TRANSFER PRINT WARN]', printErr);
            }
          }
        }
      }

      // 10. Query updated order representations
      const updatedOrders = await tx.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          items: true,
          table: { select: { label: true } },
          customer: { select: { name: true } },
        },
      });

      return { fromTable, toTable, updatedOrders };
    });

    // Background jobs
    processPrintQueueBatch().catch(() => {});

    // Broadcast realtime notifications
    for (const order of result.updatedOrders) {
      const ticket = toTicket(order);
      await publish(outletId, {
        type: 'table.transferred',
        transfer: {
          orderId: order.id,
          orderNumber: order.number,
          fromTableId,
          toTableId,
          fromTableLabel: result.fromTable.label,
          toTableLabel: result.toTable.label,
          newTableStatus: 'occupied',
          transferredBy: staffName ?? 'Staff',
          timestamp: Date.now(),
          reason: reason?.trim() || null,
        },
        ticket,
      });

      await publish(outletId, { type: 'order.updated', ticket });
    }

    return result;
  }
}
