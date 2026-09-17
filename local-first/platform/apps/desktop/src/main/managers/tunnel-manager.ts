import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { logger } from '../logger';
import { ensureGuiSubsystem } from './database-manager';

function getPlatformDir(): string {
  let cur = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(cur, 'apps', 'web')) && fs.existsSync(path.join(cur, 'packages', 'db'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  const knownLocations = [
    'c:\\nuro 7\\CHAYAONE\\CHAYAONE OS\\local-first\\platform',
    path.resolve(__dirname, '../../../../..'),
  ];
  for (const loc of knownLocations) {
    if (fs.existsSync(path.join(loc, 'apps', 'web')) && fs.existsSync(path.join(loc, 'packages', 'db'))) {
      return loc;
    }
  }
  return path.resolve(__dirname, '../../../../..');
}

export interface TunnelInfo {
  active: boolean;
  publicUrl: string | null;
  qrOrderUrl: string | null;
  mode: 'quick' | 'token' | 'disabled';
  startedAt: string;
  targetPort: number;
}

export class TunnelManager {
  private tunnelProcess: ChildProcess | null = null;
  public status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' = 'STOPPED';
  public publicUrl: string | null = null;
  private isShuttingDown: boolean = false;
  private retryTimeout: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private static readonly MAX_RETRIES = 3;

  private getBinaryPath(): string | null {
    const candidates = [
      path.join(process.resourcesPath || '', 'bin', 'cloudflared.exe'),
      path.resolve(__dirname, '../../resources/bin/cloudflared.exe'),
      path.resolve(getPlatformDir(), 'apps/desktop/resources/bin/cloudflared.exe'),
      path.resolve(getPlatformDir(), '../../bin/cloudflared.exe'),
      'C:\\nuro 7\\CHAYAONE\\CHAYAONE OS\\bin\\cloudflared.exe',
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private persistTunnelInfo(info: TunnelInfo | null): void {
    const targets = [
      path.join(getPlatformDir(), 'tunnel-info.json'),
    ];
    try {
      if (app && app.getPath) {
        targets.push(path.join(app.getPath('userData'), 'tunnel-info.json'));
      }
    } catch {}

    for (const file of targets) {
      try {
        if (info) {
          fs.writeFileSync(file, JSON.stringify(info, null, 2), 'utf8');
        } else if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        logger.warn(`Could not persist tunnel-info to ${file}:`, err);
      }
    }
  }

  public async start(): Promise<string | null> {
    this.isShuttingDown = false;
    if (this.status === 'RUNNING' && this.publicUrl) return this.publicUrl;

    const enabled = process.env.ENABLE_CUSTOMER_TUNNEL !== 'false';
    if (!enabled) {
      logger.info('Customer 4G tunnel is disabled via ENABLE_CUSTOMER_TUNNEL=false');
      this.status = 'STOPPED';
      this.persistTunnelInfo(null);
      return null;
    }

    const binary = this.getBinaryPath();
    if (!binary) {
      logger.warn('cloudflared binary not found. Customer 4G tunnel will remain offline.');
      this.status = 'ERROR';
      this.persistTunnelInfo(null);
      return null;
    }

    this.status = 'STARTING';
    logger.info(`Starting Cloudflare Tunnel for customer 4G QR ordering using: ${binary}`);

    const token = process.env.CLOUDFLARE_TUNNEL_TOKEN || '';
    const customPublicUrl = process.env.PUBLIC_URL || '';

    return new Promise((resolve) => {
      let resolved = false;
      const args: string[] = [];

      if (token) {
        logger.info('Running Cloudflare Tunnel in Named Token mode...');
        args.push('tunnel', 'run', '--token', token);
      } else {
        logger.info('Running Cloudflare Tunnel in Quick Tunnel mode (port 3000)...');
        args.push('tunnel', '--url', 'http://localhost:3000');
      }

      try {
        const tunnelEnv = { ...process.env };
        // Remove Windows Terminal session vars — prevents WT from opening a visible window
        delete tunnelEnv['WT_SESSION'];
        delete tunnelEnv['WT_PROFILE_ID'];
        ensureGuiSubsystem(binary);
        this.tunnelProcess = spawn(binary, args, {
          windowsHide: true,
          // NOTE: Do NOT use detached:true here. On Windows, DETACHED_PROCESS flag
          // (set by detached:true) overrides CREATE_NO_WINDOW (set by windowsHide:true),
          // causing Windows Terminal to intercept and show a new terminal window.
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: tunnelEnv,
        });
      } catch (err: any) {
        logger.error(`Failed to spawn cloudflared: ${err.message}`);
        this.status = 'ERROR';
        resolve(null);
        return;
      }

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        // Look for Quick Tunnel URL: https://[a-zA-Z0-9-]+\.trycloudflare\.com (ignoring api.trycloudflare.com)
        const match = text.match(/https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !resolved) {
          resolved = true;
          this.publicUrl = match[0];
          this.status = 'RUNNING';
          process.env.PUBLIC_URL = this.publicUrl;
          logger.info(`🎉 Customer 4G Tunnel ACTIVE! Public URL: ${this.publicUrl}`);

          const info: TunnelInfo = {
            active: true,
            publicUrl: this.publicUrl,
            qrOrderUrl: `${this.publicUrl}/app?t=`,
            mode: token ? 'token' : 'quick',
            startedAt: new Date().toISOString(),
            targetPort: 3000,
          };
          this.persistTunnelInfo(info);
          resolve(this.publicUrl);
        }
      };

      this.tunnelProcess.stdout?.on('data', handleOutput);
      this.tunnelProcess.stderr?.on('data', handleOutput);

      this.tunnelProcess.on('close', (code) => {
        logger.warn(`Cloudflare tunnel exited with code ${code}`);
        this.status = 'STOPPED';
        this.publicUrl = null;
        this.tunnelProcess = null;
        this.persistTunnelInfo(null);

        if (!this.isShuttingDown && !resolved) {
          resolved = true;
          resolve(null);
        } else if (!this.isShuttingDown) {
          if (this.retryCount >= TunnelManager.MAX_RETRIES) {
            logger.warn(`Cloudflare tunnel failed after ${this.retryCount} retries. Not retrying further (internet may be offline).`);
            this.status = 'ERROR';
          } else {
            this.scheduleRestart(5000);
          }
        }
      });

      this.tunnelProcess.on('error', (err) => {
        logger.error(`Cloudflare tunnel process error: ${err.message}`);
        this.status = 'ERROR';
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      });

      // If token mode and custom URL provided, resolve immediately
      if (token && customPublicUrl && !resolved) {
        resolved = true;
        this.publicUrl = customPublicUrl;
        this.status = 'RUNNING';
        process.env.PUBLIC_URL = this.publicUrl;
        this.persistTunnelInfo({
          active: true,
          publicUrl: this.publicUrl,
          qrOrderUrl: `${this.publicUrl}/app?t=`,
          mode: 'token',
          startedAt: new Date().toISOString(),
          targetPort: 3000,
        });
        resolve(this.publicUrl);
      }

      // Timeout fallback: 25 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (this.publicUrl) {
            resolve(this.publicUrl);
          } else {
            logger.warn('Cloudflare tunnel startup timed out waiting for public URL');
            resolve(null);
          }
        }
      }, 25000);
    });
  }

  private scheduleRestart(delayMs = 5000): void {
    if (this.isShuttingDown || this.retryTimeout) return;
    this.retryCount++;
    logger.info(`Scheduling tunnel restart #${this.retryCount} in ${delayMs}ms...`);
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      if (!this.isShuttingDown) {
        this.start().catch((err) => logger.error(`Tunnel restart failed: ${err.message}`));
      }
    }, delayMs);
  }

  public stop(): void {
    this.isShuttingDown = true;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.tunnelProcess) {
      try {
        this.tunnelProcess.kill();
      } catch {}
      this.tunnelProcess = null;
    }
    this.status = 'STOPPED';
    this.publicUrl = null;
    this.persistTunnelInfo(null);
    logger.info('Cloudflare tunnel stopped.');
  }

  public getPublicUrl(): string | null {
    return this.publicUrl;
  }

  public getStatus() {
    return this.status;
  }
}

export const tunnelManager = new TunnelManager();
