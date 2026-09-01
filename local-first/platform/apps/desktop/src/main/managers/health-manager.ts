import { dbManager } from './database-manager';
import { serverManager } from './server-manager';
import { wsManager } from './websocket-manager';
import { printerManager } from './printer-manager';

export class HealthManager {
  public getSystemHealth() {
    return {
      database: dbManager.getStatus(),
      server: serverManager.getStatus(),
      websocket: wsManager.getStatus(),
      printer: printerManager.getStatus(),
      isHealthy: 
        dbManager.getStatus() === 'RUNNING' &&
        serverManager.getStatus() === 'RUNNING' &&
        wsManager.getStatus() === 'RUNNING'
    };
  }
}

export const healthManager = new HealthManager();
