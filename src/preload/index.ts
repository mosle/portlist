import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants.js';
import type { IPortInfo, ISettings } from '../shared/types.js';

type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Electron API exposed to renderer process
 */
export interface ElectronAPI {
  // Platform info
  platform: Platform;

  // Port operations
  getPortList(): Promise<IPortInfo[]>;
  killProcess(pid: number): Promise<void>;
  onPortListUpdated(callback: (ports: IPortInfo[]) => void): () => void;

  // Settings
  getSettings(): Promise<ISettings>;
  updateSettings(settings: Partial<ISettings>): Promise<void>;

  // Window
  toggleAlwaysOnTop(): Promise<boolean>;
}

const electronAPI: ElectronAPI = {
  // Platform info
  platform: process.platform as Platform,

  // Port operations
  getPortList: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PORT_LIST),

  killProcess: (pid: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.KILL_PROCESS, pid),

  onPortListUpdated: (callback: (ports: IPortInfo[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ports: IPortInfo[]) => {
      callback(ports);
    };
    ipcRenderer.on(IPC_CHANNELS.PORT_LIST_UPDATED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PORT_LIST_UPDATED, handler);
    };
  },

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  updateSettings: (settings: Partial<ISettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),

  // Window
  toggleAlwaysOnTop: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_ALWAYS_ON_TOP),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
