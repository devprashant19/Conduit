import { contextBridge, ipcRenderer } from 'electron';

export interface ConduitDesktopAPI {
  isDesktop: boolean;
  platform: string;
  selectDirectory: () => Promise<string | null>;
  showNotification: (title: string, body: string) => void;
  getAppVersion: () => Promise<string>;
  onDaemonStatus: (callback: (status: { ready: boolean; port: number; error?: string }) => void) => void;
}

const desktopAPI: ConduitDesktopAPI = {
  isDesktop: true,
  platform: process.platform,
  selectDirectory: async () => {
    return await ipcRenderer.invoke('conduit:select-directory');
  },
  showNotification: (title: string, body: string) => {
    ipcRenderer.send('conduit:notification', { title, body });
  },
  getAppVersion: async () => {
    return await ipcRenderer.invoke('conduit:get-version');
  },
  onDaemonStatus: (callback) => {
    ipcRenderer.on('conduit:daemon-status', (_event, status) => callback(status));
  },
};

contextBridge.exposeInMainWorld('conduitDesktop', desktopAPI);
