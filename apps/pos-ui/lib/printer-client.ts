/**
 * ChayaOne — LocalPrinterClient
 *
 * Connects to the Desktop App's local Express HTTP server (port 3001)
 * to send ESC/POS print jobs directly to the configured thermal printer.
 *
 * Print flow:
 *   Web UI → LocalPrinterClient.requestPrint() → Desktop App (port 3001)
 *            → Windows printer spooler → TVSE RP3200 Lite
 *
 * If the desktop app is not running, the caller falls back to window.print().
 */

export interface PrintRequestPayload {
  /** Configured receipt printer name (e.g. "TVSE RP3200 Lite") */
  printerName?: string | null;
  /** Paper width profile */
  paperWidth?: '80mm' | '58mm';
  /** Order/receipt data passed to ESC/POS formatter */
  [key: string]: any;
}

const DESKTOP_PRINT_ENDPOINT = 'http://127.0.0.1:3001/print';
const TIMEOUT_MS = 4000;

export class LocalPrinterClient {
  /**
   * Send a receipt/ticket to the local desktop print service.
   * Returns true if the desktop app accepted the job, false otherwise.
   * Never throws — errors are logged and returned as false.
   */
  public static async requestPrint(payload: PrintRequestPayload): Promise<boolean> {
    const printerName = payload.printerName || 'TVSE RP3200 Lite';
    const jobId = `web-${Date.now()}`;

    console.log(`[PRINT] ── LocalPrinterClient.requestPrint ──`);
    console.log(`[PRINT] Job ID   : ${jobId}`);
    console.log(`[PRINT] Printer  : ${printerName}`);
    console.log(`[PRINT] Paper    : ${payload.paperWidth || '80mm'}`);
    console.log(`[PRINT] Endpoint : ${DESKTOP_PRINT_ENDPOINT}`);
    console.log(`[PRINT] Timestamp: ${new Date().toISOString()}`);
    console.log(`[PRINT] Status   : QUEUED → Sending...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(DESKTOP_PRINT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, _jobId: jobId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[PRINT] Status   : PRINTING — Desktop app accepted job ${jobId}`);
        console.log(`[PRINT] Printer  : ${printerName}`);
        console.log(`[PRINT] Receipt printed successfully via Desktop App.`);
        return true;
      } else {
        const errText = await response.text().catch(() => 'unknown');
        console.error(`[PRINT ERROR]`);
        console.error(`  Job ID   : ${jobId}`);
        console.error(`  Printer  : ${printerName}`);
        console.error(`  HTTP     : ${response.status} ${response.statusText}`);
        console.error(`  Response : ${errText.slice(0, 200)}`);
        return false;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn(`[PRINT] Desktop App timeout (${TIMEOUT_MS}ms) — Job ID: ${jobId}`);
        console.warn(`[PRINT] Desktop App may not be running. Falling back to OS print dialog.`);
      } else {
        console.warn(`[PRINT] LocalPrinterClient connection failed — Job ID: ${jobId}`);
        console.warn(`[PRINT] Reason: ${err?.message || err}`);
        console.warn(`[PRINT] Falling back to OS print dialog (window.print).`);
      }
      return false;
    }
  }

  /**
   * Check if the desktop print service is reachable.
   */
  public static async checkHealth(): Promise<{ online: boolean; latencyMs?: number }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://127.0.0.1:3001/health', { signal: controller.signal });
      return { online: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { online: false };
    }
  }
}
