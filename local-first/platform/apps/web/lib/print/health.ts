import net from 'net';
import type { Device } from '../devices';

export type PrinterStatus = 'CHECKING' | 'ONLINE' | 'UNREACHABLE' | 'DISABLED' | 'NOT_CONFIGURED' | 'ERROR';

export interface PrinterHealthResult {
  success: boolean;
  status: PrinterStatus;
  printerId?: string | null;
  name?: string | null;
  host: string;
  port: number;
  protocol: string;
  latencyMs: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  message: string;
  checkedAt: string;
}

export interface PrinterHealthCheckOptions {
  host?: string | null;
  port?: number | string | null;
  target?: string | null;
  printerId?: string | null;
  name?: string | null;
  timeoutMs?: number;
}

/**
 * Diagnostic error message dictionary mapping network socket error codes
 * to human-readable, actionable explanations for restaurant staff.
 */
export const ERROR_DIAGNOSTICS: Record<string, string> = {
  ECONNREFUSED: 'Printer rejected the TCP connection. Verify printer IP, port (e.g. 9100), and that RAW TCP network printing is enabled in the printer.',
  ETIMEDOUT: 'Printer did not respond before timeout. Check IP address, network connection, firewall, and ensure printer is powered on.',
  EHOSTUNREACH: 'The Main PC cannot reach the printer host. Check Wi-Fi / Ethernet subnet and physical cable connection.',
  ENETUNREACH: 'Network is unreachable. The Main PC has no network route to the printer subnet.',
  EADDRNOTAVAIL: 'The printer IP address is invalid or not available on the current network interface.',
  ENOTFOUND: 'Printer hostname could not be resolved by local DNS.',
  ECONNRESET: 'Connection was abruptly closed or reset by the printer.',
  EPIPE: 'Broken pipe while communicating with printer socket.',
  ERR_NOT_CONFIGURED: 'No IP address configured for this printer.',
  ERR_INVALID_PORT: 'Configured TCP port is invalid (must be between 1 and 65535).',
};

/**
 * Parses and sanitizes a host/IP and port from individual values or combined target string.
 */
export function parsePrinterEndpoint(input: {
  host?: string | null;
  port?: number | string | null;
  target?: string | null;
}): { host: string; port: number; isValid: boolean; error?: string } {
  let rawHost = String(input.host || '').trim();
  let rawPort = input.port;

  // If host is empty or contains ':', extract from target or host
  if (rawHost.includes(':')) {
    const parts = rawHost.split(':');
    rawHost = parts[0]?.trim() || '';
    if (!rawPort && parts[1]) {
      rawPort = parts[1].trim();
    }
  } else if (!rawHost && input.target) {
    const parts = String(input.target).trim().split(':');
    rawHost = parts[0]?.trim() || '';
    if (!rawPort && parts[1]) {
      rawPort = parts[1].trim();
    }
  }

  // Validate Host
  if (!rawHost) {
    return { host: '', port: 9100, isValid: false, error: 'ERR_NOT_CONFIGURED' };
  }

  // Validate Port
  let parsedPort = 9100;
  if (rawPort !== undefined && rawPort !== null && String(rawPort).trim() !== '') {
    const num = parseInt(String(rawPort).trim(), 10);
    if (isNaN(num) || num < 1 || num > 65535) {
      return { host: rawHost, port: num || 0, isValid: false, error: 'ERR_INVALID_PORT' };
    }
    parsedPort = num;
  }

  return { host: rawHost, port: parsedPort, isValid: true };
}

/**
 * Core Authoritative Printer Connection & Health Check Service.
 *
 * Connects via a low-level Node.js TCP socket from the Main PC / Server.
 * NEVER attempts browser-side raw sockets.
 * Returns structured diagnostics with latency and error classification.
 */
export async function printerHealthCheck(opts: PrinterHealthCheckOptions): Promise<PrinterHealthResult> {
  const checkedAt = new Date().toISOString();
  const timeoutMs = opts.timeoutMs ?? 2500;
  const printerId = opts.printerId ?? null;
  const name = opts.name ?? 'Printer';

  // 1. Endpoint resolution & validation
  const endpoint = parsePrinterEndpoint({
    host: opts.host,
    port: opts.port,
    target: opts.target,
  });

  if (!endpoint.isValid) {
    const errorCode = endpoint.error || 'ERR_NOT_CONFIGURED';
    const errorMessage = ERROR_DIAGNOSTICS[errorCode] || 'Printer endpoint is invalid.';
    console.warn(`[PRINTER:HEALTH] Validation failed for "${name}" (${printerId || 'unregistered'}): ${errorCode}`);
    return {
      success: false,
      status: errorCode === 'ERR_NOT_CONFIGURED' || errorCode === 'ERR_INVALID_PORT' ? 'NOT_CONFIGURED' : 'ERROR',
      printerId,
      name,
      host: endpoint.host,
      port: endpoint.port,
      protocol: 'RAW_TCP',
      latencyMs: 0,
      errorCode,
      errorMessage,
      message: `✕ ${name}: ${errorMessage}`,
      checkedAt,
    };
  }

  const { host, port } = endpoint;

  if (port === 9) {
    console.warn(`[PRINTER:HEALTH] Notice: Port 9 configured for "${name}" (${host}:9). Port 9 is the standard Discard protocol. Typical ESC/POS thermal printers listen on TCP port 9100.`);
  }

  console.log(`[PRINTER:HEALTH] Starting connection test for "${name}" -> host=${host} port=${port} timeout=${timeoutMs}ms (printerId=${printerId || 'none'})`);

  const startTime = Date.now();

  return new Promise<PrinterHealthResult>((resolve) => {
    const socket = new net.Socket();
    let isSettled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    console.log(`[PRINTER:TCP] Socket connecting to ${host}:${port}...`);

    socket.on('connect', () => {
      if (isSettled) return;
      isSettled = true;
      const latencyMs = Math.max(1, Date.now() - startTime);
      cleanup();

      console.log(`[PRINTER:TCP] Socket connected successfully to ${host}:${port} (latency=${latencyMs}ms)`);
      console.log(`[PRINTER:HEALTH] Result=ONLINE host=${host}:${port}`);

      resolve({
        success: true,
        status: 'ONLINE',
        printerId,
        name,
        host,
        port,
        protocol: 'RAW_TCP',
        latencyMs,
        errorCode: null,
        errorMessage: null,
        message: `✓ Printer "${name}" reachable at ${host}:${port} (${latencyMs}ms)`,
        checkedAt,
      });
    });

    socket.on('timeout', () => {
      if (isSettled) return;
      isSettled = true;
      const latencyMs = Date.now() - startTime;
      cleanup();

      const errorCode = 'ETIMEDOUT';
      const diagnostic = ERROR_DIAGNOSTICS[errorCode];

      console.error(`[PRINTER:TCP] Connection timed out after ${timeoutMs}ms for ${host}:${port}`);
      console.log(`[PRINTER:HEALTH] Result=UNREACHABLE host=${host}:${port} code=${errorCode}`);

      resolve({
        success: false,
        status: 'UNREACHABLE',
        printerId,
        name,
        host,
        port,
        protocol: 'RAW_TCP',
        latencyMs,
        errorCode,
        errorMessage: `Connection timed out after ${timeoutMs}ms.`,
        message: `✕ Printer unreachable at ${host}:${port} (Timed out after ${timeoutMs}ms) — ${diagnostic}`,
        checkedAt,
      });
    });

    socket.on('error', (err: any) => {
      if (isSettled) return;
      isSettled = true;
      const latencyMs = Date.now() - startTime;
      cleanup();

      const code = err?.code || 'UNKNOWN';
      const diagnostic = ERROR_DIAGNOSTICS[code] || err?.message || 'Socket connection failed.';

      console.error(`[PRINTER:TCP] Connection failed to ${host}:${port}:`, {
        host,
        port,
        code,
        message: err?.message,
      });
      console.log(`[PRINTER:HEALTH] Result=UNREACHABLE host=${host}:${port} code=${code}`);

      resolve({
        success: false,
        status: 'UNREACHABLE',
        printerId,
        name,
        host,
        port,
        protocol: 'RAW_TCP',
        latencyMs,
        errorCode: code,
        errorMessage: err?.message || 'Connection error',
        message: `✕ Printer unreachable at ${host}:${port} (${code}: ${diagnostic})`,
        checkedAt,
      });
    });

    try {
      socket.connect(port, host);
    } catch (err: any) {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      const code = err?.code || 'ERR_SOCKET_INIT';
      console.error(`[PRINTER:TCP] Failed to initiate socket for ${host}:${port}:`, err);
      resolve({
        success: false,
        status: 'ERROR',
        printerId,
        name,
        host,
        port,
        protocol: 'RAW_TCP',
        latencyMs: 0,
        errorCode: code,
        errorMessage: err?.message || 'Failed to initiate connection',
        message: `✕ Failed to connect to ${host}:${port}: ${err?.message || code}`,
        checkedAt,
      });
    }
  });
}

/**
 * Concurrency-controlled batch health check for all registered devices.
 * Ensures the network is not flooded while checking multiple printers.
 */
export async function checkAllPrintersHealth(devices: Device[], concurrency = 3): Promise<PrinterHealthResult[]> {
  const networkDevices = devices.filter((d) => d.connection === 'network' || d.target || d.ip);
  if (networkDevices.length === 0) return [];

  console.log(`[PRINTER:HEALTH] Batch checking ${networkDevices.length} network device(s) with concurrency limit of ${concurrency}...`);

  const results: PrinterHealthResult[] = [];
  const queue = [...networkDevices];

  const worker = async () => {
    while (queue.length > 0) {
      const dev = queue.shift();
      if (!dev) break;
      const res = await printerHealthCheck({
        host: dev.ip,
        port: dev.port,
        target: dev.target,
        printerId: dev.id,
        name: dev.name,
        timeoutMs: 2500,
      });
      results.push(res);
    }
  };

  const pool = Array.from({ length: Math.min(concurrency, networkDevices.length) }, () => worker());
  await Promise.all(pool);

  console.log(`[PRINTER:HEALTH] Batch check finished. ${results.filter((r) => r.success).length}/${results.length} printers online.`);
  return results;
}
