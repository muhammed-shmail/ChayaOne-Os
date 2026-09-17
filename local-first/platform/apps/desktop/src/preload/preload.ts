import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'chayaOne',
  {
    getPrinterStatus: () => ipcRenderer.invoke('get-printer-status'),
    getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    getDatabaseStatus: () => ipcRenderer.invoke('get-database-status'),
    getWebsocketStatus: () => ipcRenderer.invoke('get-websocket-status'),
    getSystemHealth: () => ipcRenderer.invoke('get-system-health'),
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
    getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    print: (payload: any) => ipcRenderer.invoke('print-job', payload),
    getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
    getInstallationId: () => ipcRenderer.invoke('get-installation-id'),
    restartService: (serviceName: string) => ipcRenderer.invoke('restart-service', serviceName),
    testPrint: () => ipcRenderer.invoke('test-print'),
  }
);
