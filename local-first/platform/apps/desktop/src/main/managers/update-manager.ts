import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { logger } from '../logger';

export type DesktopUpdateState =
  | 'IDLE'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'ERROR';

export interface DesktopUpdateStatus {
  state: DesktopUpdateState;
  currentVersion: string;
  targetVersion?: string;
  progressPercent?: number;
  error?: string;
  releaseNotes?: string | string[];
}

export class DesktopUpdateManager {
  private state: DesktopUpdateState = 'IDLE';
  private targetVersion?: string;
  private progressPercent?: number;
  private error?: string;
  private releaseNotes?: string | string[];
  private initialized = false;

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // Configure logger
    autoUpdater.logger = logger;

    // Automatically download updates in the background
    autoUpdater.autoDownload = true;

    // Do NOT force-restart immediately during active cashier/waiter operations.
    // Instead, safely apply update when the app is restarted or closed.
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      logger.info('[AutoUpdater] Checking for updates on GitHub Releases...');
      this.state = 'CHECKING';
      this.error = undefined;
    });

    autoUpdater.on('update-available', (info) => {
      logger.info(`[AutoUpdater] Update available: v${info.version}`);
      this.state = 'AVAILABLE';
      this.targetVersion = info.version;
      this.releaseNotes = info.releaseNotes as any;
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info(`[AutoUpdater] App is up to date (current: v${app.getVersion()})`);
      this.state = 'NOT_AVAILABLE';
      this.targetVersion = undefined;
    });

    autoUpdater.on('error', (err) => {
      logger.warn(`[AutoUpdater] Update check encountered error or offline: ${err?.message || err}`);
      this.state = 'ERROR';
      this.error = err?.message || 'Could not connect to update server';
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.state = 'DOWNLOADING';
      this.progressPercent = Math.round(progressObj.percent);
      logger.info(`[AutoUpdater] Download progress: ${this.progressPercent}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info(`[AutoUpdater] Update v${info.version} downloaded and ready to install.`);
      this.state = 'DOWNLOADED';
      this.targetVersion = info.version;
    });

    // In production, check for updates automatically 15 seconds after launch
    if (app.isPackaged) {
      setTimeout(() => {
        this.checkForUpdates().catch((err) => {
          logger.warn(`[AutoUpdater] Initial update check error: ${err.message}`);
        });
      }, 15000);
    }
  }

  public getStatus(): DesktopUpdateStatus {
    return {
      state: this.state,
      currentVersion: app.getVersion(),
      targetVersion: this.targetVersion,
      progressPercent: this.progressPercent,
      error: this.error,
      releaseNotes: this.releaseNotes,
    };
  }

  public async checkForUpdates(): Promise<{
    updateAvailable: boolean;
    version?: string;
    message: string;
  }> {
    if (!app.isPackaged) {
      logger.info('[AutoUpdater] Skipping update check in development mode');
      return {
        updateAvailable: false,
        message: 'Update checks are enabled in packaged production builds.',
      };
    }

    try {
      this.state = 'CHECKING';
      const result = await autoUpdater.checkForUpdates();
      const isAvailable = !!result?.updateInfo && result.updateInfo.version !== app.getVersion();
      return {
        updateAvailable: isAvailable,
        version: result?.updateInfo?.version,
        message: isAvailable
          ? `Version ${result?.updateInfo?.version} is available and downloading in background.`
          : `ChayaOne is up to date (v${app.getVersion()}).`,
      };
    } catch (err: any) {
      this.state = 'ERROR';
      this.error = err?.message || 'Update check failed';
      return {
        updateAvailable: false,
        message: `Unable to check for updates: ${this.error}`,
      };
    }
  }

  public quitAndInstall() {
    logger.info('[AutoUpdater] User requested quit and install.');
    autoUpdater.quitAndInstall(false, true);
  }
}

export const desktopUpdateManager = new DesktopUpdateManager();
