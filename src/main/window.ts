import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import { WINDOW_CONFIG } from '../shared/constants.js';
import type { ISettings } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MainWindowService {
  create(settings: ISettings): BrowserWindow;
  getWindow(): BrowserWindow | null;
  toggleAlwaysOnTop(): boolean;
  isAlwaysOnTop(): boolean;
}

/**
 * Create the main window service
 */
export function createMainWindowService(): MainWindowService {
  let mainWindow: BrowserWindow | null = null;

  return {
    create(settings: ISettings): BrowserWindow {
      const isMac = platform() === 'darwin';

      mainWindow = new BrowserWindow({
        width: WINDOW_CONFIG.DEFAULT_WIDTH,
        height: WINDOW_CONFIG.DEFAULT_HEIGHT,
        minWidth: WINDOW_CONFIG.MIN_WIDTH,
        minHeight: WINDOW_CONFIG.MIN_HEIGHT,
        alwaysOnTop: settings.alwaysOnTop,
        webPreferences: {
          preload: path.join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
        // macOS: hidden titlebar with traffic lights
        // Windows/Linux: default system titlebar
        ...(isMac && {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 10, y: 10 },
        }),
      });

      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

      mainWindow.on('closed', () => {
        mainWindow = null;
      });

      return mainWindow;
    },

    getWindow(): BrowserWindow | null {
      return mainWindow;
    },

    toggleAlwaysOnTop(): boolean {
      if (!mainWindow) {
        return false;
      }
      const newState = !mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(newState);
      return newState;
    },

    isAlwaysOnTop(): boolean {
      return mainWindow?.isAlwaysOnTop() ?? false;
    },
  };
}
