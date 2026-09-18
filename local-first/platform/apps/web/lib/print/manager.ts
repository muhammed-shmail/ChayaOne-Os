import crypto from 'crypto';
import { prisma, type Prisma, PrintJobStatus, PrintJobType } from '@cafeos/db';
import { buildKotEscposBuffer, buildReceiptEscposBuffer, type KotPrintPayload, type ReceiptPrintPayload } from './escpos';
import { sendNetworkPrintJob } from './network';
import { readDevices } from '../devices';
import { readReceiptConfig } from '../receipt';
import { readUpiConfig } from './upi';

export interface CreatePrintJobParams {
  tenantId: string;
  outletId: string;
  jobId?: string;
  orderId?: string | null;
  kotId?: string | null;
  printerId?: string | null;
  stationId?: string | null;
  jobType?: PrintJobType;
  payload: KotPrintPayload | ReceiptPrintPayload | Record<string, any>;
  priority?: number;
}

let isProcessingQueue = false;
let queueWorkerInterval: NodeJS.Timeout | null = null;

/**
 * Atomically create a PrintJob entry in the database.
 */
export async function createPrintJob(
  tx: Prisma.TransactionClient,
  params: CreatePrintJobParams,
) {
  const jobId = params.jobId || crypto.randomUUID();
  const jobType = params.jobType || PrintJobType.KOT;

  return await tx.printJob.create({
    data: {
      tenantId: params.tenantId,
      outletId: params.outletId,
      jobId,
      orderId: params.orderId ?? null,
      kotId: params.kotId ?? null,
      printerId: params.printerId ?? null,
      stationId: params.stationId ?? null,
      jobType,
      payload: params.payload as Prisma.InputJsonValue,
      status: PrintJobStatus.QUEUED,
      priority: params.priority || 0,
    },
  });
}

/**
 * Process pending print queue items.
 */
export async function processPrintQueueBatch(batchSize = 10) {
  if (isProcessingQueue) return { processed: 0, printed: 0, failed: 0 };
  isProcessingQueue = true;

  let processedCount = 0;
  let printedCount = 0;
  let failedCount = 0;

  try {
    const jobs = await prisma.printJob.findMany({
      where: {
        status: { in: [PrintJobStatus.QUEUED, PrintJobStatus.FAILED] },
        availableAt: { lte: new Date() },
      },
      orderBy: [{ priority: 'desc' }, { sequenceNo: 'asc' }],
      take: batchSize,
    });

    if (jobs.length === 0) {
      return { processed: 0, printed: 0, failed: 0 };
    }

    for (const job of jobs) {
      processedCount++;

      // Lock job into PRINTING state
      await prisma.printJob.update({
        where: { id: job.id },
        data: { status: PrintJobStatus.PRINTING, startedAt: new Date() },
      });

      try {
        // Fetch outlet settings to resolve physical device parameters
        const outlet = await prisma.outlet.findUnique({
          where: { id: job.outletId },
          select: { name: true, settings: true },
        });

        const devices = readDevices(outlet?.settings);
        let targetDevice = devices.find((d) => d.id === job.printerId) || null;

        // Determine if this is a receipt or bill job
        const isReceiptJob =
          job.jobType === PrintJobType.RECEIPT ||
          job.jobType === PrintJobType.BILL_PREVIEW ||
          (job.jobType === PrintJobType.REPRINT &&
            Boolean(
              (job.payload as any)?.subtotalPaise !== undefined ||
              (job.payload as any)?.totalPaise !== undefined ||
              (job.payload as any)?.lines ||
              (job.payload as any)?.items
            ));

        // If no explicit device assigned, pick default for jobType / station
        if (!targetDevice) {
          if (isReceiptJob) {
            targetDevice =
              devices.find((d) => (d.type === 'receipt_printer' || d.type === 'both_printer') && d.isDefault) ||
              devices.find((d) => d.type === 'receipt_printer' || d.type === 'both_printer') ||
              null;
          } else {
            targetDevice =
              devices.find((d) => (d.type === 'kot_printer' || d.type === 'both_printer') && d.station === job.stationId) ||
              devices.find((d) => d.type === 'kot_printer' || d.type === 'both_printer') ||
              null;
          }
        }

        // Build ESC/POS binary buffer payload
        let escposBuffer: Buffer;
        if (isReceiptJob) {
          const receiptPayload = { ...(job.payload as unknown as ReceiptPrintPayload) };
          if (job.jobType === PrintJobType.REPRINT || job.attempts > 0) {
            receiptPayload.isReprint = true;
          }
          const receiptConfig = readReceiptConfig(outlet?.settings);
          const upiConfig = readUpiConfig(outlet?.settings, outlet?.name || 'Chaya Cafe');
          receiptPayload.receiptConfig = { ...receiptConfig, ...receiptPayload.receiptConfig };
          receiptPayload.upiConfig = { ...upiConfig, ...receiptPayload.upiConfig };
          if (!receiptPayload.storeName) {
            receiptPayload.storeName = outlet?.name || 'CHAYA CAFE';
          }
          if (receiptPayload.logoUrl === undefined || receiptPayload.logoUrl === null) {
            receiptPayload.logoUrl = receiptConfig.logoUrl;
          }
          escposBuffer = buildReceiptEscposBuffer(receiptPayload);
        } else {
          const kotPayload = { ...(job.payload as unknown as KotPrintPayload) };
          if (job.attempts > 0) {
            kotPayload.isReprint = true;
          }
          escposBuffer = buildKotEscposBuffer(kotPayload);
        }

        // Primary LAN / Network Printing Architecture (Main PC ➔ Cafe LAN ➔ Printer IP ➔ TCP:9100 ➔ ESC/POS)
        if (targetDevice && targetDevice.target) {
          const parts = targetDevice.target.split(':');
          const host = parts[0]?.trim() || '127.0.0.1';
          const port = parseInt(parts[1] || '9100', 10);
          console.log(`[LAN PRINT ENGINE] Main PC ➔ Cafe LAN ➔ Printer IP (${host}:${port}) ➔ ESC/POS ${job.jobType} Ticket`);
          await sendNetworkPrintJob(escposBuffer, { host, port });
        } else {
          console.log(`[LAN PRINT ENGINE] Completed Virtual ${job.jobType} Job #${job.id} (Device: ${targetDevice?.name || 'Network Printer'})`);
        }

        // Mark as successfully PRINTED
        await prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: PrintJobStatus.PRINTED,
            printedAt: new Date(),
            lastError: null,
          },
        });
        printedCount++;
      } catch (err: any) {
        failedCount++;
        const attempts = job.attempts + 1;
        const errorMsg = err?.message || 'Print execution failed';
        const isMax = attempts >= job.maxAttempts;

        // Check if backup printer fallback is available
        const outlet = await prisma.outlet.findUnique({
          where: { id: job.outletId },
          select: { settings: true },
        });
        const devices = readDevices(outlet?.settings);
        const isReceipt =
          job.jobType === PrintJobType.RECEIPT ||
          job.jobType === PrintJobType.BILL_PREVIEW ||
          (job.jobType === PrintJobType.REPRINT &&
            Boolean((job.payload as any)?.totalPaise !== undefined || (job.payload as any)?.lines || (job.payload as any)?.items));

        const backupDevice = isReceipt
          ? devices.find((d) => d.type === 'receipt_printer' && d.id !== job.printerId)
          : devices.find((d) => d.type === 'kot_printer' && d.id !== job.printerId);

        await prisma.printJob.update({
          where: { id: job.id },
          data: {
            attempts,
            status: isMax ? PrintJobStatus.FAILED : PrintJobStatus.QUEUED,
            printerId: backupDevice ? backupDevice.id : job.printerId, // Fallback to backup printer if primary failed
            availableAt: isMax ? new Date('2099-01-01') : new Date(Date.now() + Math.pow(2, attempts) * 2000),
            failedAt: isMax ? new Date() : null,
            lastError: errorMsg.slice(0, 500),
          },
        });
      }
    }
  } catch (err) {
    console.error('[PRINT QUEUE MANAGER ERROR]', err);
  } finally {
    isProcessingQueue = false;
  }

  return { processed: processedCount, printed: printedCount, failed: failedCount };
}

/**
 * Start the autonomous local print queue background loop.
 */
export function startPrintQueueWorker(intervalMs = 5000) {
  if (queueWorkerInterval) return;

  queueWorkerInterval = setInterval(async () => {
    try {
      await processPrintQueueBatch();
    } catch (err) {
      console.error('[PRINT WORKER LOOP ERROR]', err);
    }
  }, intervalMs);
}

/**
 * Stop the local print queue background loop.
 */
export function stopPrintQueueWorker() {
  if (queueWorkerInterval) {
    clearInterval(queueWorkerInterval);
    queueWorkerInterval = null;
  }
}
