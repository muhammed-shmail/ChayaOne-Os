import { Server } from 'ws';
import { logger } from '../logger';
import * as http from 'http';
import * as net from 'net';
import * as express from 'express';
import { printerManager } from './printer-manager';

export class WebsocketManager {
  private wss: Server | null = null;
  private httpServer: http.Server | null = null;
  public status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' = 'STOPPED';

  public async start(): Promise<void> {
    if (this.status === 'RUNNING') return;

    // Check if WebSocket server is already running on port 3001
    const isWsUp = await new Promise<boolean>((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port: 3001 });
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error', () => resolve(false));
      sock.setTimeout(1000, () => { sock.destroy(); resolve(false); });
    });

    if (isWsUp) {
      this.status = 'RUNNING';
      logger.info('Local WebSocket Server is ALREADY RUNNING on port 3001');
      return;
    }

    this.status = 'STARTING';
    logger.info('Starting Local WebSocket Server...');

    return new Promise((resolve) => {
      try {
        const app = express.default();
        app.use(express.json());
        
        app.post('/print', async (req, res) => {
          logger.info(`Received print request from Next.js for order ${req.body?.orderId}`);
          await printerManager.print(req.body);
          res.json({ success: true });
        });

        this.httpServer = http.createServer(app);
        
        this.wss = new Server({ server: this.httpServer });

        this.wss.on('connection', (ws) => {
          logger.debug('New WebSocket connection established.');
          
          ws.on('message', (message) => {
            // For Phase 8 integration: broadcast to other clients
            logger.debug(`Received WS message: ${message}`);
            // Broadcast to all clients
            this.wss?.clients.forEach(client => {
              if (client !== ws && client.readyState === 1) { // 1 is ws.OPEN
                client.send(message.toString());
              }
            });
          });

          ws.on('error', (err) => {
            logger.error(`WebSocket Error: ${err.message}`);
          });
        });

        this.httpServer.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            logger.info('Port 3001 is already in use by local server — setting status to RUNNING');
            this.status = 'RUNNING';
          } else {
            logger.error(`WebSocket server listen error: ${err.message}`);
            this.status = 'ERROR';
          }
          resolve(); // Resolve so we don't block startup
        });

        try {
          this.httpServer.listen(3001, () => {
            this.status = 'RUNNING';
            logger.info('Local WebSocket Server is RUNNING on port 3001');
            resolve();
          });
        } catch (err: any) {
          if (err.code === 'EADDRINUSE') {
            this.status = 'RUNNING';
          } else {
            this.status = 'ERROR';
          }
          resolve();
        }
      } catch (err: any) {
        this.status = 'ERROR';
        logger.error(`Failed to start WebSocket Server: ${err.message}`);
        resolve(); // resolve so we don't block startup completely, Health Manager will report it
      }
    });
  }

  public stop(): void {
    if (this.wss) {
      logger.info('Stopping Local WebSocket Server...');
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    this.status = 'STOPPED';
  }

  public getStatus() {
    return this.status;
  }
}

export const wsManager = new WebsocketManager();
