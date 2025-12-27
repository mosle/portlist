import type { ISettings } from '../../shared/types.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';

/**
 * Interface for electron-store-like storage
 */
export interface StoreInterface<T> {
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  store: T;
  onDidChange<K extends keyof T>(
    key: K,
    callback: (newValue: T[K] | undefined, oldValue: T[K] | undefined) => void
  ): () => void;
}

export interface SettingsStoreService {
  getSettings(): ISettings;
  updateSettings(partial: Partial<ISettings>): void;
  onSettingsChange(callback: (settings: ISettings) => void): () => void;
}

/**
 * Create a SettingsStore service
 * @param store - Storage backend (electron-store instance)
 */
export function createSettingsStore(
  store: StoreInterface<ISettings>
): SettingsStoreService {
  const changeCallbacks: Array<(settings: ISettings) => void> = [];

  // Notify all callbacks when settings change
  const notifyChange = (): void => {
    const settings = getSettings();
    for (const callback of changeCallbacks) {
      callback(settings);
    }
  };

  // Helper to get all settings
  function getSettings(): ISettings {
    return {
      pollingInterval: store.get('pollingInterval', DEFAULT_SETTINGS.pollingInterval),
      alwaysOnTop: store.get('alwaysOnTop', DEFAULT_SETTINGS.alwaysOnTop),
      sortColumn: store.get('sortColumn', DEFAULT_SETTINGS.sortColumn),
      sortDirection: store.get('sortDirection', DEFAULT_SETTINGS.sortDirection),
    };
  }

  // Register listeners for all settings keys
  const keys: Array<keyof ISettings> = ['pollingInterval', 'alwaysOnTop', 'sortColumn', 'sortDirection'];
  for (const key of keys) {
    store.onDidChange(key, () => {
      notifyChange();
    });
  }

  return {
    getSettings,

    updateSettings(partial: Partial<ISettings>): void {
      const entries = Object.entries(partial) as Array<[keyof ISettings, ISettings[keyof ISettings]]>;
      for (const [key, value] of entries) {
        if (value !== undefined) {
          store.set(key, value as never);
        }
      }
    },

    onSettingsChange(callback: (settings: ISettings) => void): () => void {
      changeCallbacks.push(callback);
      return () => {
        const index = changeCallbacks.indexOf(callback);
        if (index > -1) {
          changeCallbacks.splice(index, 1);
        }
      };
    },
  };
}
