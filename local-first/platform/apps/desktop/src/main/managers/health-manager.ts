import { dbManager } from './database-manager';
import { serverManager } from './server-manager';
import { wsManager } from './websocket-manager';
import { printerManager } from './printer-manager';

export class HealthManager {
  public getSystemHealth() {
    const dbStatus = dbManager.getStatus();
    const serverStatus = serverManager.getStatus();
    const wsStatus = wsManager.getStatus();
    const printerStatus = printerManager.getStatus();

    return {
      database: dbStatus,
      server: serverStatus,
      websocket: wsStatus,
      printer: printerStatus,
      isHealthy:
        dbStatus === 'RUNNING' &&
        serverStatus === 'RUNNING' &&
        wsStatus === 'RUNNING',
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthManager = new HealthManager();
