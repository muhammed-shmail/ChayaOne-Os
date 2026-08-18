import net from 'net';

export interface NetworkPrintOptions {
  host: string;
  port?: number; // Default ESC/POS RAW TCP port is 9100
  timeoutMs?: number;
}

/**
 * Send raw binary buffer directly to a Thermal Network Printer via TCP Socket.
 */
export async function sendNetworkPrintJob(buffer: Buffer, options: NetworkPrintOptions): Promise<void> {
  const host = options.host;
  const port = options.port || 9100;
  const timeoutMs = options.timeoutMs || 5000;

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isSettled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.write(buffer, (err) => {
        if (err) {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            reject(new Error(`Failed to write to printer socket ${host}:${port} - ${err.message}`));
          }
        } else {
          // Flush and close socket gracefully
          socket.end();
        }
      });
    });

    socket.on('close', (hadError) => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        if (hadError) {
          reject(new Error(`Printer socket ${host}:${port} closed with transmission error`));
        } else {
          resolve();
        }
      }
    });

    socket.on('timeout', () => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error(`Printer socket timeout (${timeoutMs}ms) connecting to ${host}:${port}`));
      }
    });

    socket.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error(`Printer TCP connection error on ${host}:${port} - ${err.message}`));
      }
    });

    socket.connect(port, host);
  });
}
