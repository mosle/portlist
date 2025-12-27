import { app, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { createMainWindowService } from './window.js';
import { registerIPCHandlers, sendPortListUpdate } from './ipc/handlers.js';
import { createPortScanner } from './services/port-scanner.js';
import { createProcessManager } from './services/process-manager.js';
import { createSettingsStore, type StoreInterface } from './services/settings-store.js';
import { createPollingManager } from './services/polling-manager.js';
import { DEFAULT_SETTINGS, APP_NAME } from '../shared/constants.js';
import type { ISettings } from '../shared/types.js';

// Set app name (for macOS menu bar)
app.name = APP_NAME;

// Initialize services
const portScanner = createPortScanner();
const processManager = createProcessManager();

// Initialize electron-store with schema
const store = new Store<ISettings>({
  defaults: DEFAULT_SETTINGS,
  schema: {
    pollingInterval: { type: 'number', minimum: 1000, maximum: 60000 },
    alwaysOnTop: { type: 'boolean' },
    sortColumn: { type: 'string', enum: ['port', 'directory', 'command', 'pid', 'parent'] },
    sortDirection: { type: 'string', enum: ['asc', 'desc'] },
    filterText: { type: 'string' },
    windowBounds: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number', minimum: 300 },
        height: { type: 'number', minimum: 400 },
      },
      required: ['width', 'height'],
    },
  },
}) as unknown as StoreInterface<ISettings>;

const settingsStore = createSettingsStore(store);
const mainWindowService = createMainWindowService();

// Initialize polling manager
const pollingManager = createPollingManager(
  () => portScanner.getPortList(),
  settingsStore.getSettings().pollingInterval
);

// Listen for settings changes to update polling interval
settingsStore.onSettingsChange((settings) => {
  pollingManager.setInterval(settings.pollingInterval);
});

// Listen for port list updates and send to renderer
pollingManager.onUpdate((ports) => {
  const win = mainWindowService.getWindow();
  if (win) {
    sendPortListUpdate(win, ports);
  }
});

// Register IPC handlers
registerIPCHandlers({
  portScanner,
  processManager,
  settingsStore,
  getMainWindow: () => mainWindowService.getWindow(),
});

app.whenReady().then(() => {
  const settings = settingsStore.getSettings();

  // Callback to save window bounds
  const onBoundsChange = (bounds: import('../shared/types.js').IWindowBounds) => {
    settingsStore.updateSettings({ windowBounds: bounds });
  };

  mainWindowService.create(settings, onBoundsChange);

  // Start polling
  pollingManager.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const currentSettings = settingsStore.getSettings();
      mainWindowService.create(currentSettings, onBoundsChange);
    }
  });
});

app.on('window-all-closed', () => {
  pollingManager.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
