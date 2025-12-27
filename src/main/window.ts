import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import { WINDOW_CONFIG } from '../shared/constants.js';
import type { ISettings, IWindowBounds } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MainWindowService {
  create(settings: ISettings, onBoundsChange: (bounds: IWindowBounds) => void): BrowserWindow;
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
    create(settings: ISettings, onBoundsChange: (bounds: IWindowBounds) => void): BrowserWindow {
      const isMac = platform() === 'darwin';
      const { windowBounds } = settings;

      mainWindow = new BrowserWindow({
        // Use saved position if available
        ...(windowBounds.x !== undefined && windowBounds.y !== undefined && {
          x: windowBounds.x,
          y: windowBounds.y,
        }),
        width: windowBounds.width,
        height: windowBounds.height,
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

      // Save bounds on resize/move (debounced)
      let boundsTimeout: NodeJS.Timeout | null = null;
      const saveBounds = () => {
        if (boundsTimeout) clearTimeout(boundsTimeout);
        boundsTimeout = setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            const bounds = mainWindow.getBounds();
            onBoundsChange({
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            });
          }
        }, 500);
      };

      mainWindow.on('resize', saveBounds);
      mainWindow.on('move', saveBounds);

      mainWindow.on('closed', () => {
        if (boundsTimeout) clearTimeout(boundsTimeout);
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
