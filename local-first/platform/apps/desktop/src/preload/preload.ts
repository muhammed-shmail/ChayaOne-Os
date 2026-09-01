import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'chayaOne',
  {
    getPrinterStatus: () => ipcRenderer.invoke('get-printer-status'),
    getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
    print: (payload: any) => ipcRenderer.invoke('print-job', payload)
  }
);
