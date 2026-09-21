import log from 'electron-log';

import { app } from 'electron';

log.transports.file.level = 'info';
log.transports.file.sync = true; // Synchronous disk writes so exit logs are never lost
log.transports.console.level = (typeof app !== 'undefined' && app.isPackaged) ? false : 'debug';

// Ignore broken pipe errors on stdio for detached GUI processes
try {
  process.stdout?.on?.('error', () => {});
  process.stderr?.on?.('error', () => {});
} catch {}

export const logger = {
  info: (msg: string, ...args: any[]) => log.info(`[ChayaOne] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => log.error(`[ChayaOne ERROR] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => log.warn(`[ChayaOne WARN] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => log.debug(`[ChayaOne DEBUG] ${msg}`, ...args),
};
