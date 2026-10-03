import { prisma, KotStatus, PrintJobType, type Prisma } from '@cafeos/db';
import { createPrintJob, processPrintQueueBatch } from '../print/manager';
import { routeOrderToStations } from '../print/router';

export class KOTService {
  /**
   * Fetches all KOTs for an outlet with optional status filter.
   */
  static async getKots(outletId: string, status?: KotStatus) {
    return await prisma.kot.findMany({
      where: {
        outletId,
        ...(status ? { status } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            number: true,
            type: true,
            table: { select: { label: true } },
            staff: { select: { name: true } },
            items: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Modifies a KOT status (e.g. queued -> preparing -> ready -> served / void).
   */
  static async updateKotStatus(kotId: string, status: KotStatus, outletId: string) {
    const kot = await prisma.kot.findUnique({
      where: { id: kotId },
    });
    if (!kot || kot.outletId !== outletId) throw new Error('KOT_NOT_FOUND');

    return await prisma.kot.update({
      where: { id: kotId },
      data: { status },
    });
  }

  /**
   * Reprints a KOT ticket to its designated station printer.
   */
  static async reprintKot(kotId: string, outletId: string) {
    const kot = await prisma.kot.findUnique({
      where: { id: kotId },
      include: {
        order: {
          include: {
            table: { select: { label: true } },
            items: true,
          },
        },
        outlet: { select: { tenantId: true, settings: true } },
      },
    });

    if (!kot || kot.outletId !== outletId) throw new Error('KOT_NOT_FOUND');

    const resolvedTenantId = kot.outlet.tenantId ?? '00000000-0000-0000-0000-000000000000';
    const stationItems = kot.order.items.filter(
      (i) => (i.station?.trim().toLowerCase() || 'kitchen') === kot.station.toLowerCase()
    );

    const jobs = routeOrderToStations(
      {
        id: kot.order.id,
        number: kot.order.number,
        table: kot.order.table,
        type: kot.order.type,
        placedAt: kot.order.placedAt,
        items: stationItems.map((i) => ({
          nameSnapshot: i.nameSnapshot,
          qty: i.qty,
          station: i.station,
          modifiers: i.modifiers,
          notes: i.notes,
        })),
      },
      kot.outlet.settings
    );

    const createdPrintJobs: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const job of jobs) {
        if (job.stationId === kot.station) {
          const pj = await createPrintJob(tx, {
            tenantId: resolvedTenantId,
            outletId,
            orderId: kot.order.id,
            kotId: kot.id,
            printerId: job.targetDevice?.id ?? null,
            stationId: job.stationId,
            jobType: PrintJobType.REPRINT,
            payload: { ...job.payload, isReprint: true },
            priority: 1,
          });
          createdPrintJobs.push(pj);
        }
      }
    });

    processPrintQueueBatch().catch(() => {});
    return createdPrintJobs;
  }
}
