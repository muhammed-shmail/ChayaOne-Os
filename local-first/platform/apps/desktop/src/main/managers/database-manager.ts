import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../logger';

export class DatabaseManager {
  private dbProcess: ChildProcess | null = null;
  public status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' = 'STOPPED';

  public async start(): Promise<void> {
    if (this.status === 'RUNNING' || this.status === 'STARTING') return;
    this.status = 'STARTING';
    logger.info('Starting Local Database...');

    return new Promise((resolve, reject) => {
      // Assuming the desktop app runs from the monorepo root or packaged equivalent
      // In production, we'd bundle the DB binary or use a packaged script.
      // For this phase, we use the npm script from the workspace.
      this.dbProcess = spawn('npm', ['run', '-w', '@cafeos/db', 'local'], {
        shell: true,
        cwd: path.resolve(__dirname, '../../../../..')
      });

      this.dbProcess.stdout?.on('data', (data) => {
        const out = data.toString();
        logger.debug(`[DB] ${out.trim()}`);
        if (out.includes('database system is ready to accept connections')) {
          this.status = 'RUNNING';
          logger.info('Database is now RUNNING');
          resolve();
        }
      });

      this.dbProcess.stderr?.on('data', (data) => {
        logger.error(`[DB ERROR] ${data.toString().trim()}`);
      });

      this.dbProcess.on('close', (code) => {
        const wasStarting = this.status === 'STARTING';
        this.status = 'STOPPED';
        logger.warn(`Database process exited with code ${code}`);
        if (wasStarting) reject(new Error(`Process exited with code ${code}`));
      });
      
      this.dbProcess.on('error', (err) => {
        const wasStarting = this.status === 'STARTING';
        this.status = 'ERROR';
        logger.error(`Database process error: ${err.message}`);
        if (wasStarting) reject(err);
      });
      
      // Resolve anyway after a timeout just in case it doesn't emit the exact string
      setTimeout(() => {
        if (this.status === 'STARTING') {
          this.status = 'RUNNING';
          logger.warn('Database startup timeout reached, assuming it is RUNNING');
          resolve();
        }
      }, 5000);
    });
  }

  public stop(): void {
    if (this.dbProcess) {
      logger.info('Stopping Local Database...');
      this.dbProcess.kill();
      this.dbProcess = null;
      this.status = 'STOPPED';
    }
  }

  public getStatus() {
    return this.status;
  }
}

export const dbManager = new DatabaseManager();
