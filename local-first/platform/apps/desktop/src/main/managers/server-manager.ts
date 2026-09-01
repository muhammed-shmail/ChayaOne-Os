import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../logger';

export class ServerManager {
  private serverProcess: ChildProcess | null = null;
  public status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' = 'STOPPED';

  public async start(): Promise<void> {
    if (this.status === 'RUNNING' || this.status === 'STARTING') return;
    this.status = 'STARTING';
    logger.info('Starting Next.js Server...');

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('npm', ['run', '-w', '@cafeos/web', 'dev'], {
        shell: true,
        cwd: path.resolve(__dirname, '../../../../..')
      });

      this.serverProcess.stdout?.on('data', (data) => {
        const out = data.toString();
        // Don't log every single Next.js line to info, keep it debug
        logger.debug(`[Web] ${out.trim()}`);
        if (out.includes('Ready in') || out.includes('started server on')) {
          this.status = 'RUNNING';
          logger.info('Next.js Server is now RUNNING on port 3000');
          resolve();
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        logger.error(`[Web ERROR] ${data.toString().trim()}`);
      });

      this.serverProcess.on('close', (code) => {
        const wasStarting = this.status === 'STARTING';
        this.status = 'STOPPED';
        logger.warn(`Next.js Server process exited with code ${code}`);
        if (wasStarting) reject(new Error(`Process exited with code ${code}`));
      });
      
      this.serverProcess.on('error', (err) => {
        const wasStarting = this.status === 'STARTING';
        this.status = 'ERROR';
        logger.error(`Next.js Server process error: ${err.message}`);
        if (wasStarting) reject(err);
      });
      
      // Resolve anyway after a timeout just in case it doesn't emit the exact string
      setTimeout(() => {
        if (this.status === 'STARTING') {
          this.status = 'RUNNING';
          logger.warn('Server startup timeout reached, assuming it is RUNNING');
          resolve();
        }
      }, 8000);
    });
  }

  public stop(): void {
    if (this.serverProcess) {
      logger.info('Stopping Next.js Server...');
      this.serverProcess.kill();
      this.serverProcess = null;
      this.status = 'STOPPED';
    }
  }

  public getStatus() {
    return this.status;
  }
}

export const serverManager = new ServerManager();
