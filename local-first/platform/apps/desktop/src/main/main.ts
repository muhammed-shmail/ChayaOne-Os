import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { logger } from './logger';
import { dbManager } from './managers/database-manager';
import { serverManager } from './managers/server-manager';
import { wsManager } from './managers/websocket-manager';
import { printerManager } from './managers/printer-manager';
import { healthManager } from './managers/health-manager';
import { desktopUpdateManager } from './managers/update-manager';

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('Another instance is already running. Quitting this instance.');
  app.quit();
  process.exit(0); // Ensure immediate exit
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  logger.info('Creating main POS window...');
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    logger.error(`Failed to load URL: ${errorDescription} (${errorCode})`);
    // Load a simple error message instead of staying blank
    mainWindow?.loadURL(`data:text/html;charset=utf-8,
      <html>
        <body style="font-family: sans-serif; padding: 2rem;">
          <h2>Failed to connect to Local Server</h2>
          <p>Please ensure the Next.js server is running on port 3000.</p>
          <p>Error: ${errorDescription} (${errorCode})</p>
        </body>
      </html>
    `);
  });

  // For now, load a local loading file or straight to localhost:3000 if Next.js is running.
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startServices() {
  try {
    logger.info('Starting local services...');
    await printerManager.start();
    await dbManager.start();
    await wsManager.start();
    await serverManager.start();
    
    const health = healthManager.getSystemHealth();
    if (!health.isHealthy) {
      logger.error('One or more services failed to start correctly', health);
      // We would show a diagnostic screen here
    }
  } catch (err) {
    logger.error('Error starting services:', err);
  }
}

function stopServices() {
  serverManager.stop();
  wsManager.stop();
  dbManager.stop();
  printerManager.stop();
}

app.on('second-instance', () => {
  logger.info('Second instance requested. Focusing main window.');
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  logger.info('Electron app is ready.');
  
  // Register basic IPC handlers
  ipcMain.handle('get-printer-status', () => { return printerManager.getStatus(); });
  ipcMain.handle('get-server-status', () => { return serverManager.getStatus(); });
  ipcMain.handle('get-network-info', () => { return healthManager.getSystemHealth(); });
  ipcMain.handle('get-update-status', async () => { return await desktopUpdateManager.getStatus(); });
  ipcMain.handle('check-for-updates', async () => { return await desktopUpdateManager.checkForUpdates(); });
  ipcMain.handle('print-job', async (_, payload) => { 
    return await printerManager.print(payload);
  });

  await startServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('All windows closed. Quitting application.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  logger.info('Application will quit. Stopping services...');
  stopServices();
});

