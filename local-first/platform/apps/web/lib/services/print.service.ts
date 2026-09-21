import { prisma, PrintJobStatus, PrintJobType, type Prisma } from '@cafeos/db';
import { createPrintJob, processPrintQueueBatch } from '../print/manager';
import { sendNetworkPrintJob } from '../print/network';
import { readDevices } from '../devices';

export class PrintService {
  /**
   * Enqueues a print job in the database.
   */
  static async enqueueJob(params: {
    tenantId: string;
    outletId: string;
    orderId?: string | null;
    kotId?: string | null;
    printerId?: string | null;
    stationId?: string | null;
    jobType?: PrintJobType;
    payload: any;
    priority?: number;
  }) {
    const job = await prisma.$transaction(async (tx) => {
      return await createPrintJob(tx, params);
    });

    // Fire queue batch in background
    processPrintQueueBatch().catch(() => {});
    return job;
  }

  /**
   * Triggers background processing of pending/queued print jobs.
   */
  static async processQueue(batchSize = 10) {
    return await processPrintQueueBatch(batchSize);
  }

  /**
   * Returns current print queue statistics.
   */
  static async getQueueStats(outletId?: string) {
    const where = outletId ? { outletId } : {};
    const [queued, printing, printed, failed] = await Promise.all([
      prisma.printJob.count({ where: { ...where, status: PrintJobStatus.QUEUED } }),
      prisma.printJob.count({ where: { ...where, status: PrintJobStatus.PRINTING } }),
      prisma.printJob.count({ where: { ...where, status: PrintJobStatus.PRINTED } }),
      prisma.printJob.count({ where: { ...where, status: PrintJobStatus.FAILED } }),
    ]);

    return { queued, printing, printed, failed };
  }

  /**
   * Reprints an existing print job.
   */
  static async reprintJob(jobId: string, outletId: string) {
    const job = await prisma.printJob.findFirst({
      where: { jobId, outletId },
    });
    if (!job) throw new Error('PRINT_JOB_NOT_FOUND');

    const newJob = await prisma.printJob.create({
      data: {
        tenantId: job.tenantId,
        outletId: job.outletId,
        jobId: crypto.randomUUID(),
        orderId: job.orderId,
        kotId: job.kotId,
        printerId: job.printerId,
        stationId: job.stationId,
        jobType: PrintJobType.REPRINT,
        payload: job.payload as Prisma.InputJsonValue,
        status: PrintJobStatus.QUEUED,
        priority: 2,
      },
    });

    processPrintQueueBatch().catch(() => {});
    return newJob;
  }

  /**
   * Tests connection to a physical LAN thermal printer (e.g. 192.168.1.200:9100).
   */
  static async testPrinterConnection(host: string, port = 9100) {
    // ESC/POS Test Ticket
    const initCmd = Buffer.from([0x1b, 0x40]); // ESC @ (initialize)
    const alignCenter = Buffer.from([0x1b, 0x61, 0x01]); // ESC a 1 (center)
    const text = Buffer.from('*** CHAYAONE OS ***\nTEST PRINT OK\nLAN PRINTER CONNECTED\n\n\n\n\n', 'utf8');
    const cutCmd = Buffer.from([0x1d, 0x56, 0x41, 0x10]); // GS V A (cut)

    const testPayload = Buffer.concat([initCmd, alignCenter, text, cutCmd]);

    return await sendNetworkPrintJob(testPayload, { host, port });
  }
}
