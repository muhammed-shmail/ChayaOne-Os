import { logger } from '../logger';
import * as http from 'http';

export interface DesktopUpdateStatus {
  state: string;
  currentVersion: string;
  targetVersion?: string;
  isBusy: boolean;
}

export class DesktopUpdateManager {
  private currentVersion: string = '1.0.0';

  public async getStatus(): Promise<DesktopUpdateStatus> {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3000/api/system/updates', (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({
              state: parsed.state || 'IDLE',
              currentVersion: parsed.currentVersion || this.currentVersion,
              targetVersion: parsed.targetVersion,
              isBusy: parsed.isCafeBusy || false,
            });
          } catch {
            resolve({ state: 'IDLE', currentVersion: this.currentVersion, isBusy: false });
          }
        });
      });
      req.on('error', () => {
        resolve({ state: 'IDLE', currentVersion: this.currentVersion, isBusy: false });
      });
      req.setTimeout(2000, () => {
        req.destroy();
        resolve({ state: 'IDLE', currentVersion: this.currentVersion, isBusy: false });
      });
    });
  }

  public async checkForUpdates(): Promise<any> {
    logger.info('[Desktop Updater] Probing for updates...');
    return new Promise((resolve) => {
      const postData = JSON.stringify({ action: 'check' });
      const req = http.request(
        'http://localhost:3000/api/system/updates',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ updateAvailable: false, message: 'Parse error' });
            }
          });
        }
      );
      req.on('error', (e) => {
        logger.warn(`[Desktop Updater] Update check offline: ${e.message}`);
        resolve({ updateAvailable: false, offline: true, message: 'Offline' });
      });
      req.write(postData);
      req.end();
    });
  }
}

export const desktopUpdateManager = new DesktopUpdateManager();
