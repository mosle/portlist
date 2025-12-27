import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import type { IPortInfo, ISettings } from '../../shared/types.js';
import type { PortScannerService } from '../services/port-scanner.js';
import type { ProcessManagerService } from '../services/process-manager.js';
import type { SettingsStoreService } from '../services/settings-store.js';

export interface IPCDependencies {
  portScanner: PortScannerService;
  processManager: ProcessManagerService;
  settingsStore: SettingsStoreService;
  getMainWindow: () => BrowserWindow | null;
}

/**
 * Register IPC handlers for the main process
 */
export function registerIPCHandlers(deps: IPCDependencies): void {
  const { portScanner, processManager, settingsStore, getMainWindow } = deps;

  // Get port list
  ipcMain.handle(IPC_CHANNELS.GET_PORT_LIST, async (): Promise<IPortInfo[]> => {
    const result = await portScanner.getPortList();
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error.message);
  });

  // Kill process
  ipcMain.handle(
    IPC_CHANNELS.KILL_PROCESS,
    async (_event, pid: number): Promise<void> => {
      const result = await processManager.killProcess(pid);
      if (!result.success) {
        throw new Error(
          result.error.type === 'UNKNOWN'
            ? result.error.message
            : `${result.error.type}: ${result.error.pid}`
        );
      }
    }
  );

  // Get settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): ISettings => {
    return settingsStore.getSettings();
  });

  // Update settings
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_SETTINGS,
    (_event, settings: Partial<ISettings>): void => {
      settingsStore.updateSettings(settings);
    }
  );

  // Toggle always on top
  ipcMain.handle(IPC_CHANNELS.TOGGLE_ALWAYS_ON_TOP, (): boolean => {
    const win = getMainWindow();
    if (!win) {
      return false;
    }

    const isAlwaysOnTop = win.isAlwaysOnTop();
    win.setAlwaysOnTop(!isAlwaysOnTop);
    settingsStore.updateSettings({ alwaysOnTop: !isAlwaysOnTop });
    return !isAlwaysOnTop;
  });
}

/**
 * Send port list update to renderer
 */
export function sendPortListUpdate(win: BrowserWindow, ports: IPortInfo[]): void {
  win.webContents.send(IPC_CHANNELS.PORT_LIST_UPDATED, ports);
}
