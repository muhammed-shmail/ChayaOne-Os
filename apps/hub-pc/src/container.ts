/**
 * Hub service wiring: the single place that exposes the PC hub's managers
 * (database, web server, realtime hub, printers, health, updates, tunnel).
 * bootstrap.ts starts them in order.
 */
export { dbManager } from './database/database-manager';
export { serverManager } from './managers/server-manager';
export { wsManager } from './managers/websocket-manager';
export { printerManager } from './printers/printer-manager';
export { healthManager } from './managers/health-manager';
export { desktopUpdateManager } from './updater/update-manager';
export { tunnelManager } from './managers/tunnel-manager';
