import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

export const logger = {
  info: (msg: string, ...args: any[]) => log.info(`[ChayaOne] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => log.error(`[ChayaOne ERROR] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => log.warn(`[ChayaOne WARN] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => log.debug(`[ChayaOne DEBUG] ${msg}`, ...args),
};
