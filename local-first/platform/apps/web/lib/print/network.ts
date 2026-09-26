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
  const timeoutMs = options.timeoutMs || 4000;

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isSettled = false;
    let flushTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {}
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      // Disable Nagle's algorithm so ESC/POS packets are sent immediately with zero buffering delay
      socket.setNoDelay(true);

      socket.write(buffer, (err) => {
        if (err) {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            reject(new Error(`Failed to write to printer socket ${host}:${port} - ${err.message}`));
          }
          return;
        }

        // Buffer has been written to the socket.
        // Send TCP FIN to signal end of stream.
        socket.end();

        // Thermal printers on port 9100 (Raw JetDirect) frequently keep CLOSE_WAIT open indefinitely
        // until host terminates the connection. We give a 100ms window for the TCP buffer to drain across LAN,
        // then forcefully close (destroy) the socket. This triggers the printer's cut & printhead immediately.
        flushTimer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            resolve();
          }
        }, 100);
      });
    });

    // Discard any incoming status bytes from printer firmware to prevent TCP window stalls
    socket.on('data', () => {});

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
