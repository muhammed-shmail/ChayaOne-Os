import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import type { LocalRealtimeClaims, RealtimeEnvelope, WSIncomingMessage, WSOutgoingMessage } from './types';
import { verifyLocalRealtimeToken } from './auth';
import { isChannelAuthorized } from './channels';

interface ClientConnection {
  id: string;
  socket: WebSocket;
  claims: LocalRealtimeClaims | null;
  channels: Set<string>;
  isAlive: boolean;
  connectedAt: number;
}

export class LocalWSServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private port: number;

  constructor(port = 3001) {
    this.port = port;
  }

  public getPort(): number {
    return this.port;
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public isRunning(): boolean {
    return this.wss !== null;
  }

  public start(): Promise<number> {
    if (this.wss) {
      return Promise.resolve(this.port);
    }

    return new Promise((resolve, reject) => {
      try {
        const wss = new WebSocketServer({ port: this.port });

        wss.on('listening', () => {
          console.log(`[REALTIME WS] Local WebSocket server listening on port ${this.port}`);
          this.wss = wss;
          this.startHeartbeat();
          resolve(this.port);
        });

        wss.on('error', (err: Error & { code?: string }) => {
          if (err.code === 'EADDRINUSE') {
            const nextPort = this.port + 1;
            console.log(`[REALTIME WS] Port ${this.port} in use, retrying on port ${nextPort}`);
            this.port = nextPort;
            // Retry on next port
            const nextWss = new WebSocketServer({ port: this.port });
            nextWss.on('listening', () => {
              console.log(`[REALTIME WS] Local WebSocket server listening on port ${this.port}`);
              this.wss = nextWss;
              this.startHeartbeat();
              resolve(this.port);
            });
            nextWss.on('error', (nextErr) => reject(nextErr));
            nextWss.on('connection', (socket: WebSocket, req) => {
              this.handleConnection(socket, req.url);
            });
          } else {
            console.error('[REALTIME WS ERROR] WebSocket server error:', err);
            reject(err);
          }
        });

        wss.on('connection', (socket: WebSocket, req) => {
          this.handleConnection(socket, req.url);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private handleConnection(socket: WebSocket, reqUrl?: string) {
    const id = crypto.randomUUID();
    const conn: ClientConnection = {
      id,
      socket,
      claims: null,
      channels: new Set(),
      isAlive: true,
      connectedAt: Date.now(),
    };

    this.clients.set(id, conn);

    // Try parsing token directly from URL query param `?token=...` if provided
    if (reqUrl && reqUrl.includes('token=')) {
      try {
        const urlObj = new URL(reqUrl, 'http://localhost');
        const token = urlObj.searchParams.get('token');
        if (token) {
          verifyLocalRealtimeToken(token).then((claims) => {
            if (claims) {
              conn.claims = claims;
              // Auto-subscribe staff to their outlet channel upon connection if staff token
              if (claims.outletId && !claims.tableId) {
                conn.channels.add(`outlet:${claims.outletId}`);
              } else if (claims.outletId && claims.tableId) {
                conn.channels.add(`outlet:${claims.outletId}:tbl:${claims.tableId}`);
              }
              this.sendMessage(socket, { type: 'authenticated' });
            }
          });
        }
      } catch {
        /* ignore invalid URL */
      }
    }

    socket.on('pong', () => {
      conn.isAlive = true;
    });

    socket.on('message', async (data: string | Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as WSIncomingMessage;
        await this.handleClientMessage(conn, msg);
      } catch (e) {
        this.sendMessage(socket, { type: 'error', message: 'invalid_json' });
      }
    });

    socket.on('close', () => {
      this.clients.delete(id);
    });

    socket.on('error', (err) => {
      console.error(`[REALTIME WS ERROR] Client ${id} error:`, err);
      this.clients.delete(id);
    });
  }

  private async handleClientMessage(conn: ClientConnection, msg: WSIncomingMessage) {
    if (msg.type === 'ping') {
      conn.isAlive = true;
      this.sendMessage(conn.socket, { type: 'pong' });
      return;
    }

    if (msg.type === 'auth' && msg.token) {
      const claims = await verifyLocalRealtimeToken(msg.token);
      if (!claims) {
        this.sendMessage(conn.socket, { type: 'error', message: 'invalid_token' });
        return;
      }
      conn.claims = claims;
      this.sendMessage(conn.socket, { type: 'authenticated' });
      return;
    }

    if (msg.type === 'subscribe') {
      if (!msg.channel) {
        this.sendMessage(conn.socket, { type: 'error', message: 'channel_required' });
        return;
      }

      if (!conn.claims) {
        this.sendMessage(conn.socket, { type: 'error', message: 'unauthenticated' });
        return;
      }

      if (!isChannelAuthorized(conn.claims, msg.channel)) {
        console.warn(`[REALTIME SECURITY] Denied channel subscription "${msg.channel}" for client with outletId=${conn.claims.outletId}`);
        this.sendMessage(conn.socket, { type: 'error', message: 'unauthorized_channel' });
        return;
      }

      conn.channels.add(msg.channel);
      this.sendMessage(conn.socket, { type: 'subscribed', channel: msg.channel });
      return;
    }

    if (msg.type === 'unsubscribe' && msg.channel) {
      conn.channels.delete(msg.channel);
      this.sendMessage(conn.socket, { type: 'unsubscribed', channel: msg.channel });
      return;
    }
  }

  private sendMessage(socket: WebSocket, msg: WSOutgoingMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      for (const [id, conn] of this.clients.entries()) {
        if (!conn.isAlive) {
          console.log(`[REALTIME WS] Terminating unresponsive connection ${id}`);
          conn.socket.terminate();
          this.clients.delete(id);
          continue;
        }
        conn.isAlive = false;
        if (conn.socket.readyState === WebSocket.OPEN) {
          conn.socket.ping();
        }
      }
    }, 30000);
  }

  public broadcast(channel: string, envelope: RealtimeEnvelope): number {
    let notified = 0;
    for (const conn of this.clients.values()) {
      if (conn.socket.readyState === WebSocket.OPEN && conn.channels.has(channel)) {
        const out: WSOutgoingMessage = {
          type: 'event',
          channel,
          envelope,
          payload: envelope.payload,
        };
        conn.socket.send(JSON.stringify(out));
        notified++;
      }
    }
    console.log(`[REALTIME] event=${envelope.event} outlet=${envelope.outletId} entity=${envelope.entityId} clients=${notified}`);
    return notified;
  }

  public close() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const conn of this.clients.values()) {
      conn.socket.close();
    }
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

// Preserve singleton across Next.js reloads
const g = globalThis as unknown as { __chayaoneWSServer?: LocalWSServer };

export function getLocalWSServerSingleton(): LocalWSServer {
  if (!g.__chayaoneWSServer) {
    const port = Number(process.env.WS_PORT || 3001);
    g.__chayaoneWSServer = new LocalWSServer(port);
  }
  return g.__chayaoneWSServer;
}

export async function ensureLocalWebSocketServer(): Promise<LocalWSServer> {
  const instance = getLocalWSServerSingleton();
  if (!instance.isRunning()) {
    await instance.start();
  }
  return instance;
}
