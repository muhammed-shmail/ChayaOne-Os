import { logger } from '../logger';
import { PrinterRouter } from './printer-adapters';

export interface PrintJob {
  printJobId: string;
  orderId: string;
  printerId: string;
  status: 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'RETRYING' | 'CANCELLED';
  payload: any;
  createdAt: Date;
  attemptCount: number;
}

export class PrinterManager {
  private queue: PrintJob[] = [];
  public status: 'STOPPED' | 'RUNNING' | 'ERROR' = 'STOPPED';

  public async start(): Promise<void> {
    if (this.status === 'RUNNING') return;
    logger.info('Starting Printer Manager...');
    this.status = 'RUNNING';
    // Initialize printer adapters and resume persistent queue if any (Phase 7 full impl)
  }

  public stop(): void {
    logger.info('Stopping Printer Manager...');
    this.status = 'STOPPED';
  }

  public async print(payload: any): Promise<boolean> {
    const job: PrintJob = {
      printJobId: Math.random().toString(36).substring(7),
      orderId: payload.orderId || 'UNKNOWN',
      printerId: payload.printerId || 'DEFAULT',
      status: 'QUEUED',
      payload,
      createdAt: new Date(),
      attemptCount: 0
    };
    
    this.queue.push(job);
    logger.info(`Queued print job ${job.printJobId} for order ${job.orderId}`);
    
    // Process queue asynchronously
    this.processQueue();
    
    return true;
  }

  private async processQueue() {
    // Basic processor for now. Phase 7 will add ESC/POS TCP/USB execution
    for (const job of this.queue.filter(j => j.status === 'QUEUED' || j.status === 'RETRYING')) {
      job.status = 'PRINTING';
      try {
        logger.info(`Printing job ${job.printJobId} to ${job.printerId}...`);
        const adapter = PrinterRouter.route(job.payload);
        if (adapter) {
          await adapter.print(job.payload);
        }
        job.status = 'PRINTED';
        logger.info(`Successfully printed job ${job.printJobId}`);
      } catch (err: any) {
        logger.error(`Failed to print job ${job.printJobId}: ${err.message}`);
        job.attemptCount += 1;
        if (job.attemptCount >= 3) {
          job.status = 'FAILED';
        } else {
          job.status = 'RETRYING';
        }
      }
    }
  }

  public getStatus() {
    return this.status;
  }
}

export const printerManager = new PrinterManager();
