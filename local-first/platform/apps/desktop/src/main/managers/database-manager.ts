import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import net from 'net';
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

export function ensureGuiSubsystem(exePath: string): void {
  try {
    if (!fs.existsSync(exePath)) return;
    const buf = fs.readFileSync(exePath);
    if (buf.length < 0x200) return;
    const peOffset = buf.readInt32LE(0x3C);
    if (peOffset <= 0 || peOffset + 24 + 70 > buf.length) return;
    // Verify PE signature: 'PE\0\0' (0x00004550)
    if (buf.readUInt32LE(peOffset) !== 0x00004550) return;
    const subsystemOffset = peOffset + 4 + 20 + 68;
    const currentSubsystem = buf.readUInt16LE(subsystemOffset);
    if (currentSubsystem === 3) {
      // 3 is IMAGE_SUBSYSTEM_WINDOWS_CUI (Console)
      // 2 is IMAGE_SUBSYSTEM_WINDOWS_GUI (GUI / No Console)
      logger.info(`Converting ${path.basename(exePath)} PE subsystem from Console (3) to GUI (2) to eliminate all terminal windows...`);
      buf.writeUInt16LE(2, subsystemOffset);
      fs.writeFileSync(exePath, buf);
      logger.info(`Successfully patched ${path.basename(exePath)} to GUI subsystem.`);
    }
  } catch (err: any) {
    logger.warn(`Could not verify/patch PE subsystem for ${exePath}: ${err.message}`);
  }
}

export class DatabaseManager {
  private dbProcess: ChildProcess | null = null;
  private dbPid: number | null = null; // stored separately since we .unref() the process
  public status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' = 'STOPPED';

  public async isPortOpen(port = 5433): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port });
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error', () => resolve(false));
      sock.setTimeout(800, () => { sock.destroy(); resolve(false); });
    });
  }

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;
  private recoveryAttempts: number = 0;
  private static readonly MAX_RECOVERY_ATTEMPTS = 5;

  private startHealthMonitor(): void {
    if (this.healthCheckInterval) return;
    this.recoveryAttempts = 0;
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      const up = await this.isPortOpen(5433);
      if (up) {
        this.recoveryAttempts = 0;
      } else if (this.status === 'RUNNING') {
        if (this.recoveryAttempts >= DatabaseManager.MAX_RECOVERY_ATTEMPTS) {
          logger.error('PostgreSQL failed to recover after max attempts. Stopping auto-recovery to prevent terminal window storm.');
          this.status = 'ERROR';
          return;
        }
        this.recoveryAttempts++;
        logger.warn(`Database connection lost on port 5433. Recovery attempt ${this.recoveryAttempts}/${DatabaseManager.MAX_RECOVERY_ATTEMPTS}...`);
        this.status = 'STOPPED';
        this.start().catch((e) => logger.error(`Database auto-recovery failed: ${e.message}`));
      }
    }, 4000);
  }

  private getDataAndBinDirs(): { dataDir: string; pgCtlBin: string; postgresBin: string } {
    const platformDir = getPlatformDir();
    const fallbackPgCtl = path.join(platformDir, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'pg_ctl.exe');
    const fallbackPostgres = path.join(platformDir, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'postgres.exe');
    const fallbackDataDir = path.join(platformDir, 'packages', 'db', '.localdb');

    if (app.isPackaged) {
      let dataDir = path.join(app.getPath('userData'), 'database');
      let pgCtlBin = path.join(process.resourcesPath, 'postgres', 'bin', 'pg_ctl.exe');
      let postgresBin = path.join(process.resourcesPath, 'postgres', 'bin', 'postgres.exe');
      const defaultDbDir = path.join(process.resourcesPath, 'default-db');

      if (!fs.existsSync(pgCtlBin) && fs.existsSync(fallbackPgCtl)) {
        pgCtlBin = fallbackPgCtl;
        postgresBin = fallbackPostgres;
      }

      // Initialize database directory from template if not present
      if (!fs.existsSync(dataDir)) {
        if (fs.existsSync(defaultDbDir)) {
          logger.info(`Seeding initial database template from ${defaultDbDir}...`);
          fs.mkdirSync(dataDir, { recursive: true });
          fs.cpSync(defaultDbDir, dataDir, { recursive: true });
        } else if (fs.existsSync(fallbackDataDir)) {
          dataDir = fallbackDataDir;
        }
      }
      return { dataDir, pgCtlBin, postgresBin };
    } else {
      return { dataDir: fallbackDataDir, pgCtlBin: fallbackPgCtl, postgresBin: fallbackPostgres };
    }
  }

  public async start(): Promise<void> {
    this.isShuttingDown = false;
    if (this.status === 'RUNNING') return;

    // 1. Check if database is already running on port 5433
    const isUp = await this.isPortOpen(5433);
    if (isUp) {
      this.status = 'RUNNING';
      logger.info('Database is ALREADY RUNNING on port 5433');
      this.startHealthMonitor();
      return;
    }

    this.status = 'STARTING';
    logger.info('Starting Local PostgreSQL Database on port 5433...');

    const { dataDir, pgCtlBin, postgresBin } = this.getDataAndBinDirs();

    // 2. Ensure all required PostgreSQL internal subdirectories exist
    const pgDirs = [
      'base',
      'global',
      'pg_commit_ts',
      'pg_dynshmem',
      'pg_logical',
      path.join('pg_logical', 'mappings'),
      path.join('pg_logical', 'snapshots'),
      'pg_multixact',
      path.join('pg_multixact', 'members'),
      path.join('pg_multixact', 'offsets'),
      'pg_notify',
      'pg_replslot',
      'pg_serial',
      'pg_snapshots',
      'pg_stat',
      'pg_stat_tmp',
      'pg_subtrans',
      'pg_tblspc',
      'pg_twophase',
      'pg_wal',
      path.join('pg_wal', 'archive_status'),
      path.join('pg_wal', 'summaries'),
      'pg_xact',
    ];

    for (const dir of pgDirs) {
      const p = path.join(dataDir, dir);
      if (!fs.existsSync(p)) {
        try {
          fs.mkdirSync(p, { recursive: true });
        } catch {}
      }
    }

    // 3. Clean up stale postmaster.pid lock file if server is not running
    const pidFile = path.join(dataDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
        logger.info('Cleaned up stale postmaster.pid lock file');
      } catch (err) {
        logger.warn('Could not remove postmaster.pid:', err);
      }
    }

    // 4. Remove any git .keep files from database directory that interfere with PostgreSQL 18
    try {
      const purgeKeepFiles = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            purgeKeepFiles(full);
          } else if (entry.name === '.keep') {
            try { fs.unlinkSync(full); } catch {}
          }
        }
      };
      purgeKeepFiles(dataDir);
    } catch {}

    logger.info(`PostgreSQL binary: ${postgresBin}`);
    logger.info(`PostgreSQL data directory: ${dataDir}`);

    const logFile = app.isPackaged
      ? path.join(app.getPath('userData'), 'postgres.log')
      : path.join(dataDir, 'pg.log');

    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      try {
        // Guarantee postgres.exe and pg_ctl.exe are GUI subsystem binaries before execution.
        // When Subsystem = 2 (GUI), Windows never allocates a console window and Windows Terminal
        // will NEVER intercept the main process or any of its worker child processes.
        ensureGuiSubsystem(postgresBin);
        ensureGuiSubsystem(pgCtlBin);

        const outLog = fs.openSync(logFile, 'a');
        const pgEnv = { ...process.env } as Record<string, string>;
        delete pgEnv['WT_SESSION'];
        delete pgEnv['WT_PROFILE_ID'];

        const child = spawn(postgresBin, ['-D', dataDir, '-p', '5433'], {
          cwd: path.dirname(postgresBin),
          windowsHide: true,
          detached: false,
          stdio: ['ignore', outLog, outLog],
          env: pgEnv,
        });

        this.dbProcess = child;
        this.dbPid = child.pid ?? null;
        logger.info(`PostgreSQL spawned directly with PID: ${this.dbPid}`);

        child.on('error', (err) => {
          logger.error(`PostgreSQL process error: ${err.message}`);
        });

        child.on('close', (code) => {
          logger.warn(`PostgreSQL process exited with code ${code}`);
          this.dbProcess = null;
          this.dbPid = null;
          if (this.status === 'RUNNING' && !this.isShuttingDown) {
            this.status = 'STOPPED';
          }
        });
      } catch (err: any) {
        logger.error(`Failed to launch postgres.exe: ${err.message}`);
        this.status = 'ERROR';
        reject(err);
        return;
      }

      // Probe TCP connectivity to port 5433 actively
      const probeInterval = setInterval(async () => {
        const up = await this.isPortOpen(5433);
        if (up && !resolved) {
          resolved = true;
          clearInterval(probeInterval);
          this.status = 'RUNNING';
          logger.info('Local PostgreSQL Database is now RUNNING on port 5433 (verified via TCP)');
          this.startHealthMonitor();
          resolve();
        }
      }, 500);

      // 45-second timeout fallback
      setTimeout(async () => {
        if (!resolved) {
          clearInterval(probeInterval);
          const up = await this.isPortOpen(5433);
          if (up) {
            resolved = true;
            this.status = 'RUNNING';
            logger.info('Database startup timeout elapsed, but port 5433 is now up');
            this.startHealthMonitor();
            resolve();
          } else {
            let logTail = '';
            if (fs.existsSync(logFile)) {
              try {
                const content = fs.readFileSync(logFile, 'utf8');
                logTail = content.slice(-600);
              } catch {}
            }
            logger.error(`Database startup timed out on port 5433. Log:\n${logTail}`);
            this.status = 'ERROR';
            reject(new Error('PostgreSQL did not become healthy on port 5433 within timeout'));
          }
        }
      }, 45000);
    });
  }

  public stop(): void {
    this.isShuttingDown = true;
    logger.info('Stopping Local PostgreSQL Database...');

    // Stop the health monitor first
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Terminate PostgreSQL by PID using Node's process.kill which maps directly to
    // Win32 TerminateProcess API — 100% silent, no cmd.exe or taskkill.exe console spawned.
    const pidToKill = this.dbPid ?? this.dbProcess?.pid;
    if (pidToKill) {
      try {
        process.kill(pidToKill, 'SIGTERM');
        logger.info(`Terminated PostgreSQL process PID ${pidToKill}`);
      } catch (err: any) {
        try {
          process.kill(pidToKill, 'SIGKILL');
        } catch {}
      }
    }

    if (this.dbProcess) {
      try { this.dbProcess.kill(); } catch {}
      this.dbProcess = null;
    }
    this.dbPid = null;
    this.status = 'STOPPED';
  }

  public getStatus() {
    return this.status;
  }
}

export const dbManager = new DatabaseManager();
