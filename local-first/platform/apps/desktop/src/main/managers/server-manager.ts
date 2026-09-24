import { ChildProcess, fork, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import http from 'http';
import { app } from 'electron';
import { logger } from '../logger';

function getPlatformDir(): string {
  let cur = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(cur, 'apps', 'web')) && fs.existsSync(path.join(cur, 'packages', 'db'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  const cwd = process.cwd();
  const knownLocations = [
    cwd,
    path.join(cwd, 'local-first', 'platform'),
    path.resolve(cwd, '..', '..'),
    path.resolve(__dirname, '../../../../..'),
  ];
  for (const loc of knownLocations) {
    if (fs.existsSync(path.join(loc, 'apps', 'web')) && fs.existsSync(path.join(loc, 'packages', 'db'))) {
      return loc;
    }
  }
  return path.resolve(__dirname, '../../../../..');
}

const MAX_RESTART_ATTEMPTS = 5;

export class ServerManager {
  private serverProcess: ChildProcess | null = null;
  public status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' = 'STOPPED';
  private isShuttingDown: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private restartTimeout: NodeJS.Timeout | null = null;
  private failedProbeCount: number = 0;
  private restartAttempts: number = 0;

  public async isServerUp(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:3000/api/server/info', { agent: false }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    });
  }


  private startHealthMonitor(): void {
    if (this.healthCheckInterval) return;
    this.failedProbeCount = 0;
    this.restartAttempts = 0; // reset on successful start
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      const up = await this.isServerUp();
      if (up) {
        this.failedProbeCount = 0;
        this.restartAttempts = 0; // reset on recovery
      } else if (this.status === 'RUNNING') {
        this.failedProbeCount++;
        if (this.failedProbeCount >= 3) {
          if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
            logger.error(`Server failed ${this.restartAttempts} restart attempts. Giving up auto-recovery to prevent terminal window storm.`);
            this.status = 'ERROR';
            this.failedProbeCount = 0;
            return;
          }
          this.restartAttempts++;
          logger.warn(`Server liveness probe failed ${this.failedProbeCount} times. Restart attempt ${this.restartAttempts}/${MAX_RESTART_ATTEMPTS}...`);
          this.status = 'STOPPED';
          this.failedProbeCount = 0;
          this.scheduleRestart(1000);
        }
      }
    }, 4000);
  }

  private scheduleRestart(delayMs = 2000): void {
    if (this.isShuttingDown || this.restartTimeout) return;
    logger.info(`Scheduling background server restart in ${delayMs}ms...`);
    this.restartTimeout = setTimeout(async () => {
      this.restartTimeout = null;
      if (!this.isShuttingDown) {
        try {
          await this.start();
        } catch (err: any) {
          logger.error(`Background server auto-restart failed: ${err.message}`);
        }
      }
    }, delayMs);
  }

  public async start(): Promise<void> {
    this.isShuttingDown = false;
    if (this.status === 'RUNNING' || this.status === 'STARTING') return;

    // 1. Check if server is already running on port 3000
    const isUp = await this.isServerUp();
    if (isUp) {
      this.status = 'RUNNING';
      logger.info('Next.js Server is ALREADY RUNNING on port 3000');
      this.startHealthMonitor();
      return;
    }

    this.status = 'STARTING';
    logger.info('Starting Next.js Server in headless background mode...');

    const platformDir = getPlatformDir();
    let serverScript = '';
    let serverCwd = '';
    let nodeModulesPath = '';

    if (app.isPackaged) {
      const webServerRoot = path.join(process.resourcesPath, 'web-server');
      serverCwd = path.join(webServerRoot, 'apps', 'web');
      serverScript = path.join(serverCwd, 'server.js');
      nodeModulesPath = path.join(webServerRoot, 'node_modules');
    } else {
      const standaloneScript = path.join(platformDir, 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js');
      if (fs.existsSync(standaloneScript)) {
        serverCwd = path.join(platformDir, 'apps', 'web', '.next', 'standalone', 'apps', 'web');
        serverScript = standaloneScript;
        nodeModulesPath = path.join(platformDir, 'apps', 'web', '.next', 'standalone', 'node_modules');
      } else {
        serverCwd = platformDir;
        serverScript = '';
        nodeModulesPath = '';
      }
    }

    logger.info(`Next.js server script: ${serverScript || 'npm run dev'}`);
    logger.info(`Next.js server cwd: ${serverCwd}`);
    logger.info(`Next.js NODE_PATH: ${nodeModulesPath}`);

    return new Promise<void>((resolve, reject) => {
      const baseEnv = { ...(process.env as Record<string, string>) };
      // Remove Windows Terminal session variable — prevents WT from intercepting child processes
      delete baseEnv['WT_SESSION'];
      delete baseEnv['WT_PROFILE_ID'];
      const env: Record<string, string> = {
        ...baseEnv,
        PORT: '3000',
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000',
        NODE_ENV: 'production',
        NODE_PATH: nodeModulesPath,
        DATABASE_URL: 'postgresql://cafeos:cafeos@127.0.0.1:5433/cafeos',
        DIRECT_URL: 'postgresql://cafeos:cafeos@127.0.0.1:5433/cafeos',
        CHAYAONE_RUNTIME_MODE: 'local',
        CHAYAONE_CLOUD_ENABLED: 'false',
        DEV_TENANT_SUBDOMAIN: 'kahwa',
        JWT_SECRET: 'chayaone-local-jwt-secret-key-32-chars-long',
        PLATFORM_JWT_SECRET: 'chayaone-local-platform-jwt-secret-key-admin',
        OTP_DEV_ECHO: '1',
        ELECTRON_RUN_AS_NODE: '1',
        TERM: 'dumb',
      };

      if (serverScript && fs.existsSync(serverScript)) {
        logger.info(`📦 Launching production standalone bundle: ${serverScript}`);

        let nodeBin = 'node';
        if (process.platform === 'win32') {
          const candidates = [
            'C:\\Program Files\\nodejs\\node.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'node', 'node.exe'),
            path.join(process.resourcesPath || '', 'node', 'node.exe'),
          ];
          for (const c of candidates) {
            if (fs.existsSync(c)) {
              nodeBin = c;
              break;
            }
          }
        }

        const execBinary = (nodeBin === 'node' && app.isPackaged) ? process.execPath : nodeBin;
        logger.info(`Executing web server with: ${execBinary}`);

        this.serverProcess = spawn(execBinary, [serverScript], {
          cwd: serverCwd,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          detached: false,
        });
      } else {
        // IMPORTANT: Do NOT use shell:true here. On Windows, shell:true spawns cmd.exe
        // which Windows 11 intercepts and opens a real visible terminal, regardless of
        // windowsHide:true. Instead we invoke cmd.exe explicitly with CREATE_NO_WINDOW.
        // Also: detached:false + windowsHide:true together prevent Windows Terminal from
        // opening a new window even when it is set as the default terminal app.
        logger.info('⚡ Launching Next.js server in dev mode (no terminal window)...');
        const nodeBin = (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\nodejs\\node.exe'))
          ? 'C:\\Program Files\\nodejs\\node.exe'
          : 'node';
        const npmCliCandidates = [
          'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
          path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        ];
        const npmCliPath = npmCliCandidates.find((p) => fs.existsSync(p));

        if (npmCliPath) {
          logger.info(`Launching Next.js server via node.exe + npm-cli.js (100% windowless): ${npmCliPath}`);
          this.serverProcess = spawn(
            nodeBin,
            [npmCliPath, 'run', '-w', '@cafeos/web', 'dev'],
            {
              cwd: platformDir,
              env,
              windowsHide: true,
              detached: false,
              stdio: ['ignore', 'pipe', 'pipe'],
            }
          );
        } else {
          const npmCmd = process.platform === 'win32'
            ? (fs.existsSync('C:\\Program Files\\nodejs\\npm.cmd') ? 'C:\\Program Files\\nodejs\\npm.cmd'
                : path.join(process.env.APPDATA || '', 'npm', 'npm.cmd'))
            : 'npm';
          const useNpmCmd = process.platform === 'win32' && fs.existsSync(npmCmd);
          this.serverProcess = spawn(
            useNpmCmd ? npmCmd : (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'),
            useNpmCmd
              ? ['run', '-w', '@cafeos/web', 'dev']
              : ['/d', '/s', '/c', 'npm run -w @cafeos/web dev'],
            {
              cwd: platformDir,
              env,
              windowsHide: true,
              detached: false,
              stdio: ['ignore', 'pipe', 'pipe'],
            }
          );
        }
      }

      let checkTimer: NodeJS.Timeout | null = setInterval(async () => {
        const up = await this.isServerUp();
        if (up) {
          if (checkTimer) clearInterval(checkTimer);
          checkTimer = null;
          this.status = 'RUNNING';
          logger.info('Next.js Server is now RUNNING on port 3000 (detected via HTTP probe)');
          this.startHealthMonitor();
          resolve();
        }
      }, 700);

      if (this.serverProcess) {
        this.serverProcess.stdout?.on('data', (data) => {
          const out = data.toString();
          logger.info(`[Web] ${out.trim()}`);
          if (out.includes('Ready in') || out.includes('started server on') || out.includes('Listening on port')) {
            if (checkTimer) clearInterval(checkTimer);
            checkTimer = null;
            this.status = 'RUNNING';
            logger.info('Next.js Server is now RUNNING on port 3000');
            this.startHealthMonitor();
            resolve();
          }
        });

        this.serverProcess.stderr?.on('data', (data) => {
          logger.error(`[Web ERROR] ${data.toString().trim()}`);
        });

        this.serverProcess.on('error', (err) => {
          logger.error(`[Web SPAWN ERROR]`, err);
        });

        this.serverProcess.on('close', (code) => {
          const wasStarting = this.status === 'STARTING';
          this.status = 'STOPPED';
          this.serverProcess = null;
          logger.warn(`Next.js Server process exited with code ${code}`);
          if (checkTimer) clearInterval(checkTimer);

          if (wasStarting) {
            reject(new Error(`Server process exited with code ${code}`));
          } else if (!this.isShuttingDown) {
            logger.warn('Server process exited unexpectedly. Initiating background auto-restart...');
            this.scheduleRestart(1500);
          }
        });

        this.serverProcess.on('error', (err) => {
          const wasStarting = this.status === 'STARTING';
          this.status = 'ERROR';
          logger.error(`Next.js Server process error: ${err.message}`);
          if (checkTimer) clearInterval(checkTimer);
          if (wasStarting) {
            reject(err);
          } else if (!this.isShuttingDown) {
            this.scheduleRestart(2500);
          }
        });
      }

      // 30s timeout fallback
      setTimeout(() => {
        if (this.status === 'STARTING') {
          if (checkTimer) clearInterval(checkTimer);
          this.status = 'RUNNING';
          logger.warn('Server startup timeout reached, assuming it is RUNNING');
          this.startHealthMonitor();
          resolve();
        }
      }, 30000);
    });
  }

  public stop(): void {
    this.isShuttingDown = true;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.serverProcess) {
      logger.info('Stopping Next.js Server...');
      try {
        this.serverProcess.kill();
      } catch {}
      this.serverProcess = null;
      this.status = 'STOPPED';
    }
  }

  public getStatus() {
    return this.status;
  }
}

export const serverManager = new ServerManager();
