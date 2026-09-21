import { app, BrowserWindow, ipcMain, Menu, Tray, shell, nativeImage, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import http from 'http';
import { logger } from './logger';
import { dbManager } from './managers/database-manager';
import { serverManager } from './managers/server-manager';
import { wsManager } from './managers/websocket-manager';
import { printerManager } from './managers/printer-manager';
import { healthManager } from './managers/health-manager';
import { desktopUpdateManager } from './managers/update-manager';
import { tunnelManager } from './managers/tunnel-manager';

// ──────────────────────────────────────────────────────────────────────────────
// Windows 11 Terminal Fix: Remove Windows Terminal session environment variables
// from this process so no child process (postgres, Next.js, cloudflared, etc.)
// can inherit them. When WT_SESSION is present, Windows Terminal intercepts ALL
// new console processes and opens them in a visible WT window — even when
// windowsHide:true is set. Deleting it here fixes the bug globally.
// ──────────────────────────────────────────────────────────────────────────────
delete process.env['WT_SESSION'];
delete process.env['WT_PROFILE_ID'];

process.on('uncaughtException', (err) => {
  logger.error('CRITICAL UNCAUGHT EXCEPTION in Main Process:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL UNHANDLED REJECTION in Main Process:', reason);
});

process.on('exit', (code) => {
  logger.info(`Main process exiting with code: ${code}`);
});

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('Another instance is already running. Quitting this instance.');
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isCreatingWindow = false;

function getAppIcon(): string | undefined {
  const candidates = [
    path.resolve(process.resourcesPath || '', 'icon.ico'),
    path.resolve(process.resourcesPath || '', 'icon.png'),
    path.resolve(__dirname, '../../resources/icon.ico'),
    path.resolve(__dirname, '../../resources/icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}



function getSplashPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../../resources/splash.html'),
    path.join(process.resourcesPath || '', 'resources/splash.html'),
    path.join(process.resourcesPath || '', 'splash.html'),
    path.join(__dirname, '../resources/splash.html'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function isServerReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3000/api/server/info', { agent: false }, (res) => {
      res.resume();
      // Only treat server as ready when status is HTTP 200 (database WAL recovery finished)
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => { req.destroy(); resolve(false); });
  });
}

function getInstallationId(): string {
  try {
    const isWindows = process.platform === 'win32';
    const programData = isWindows
      ? process.env.ProgramData || 'C:\\ProgramData'
      : path.join(process.env.HOME || '', '.config');
    const installFile = path.join(programData, 'ChayaOne', 'config', 'installation.json');
    if (fs.existsSync(installFile)) {
      const data = JSON.parse(fs.readFileSync(installFile, 'utf-8'));
      if (data.installationId) return data.installationId;
    }
  } catch {}
  return 'CHAYAONE-INSTALL-PENDING';
}

async function resolveInitialRoute(): Promise<string> {
  const routeArg = process.argv.find((arg) => arg.startsWith('--route='));
  if (routeArg && routeArg.split('=')[1]) {
    const custom = routeArg.split('=')[1]!;
    return custom.startsWith('/') ? custom : `/${custom}`;
  }

  // Check setup & license state from local server
  try {
    const statusData = await new Promise<any>((resolve) => {
      const req = http.get('http://127.0.0.1:3000/api/license/status', (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(null);
      });
    });

    if (statusData) {
      if (statusData.status === 'EXPIRED' || statusData.isBlocked) {
        logger.warn('License is expired or blocked. Directing to /expired');
        return '/expired';
      }
      if (statusData.isSetupRequired) {
        logger.info('System setup required. Directing to /setup');
        return '/setup';
      }
    }
  } catch (err) {
    logger.error('Error querying license status during launch route resolution:', err);
  }

  return '/pos';
}

async function createWindow() {
  if (isCreatingWindow) return;
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  isCreatingWindow = true;
  try {
    logger.info('Creating main POS window...');

    const icon = getAppIcon();
    const splashPath = getSplashPath();
    const route = await resolveInitialRoute();
    const targetUrl = `http://127.0.0.1:3000${route.startsWith('/') ? '' : '/'}${route}`;

    // Disable default top menu bar
    Menu.setApplicationMenu(null);

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      title: 'ChayaOne OS — Main PC Desktop App',
      backgroundColor: '#090d16',
      autoHideMenuBar: true,
      icon,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    mainWindow.removeMenu();

    // Forward renderer console logs to main process logger & auto-recover from chunk load errors
    let isReloadingOnError = false;
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      logger.info(`[Renderer L${level}] ${message} (${sourceId}:${line})`);
      if (!isReloadingOnError && (message.includes('ChunkLoadError') || message.includes('Loading chunk') || message.includes('Minified React error #423'))) {
        isReloadingOnError = true;
        logger.warn('Detected ChunkLoadError / React error in renderer. Auto-reloading page...');
        setTimeout(() => {
          isReloadingOnError = false;
          mainWindow?.webContents.reloadIgnoringCache();
        }, 1200);
      }
    });

    // Keyboard shortcuts: F11 (Fullscreen), F5 / Ctrl+R (Reload), F12 (DevTools)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') {
        mainWindow?.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      } else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
        mainWindow?.webContents.reload();
        event.preventDefault();
      } else if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });

    mainWindow.once('ready-to-show', () => {
      logger.info('Main window ready-to-show event fired. Displaying window.');
      mainWindow?.show();
      mainWindow?.focus();
    });

    // Fallback: Ensure window is visible even if ready-to-show is delayed by hardware driver
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        logger.info('Fallback: Displaying main window via timeout.');
        mainWindow.show();
        mainWindow.focus();
      }
    }, 1500);

    let pollInterval: NodeJS.Timeout | null = null;

    const startReadyPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        if (!mainWindow) {
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = null;
          return;
        }
        const ready = await isServerReady();
        if (ready) {
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = null;
          logger.info('Server detected on port 3000! Transitioning to:', targetUrl);
          mainWindow.loadURL(targetUrl);
          if (!mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      }, 800);
    };

    const serverUp = await isServerReady();

    if (serverUp) {
      logger.info('Server is running on port 3000. Loading target URL:', targetUrl);
      mainWindow.loadURL(targetUrl);
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
    } else if (splashPath) {
      logger.info('Server initializing on port 3000. Displaying branded splash screen...');
      mainWindow.loadFile(splashPath, { query: { target: route } });
      startReadyPolling();
    } else {
      mainWindow.loadURL(targetUrl);
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
    }

    mainWindow.webContents.on('will-redirect', (event, newUrl) => {
      if (newUrl.includes('0.0.0.0')) {
        event.preventDefault();
        const corrected = newUrl.replace('0.0.0.0', '127.0.0.1');
        logger.info(`Intercepted redirect with 0.0.0.0 -> ${corrected}`);
        mainWindow?.loadURL(corrected);
      }
    });

    mainWindow.webContents.on('will-navigate', (event, newUrl) => {
      if (newUrl.includes('0.0.0.0')) {
        event.preventDefault();
        const corrected = newUrl.replace('0.0.0.0', '127.0.0.1');
        logger.info(`Intercepted navigation with 0.0.0.0 -> ${corrected}`);
        mainWindow?.loadURL(corrected);
      }
    });

    mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return; // Ignore ERR_ABORTED
      logger.warn(`Window failed to load: ${errorDescription} (${errorCode}) for: ${validatedURL}`);
      if (validatedURL && validatedURL.includes('0.0.0.0')) {
        const corrected = validatedURL.replace('0.0.0.0', '127.0.0.1');
        logger.info(`did-fail-load intercepted 0.0.0.0, redirecting to: ${corrected}`);
        mainWindow?.loadURL(corrected);
        return;
      }
      if (errorCode === -310 || (validatedURL && validatedURL.includes('/api/auth/refresh'))) {
        logger.info('Redirect loop detected; falling back directly to /login');
        mainWindow?.loadURL('http://127.0.0.1:3000/login');
        return;
      }
      if (splashPath && mainWindow && !validatedURL?.includes('splash.html')) {
        mainWindow.loadFile(splashPath, { query: { target: route } });
        startReadyPolling();
      }

    });

    mainWindow.on('close', (event) => {
      // ALWAYS hide to tray on close — never destroy the window while app is running.
      if (!isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
        logger.info('Main POS window hidden to system tray. Background server remains active.');
        return false;
      }
    });

    mainWindow.on('closed', () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      mainWindow = null;
    });
  } finally {
    isCreatingWindow = false;
  }
}

async function startServices() {
  logger.info('Starting local services...');
  try {
    await printerManager.start();
  } catch (err) {
    logger.error('Printer manager failed to start:', err);
  }

  try {
    await dbManager.start();
  } catch (err) {
    logger.error('Database manager failed to start:', err);
  }

  try {
    await wsManager.start();
  } catch (err) {
    logger.error('WebSocket manager failed to start:', err);
  }

  try {
    await serverManager.start();
  } catch (err) {
    logger.error('Server manager failed to start:', err);
  }

  // Start Customer 4G Tunnel asynchronously so it never blocks local POS startup
  tunnelManager.start().catch((err) => {
    logger.error('Customer 4G Tunnel failed to start:', err);
  });

  const health = healthManager.getSystemHealth();
  if (!health.isHealthy) {
    logger.warn('One or more services reported unhealthy status:', health);
  }
}

function stopServices() {
  tunnelManager.stop();
  serverManager.stop();
  wsManager.stop();
  dbManager.stop();
  printerManager.stop();
}

function createTray() {
  if (tray) return;
  const iconPath = getAppIcon();
  if (!iconPath) return;

  try {
    const iconImage = nativeImage.createFromPath(iconPath);
    tray = new Tray(iconImage);
    tray.setToolTip('ChayaOne OS — POS & Background Server');

    const updateTrayMenu = () => {
      const publicUrl = tunnelManager.getPublicUrl();
      const tunnelLabel = publicUrl
        ? `🌐 Customer 4G: ${publicUrl.replace('https://', '')}`
        : '🌐 Customer 4G Tunnel: Offline';

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open ChayaOne POS',
          click: () => {
            if (mainWindow) {
              if (!mainWindow.isVisible()) mainWindow.show();
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.focus();
            } else {
              createWindow();
            }
          },
        },
        {
          label: 'Server: RUNNING (:3000)',
          enabled: false,
        },
        {
          label: tunnelLabel,
          click: () => {
            if (publicUrl) {
              shell.openExternal(publicUrl);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Open POS in Browser',
          click: () => {
            shell.openExternal('http://localhost:3000/pos');
          },
        },
        {
          label: 'Open Kitchen Display (KDS)',
          click: () => {
            shell.openExternal('http://localhost:3000/kds');
          },
        },
        {
          label: 'Open Owner Dashboard',
          click: () => {
            shell.openExternal('http://localhost:3000/dashboard');
          },
        },
        { type: 'separator' },
        {
          label: 'Quit ChayaOne OS (Stop All Services)',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);

      tray?.setContextMenu(contextMenu);
    };

    updateTrayMenu();
    const showAndFocusWindow = () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.setAlwaysOnTop(true);
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
      } else {
        createWindow();
      }
    };

    tray.on('click', showAndFocusWindow);
    tray.on('double-click', showAndFocusWindow);
  } catch (err) {
    logger.warn('Failed to create system tray icon:', err);
  }
}

app.on('second-instance', (_event, commandLine) => {
  logger.info('Second instance requested. Focusing and bringing main window to front.');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);

    let routeLoaded = false;
    if (commandLine) {
      const routeArg = commandLine.find((arg: string) => arg.startsWith('--route='));
      if (routeArg) {
        const custom = routeArg.split('=')[1];
        if (custom) {
          const route = custom.startsWith('/') ? custom : `/${custom}`;
          mainWindow.loadURL(`http://127.0.0.1:3000${route}`);
          routeLoaded = true;
        }
      }
    }
    if (!routeLoaded) {
      const curUrl = mainWindow.webContents.getURL();
      if (!curUrl || curUrl.includes('about:blank')) {
        mainWindow.loadURL('http://127.0.0.1:3000/pos');
      }
    }
  } else {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(async () => {
  logger.info('Electron app is ready.');
  createTray();

  // Global network rewrite: Intercept any and all 0.0.0.0 requests and redirects at the Chromium level
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://0.0.0.0/*'] }, (details, callback) => {
    const redirectUrl = details.url.replace('0.0.0.0', '127.0.0.1');
    logger.info(`webRequest intercepted 0.0.0.0 URL -> ${redirectUrl}`);
    callback({ redirectURL: redirectUrl });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    let modified = false;
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'location' && headers[key]) {
        headers[key] = headers[key]!.map((loc) => {
          if (loc.includes('0.0.0.0')) {
            modified = true;
            return loc.replace('0.0.0.0', '127.0.0.1');
          }
          return loc;
        });
      }
    }

    if (modified) {
      logger.info('webRequest intercepted 0.0.0.0 Location header -> redirected to 127.0.0.1');
      callback({ responseHeaders: headers });
      return;
    }
    callback({});
  });


  // IPC Handlers
  ipcMain.handle('toggle-fullscreen', () => {
    if (mainWindow) {
      const next = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(next);
      return next;
    }
    return false;
  });
  ipcMain.handle('is-fullscreen', () => mainWindow?.isFullScreen() ?? false);
  ipcMain.handle('get-printer-status', () => printerManager.getStatus());
  ipcMain.handle('get-server-status', () => serverManager.getStatus());
  ipcMain.handle('get-database-status', () => dbManager.getStatus());
  ipcMain.handle('get-websocket-status', () => wsManager.getStatus());
  ipcMain.handle('get-system-health', () => healthManager.getSystemHealth());
  ipcMain.handle('get-network-info', () => healthManager.getSystemHealth());
  ipcMain.handle('get-update-status', async () => await desktopUpdateManager.getStatus());
  ipcMain.handle('check-for-updates', async () => await desktopUpdateManager.checkForUpdates());
  ipcMain.handle('get-installation-id', () => getInstallationId());
  
  ipcMain.handle('get-license-status', async () => {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:3000/api/license/status', (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(1500, () => { req.destroy(); resolve(null); });
    });
  });

  ipcMain.handle('restart-service', async (_, serviceName: string) => {
    logger.info(`Restarting service: ${serviceName}`);
    switch (serviceName) {
      case 'server':
        serverManager.stop();
        await serverManager.start();
        return { ok: true, service: 'server' };
      case 'database':
        dbManager.stop();
        await dbManager.start();
        return { ok: true, service: 'database' };
      case 'websocket':
        wsManager.stop();
        await wsManager.start();
        return { ok: true, service: 'websocket' };
      case 'printer':
        printerManager.stop();
        await printerManager.start();
        return { ok: true, service: 'printer' };
      case 'all':
        stopServices();
        await startServices();
        return { ok: true, service: 'all' };
      default:
        return { ok: false, error: 'Unknown service' };
    }
  });

  ipcMain.handle('print-job', async (_, payload) => {
    return await printerManager.print(payload);
  });

  ipcMain.handle('test-print', async () => {
    return await printerManager.print({
      orderId: 'TEST-DIAGNOSTIC',
      printerId: 'DEFAULT',
      title: '*** CHAYAONE DESKTOP TEST ***',
      timestamp: new Date().toISOString(),
      installationId: getInstallationId(),
    });
  });

  // Launch window immediately so user gets instant visual feedback with zero latency
  createWindow();
  await startServices();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // DO NOT quit here. ChayaOne is a tray-icon POS app — it must keep running
  // in the background even when all windows are closed. The server, PostgreSQL,
  // WebSocket hub, and Cloudflare Tunnel must stay alive.
  // The only way to quit is via the tray menu: "Quit ChayaOne OS".
  logger.info('All windows closed. App continues running in system tray (services still active).');
});

app.on('will-quit', () => {
  logger.info('Application will quit. Stopping services...');
  stopServices();
});
