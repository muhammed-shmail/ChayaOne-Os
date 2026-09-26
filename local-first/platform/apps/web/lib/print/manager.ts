import crypto from 'crypto';
import { prisma, type Prisma, PrintJobStatus, PrintJobType } from '@cafeos/db';
import { buildKotEscposBuffer, buildReceiptEscposBuffer, type KotPrintPayload, type ReceiptPrintPayload } from './escpos';
import { sendNetworkPrintJob } from './network';
import { readDevices } from '../devices';
import { readReceiptConfig } from '../receipt';
import { readUpiConfig } from './upi';
import { resolveReceiptPrinter } from './router';
import { readWaiterStations, isStationMatch } from '../waiter-stations';

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
let hasPendingQueueTrigger = false;
let queueWorkerInterval: NodeJS.Timeout | null = null;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeUuid(val?: string | null): string | null {
  if (typeof val === 'string' && UUID_REGEX.test(val)) return val;
  return null;
}

/**
 * Atomically create a PrintJob entry in the database.
 */
export async function createPrintJob(
  tx: Prisma.TransactionClient,
  params: CreatePrintJobParams,
) {
  const jobId = safeUuid(params.jobId) || crypto.randomUUID();
  const jobType = params.jobType || PrintJobType.KOT;

  // Ensure background queue worker is running to process this job
  startPrintQueueWorker(1500);

  return await tx.printJob.create({
    data: {
      tenantId: params.tenantId,
      outletId: params.outletId,
      jobId,
      orderId: safeUuid(params.orderId),
      kotId: safeUuid(params.kotId),
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
 * Process pending print queue items with continuous drain loop.
 * Guarantees that concurrent jobs (e.g. P2 bill while P1 or KOT is in-flight) are never dropped.
 */
export async function processPrintQueueBatch(batchSize = 10) {
  if (isProcessingQueue) {
    hasPendingQueueTrigger = true;
    return { processed: 0, printed: 0, failed: 0 };
  }
  isProcessingQueue = true;

  let totalProcessed = 0;
  let totalPrinted = 0;
  let totalFailed = 0;

  try {
    while (true) {
      hasPendingQueueTrigger = false;

      const jobs = await prisma.printJob.findMany({
        where: {
          status: { in: [PrintJobStatus.QUEUED, PrintJobStatus.FAILED] },
          availableAt: { lte: new Date() },
        },
        orderBy: [{ priority: 'desc' }, { sequenceNo: 'asc' }],
        take: batchSize,
      });

      if (jobs.length === 0) {
        break;
      }

      for (const job of jobs) {
        totalProcessed++;

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

          // For bill preview & receipt jobs: if a waiter station is set, guarantee it routes to that station's printer
          if (isReceiptJob && job.stationId) {
            const stations = readWaiterStations(outlet?.settings);
            if (!targetDevice || !isStationMatch(targetDevice.station, job.stationId, stations)) {
              const stationDevice = resolveReceiptPrinter(outlet?.settings, job.stationId);
              if (stationDevice) {
                targetDevice = stationDevice;
              }
            }
          }

          // If no explicit device assigned, pick default for jobType / station
          if (!targetDevice) {
            if (isReceiptJob) {
              targetDevice = resolveReceiptPrinter(outlet?.settings, job.stationId);
            } else {
              const stations = readWaiterStations(outlet?.settings);
              targetDevice =
                devices.find((d) => (d.type === 'kot_printer' || d.type === 'both_printer') && isStationMatch(d.station, job.stationId, stations)) ||
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
            if (job.jobType === PrintJobType.BILL_PREVIEW) {
              receiptPayload.isBillPreview = true;
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
          const targetHost = targetDevice?.ip || targetDevice?.target?.split(':')[0]?.trim() || '';
          const targetPort = targetDevice?.port
            ? parseInt(String(targetDevice.port), 10)
            : targetDevice?.target?.split(':')[1]
            ? parseInt(targetDevice.target.split(':')[1] || '9100', 10)
            : 9100;

          if (targetDevice && targetHost) {
            console.log(`[LAN PRINT ENGINE] Main PC ➔ Cafe LAN ➔ Printer "${targetDevice.name}" (${targetHost}:${targetPort}) ➔ ESC/POS ${job.jobType} Ticket`);
            await sendNetworkPrintJob(escposBuffer, { host: targetHost, port: targetPort });
          } else if (targetDevice && targetDevice.target) {
            const parts = targetDevice.target.split(':');
            const host = parts[0]?.trim() || '127.0.0.1';
            const port = parseInt(parts[1] || '9100', 10);
            console.log(`[LAN PRINT ENGINE] Main PC ➔ Cafe LAN ➔ Printer "${targetDevice.name}" (${host}:${port}) ➔ ESC/POS ${job.jobType} Ticket`);
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
          totalPrinted++;
        } catch (err: any) {
          totalFailed++;
          const attempts = job.attempts + 1;
          const errorMsg = err?.message || 'Print execution failed';
          const isMax = attempts >= job.maxAttempts;

          // Check if backup printer fallback is available (strictly within the SAME station to prevent cross-station leakage)
          const outlet = await prisma.outlet.findUnique({
            where: { id: job.outletId },
            select: { settings: true },
          });
          const devices = readDevices(outlet?.settings);
          const stations = readWaiterStations(outlet?.settings);
          const isReceipt =
            job.jobType === PrintJobType.RECEIPT ||
            job.jobType === PrintJobType.BILL_PREVIEW ||
            (job.jobType === PrintJobType.REPRINT &&
              Boolean((job.payload as any)?.totalPaise !== undefined || (job.payload as any)?.lines || (job.payload as any)?.items));

          const backupDevice = isReceipt
            ? (job.stationId
                ? devices.find((d) => (d.type === 'receipt_printer' || d.type === 'both_printer') && d.id !== job.printerId && isStationMatch(d.station, job.stationId, stations))
                : devices.find((d) => (d.type === 'receipt_printer' || d.type === 'both_printer') && d.id !== job.printerId))
            : (job.stationId
                ? devices.find((d) => (d.type === 'kot_printer' || d.type === 'both_printer') && d.id !== job.printerId && isStationMatch(d.station, job.stationId, stations))
                : devices.find((d) => (d.type === 'kot_printer' || d.type === 'both_printer') && d.id !== job.printerId));

          await prisma.printJob.update({
            where: { id: job.id },
            data: {
              attempts,
              status: isMax ? PrintJobStatus.FAILED : PrintJobStatus.QUEUED,
              printerId: backupDevice ? backupDevice.id : job.printerId,
              availableAt: isMax ? new Date('2099-01-01') : new Date(Date.now() + Math.pow(2, attempts) * 2000),
              failedAt: isMax ? new Date() : null,
              lastError: errorMsg.slice(0, 500),
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('[PRINT QUEUE MANAGER ERROR]', err);
  } finally {
    isProcessingQueue = false;
    // If a trigger arrived while we were processing, immediately re-arm the loop
    if (hasPendingQueueTrigger) {
      hasPendingQueueTrigger = false;
      setImmediate(() => {
        processPrintQueueBatch(batchSize).catch((e) => console.error('[PRINT QUEUE DRAIN ERROR]', e));
      });
    }
  }

  return { processed: totalProcessed, printed: totalPrinted, failed: totalFailed };
}

/**
 * Start the autonomous local print queue background loop.
 */
export function startPrintQueueWorker(intervalMs = 1500) {
  if (typeof window !== 'undefined') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if ((globalThis as any).__cafeos_print_worker_started) return;
  (globalThis as any).__cafeos_print_worker_started = true;

  if (queueWorkerInterval) return;

  queueWorkerInterval = setInterval(async () => {
    try {
      await processPrintQueueBatch();
    } catch (err) {
      console.error('[PRINT WORKER LOOP ERROR]', err);
    }
  }, intervalMs);

  if (queueWorkerInterval && typeof queueWorkerInterval.unref === 'function') {
    queueWorkerInterval.unref();
  }
}

/**
 * Stop the local print queue background loop.
 */
export function stopPrintQueueWorker() {
  if (queueWorkerInterval) {
    clearInterval(queueWorkerInterval);
    queueWorkerInterval = null;
  }
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__cafeos_print_worker_started = false;
  }
}

// Auto-start worker in server runtime environment so pending/queued print jobs never get stranded
if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  startPrintQueueWorker(1500);
}

