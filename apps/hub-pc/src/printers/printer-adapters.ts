import * as net from 'net';
import { logger } from '../logger';

export interface EscPosOptions {
  host: string;
  port: number;
}

export class EscPosAdapter {
  private options: EscPosOptions;

  constructor(options: EscPosOptions) {
    this.options = options;
  }

  public async print(payload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      client.connect(this.options.port, this.options.host, () => {
        logger.debug(`Connected to printer at ${this.options.host}:${this.options.port}`);
        
        // ESC/POS init command
        const init = Buffer.from([0x1B, 0x40]);
        client.write(init);
        
        // Basic payload structure to text (A proper template engine will format this)
        const text = `Order ID: ${payload.orderId || 'UNKNOWN'}\n`
          + `Type: ${payload.printerId}\n`
          + `------------------------\n`
          + `(Print content)\n`
          + `------------------------\n\n\n\n`;
          
        client.write(text);

        // Cut paper
        const cut = Buffer.from([0x1D, 0x56, 0x41, 0x10]);
        client.write(cut);
        
        client.end();
      });

      client.on('close', () => {
        resolve();
      });

      client.on('error', (err) => {
        logger.error(`Printer Error (${this.options.host}): ${err.message}`);
        client.destroy();
        reject(err);
      });
      
      client.setTimeout(5000, () => {
        logger.error(`Printer Timeout (${this.options.host})`);
        client.destroy();
        reject(new Error('Timeout'));
      });
    });
  }
}

export class PrinterRouter {
  public static route(payload: any): EscPosAdapter | null {
    // Basic routing logic, mapping printer groups to IP addresses
    // In production, this would come from the local DB configuration
    const config: Record<string, EscPosOptions> = {
      'Kitchen': { host: '192.168.1.100', port: 9100 },
      'Bar': { host: '192.168.1.101', port: 9100 },
      'Receipt': { host: '192.168.1.102', port: 9100 },
      'DEFAULT': { host: '127.0.0.1', port: 9100 } // Local dev test
    };
    
    const options = config[payload.printerId] || config['DEFAULT']!;
    return new EscPosAdapter(options);
  }
}
