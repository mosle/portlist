import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSettingsStore, type StoreInterface } from '../../main/services/settings-store.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import type { ISettings } from '../../shared/types.js';

describe('SettingsStore', () => {
  let mockStore: StoreInterface<ISettings>;

  beforeEach(() => {
    mockStore = {
      get: vi.fn(),
      set: vi.fn(),
      store: { ...DEFAULT_SETTINGS },
      onDidChange: vi.fn(),
    };
  });

  describe('getSettings', () => {
    it('should return all settings', () => {
      (mockStore.get as ReturnType<typeof vi.fn>).mockImplementation((key: keyof ISettings) => {
        return DEFAULT_SETTINGS[key];
      });

      const store = createSettingsStore(mockStore);
      const settings = store.getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return stored values when available', () => {
      const customSettings: ISettings = {
        pollingInterval: 10000,
        alwaysOnTop: true,
        sortColumn: 'command',
        sortDirection: 'desc',
      };

      mockStore.store = customSettings;
      (mockStore.get as ReturnType<typeof vi.fn>).mockImplementation((key: keyof ISettings) => {
        return customSettings[key];
      });

      const store = createSettingsStore(mockStore);
      const settings = store.getSettings();

      expect(settings.pollingInterval).toBe(10000);
      expect(settings.alwaysOnTop).toBe(true);
      expect(settings.sortColumn).toBe('command');
      expect(settings.sortDirection).toBe('desc');
    });
  });

  describe('updateSettings', () => {
    it('should update a single setting', () => {
      const store = createSettingsStore(mockStore);
      store.updateSettings({ pollingInterval: 10000 });

      expect(mockStore.set).toHaveBeenCalledWith('pollingInterval', 10000);
    });

    it('should update multiple settings', () => {
      const store = createSettingsStore(mockStore);
      store.updateSettings({
        pollingInterval: 10000,
        alwaysOnTop: true,
      });

      expect(mockStore.set).toHaveBeenCalledWith('pollingInterval', 10000);
      expect(mockStore.set).toHaveBeenCalledWith('alwaysOnTop', true);
    });

    it('should not update undefined values', () => {
      const store = createSettingsStore(mockStore);
      store.updateSettings({ pollingInterval: 10000 });

      expect(mockStore.set).toHaveBeenCalledTimes(1);
      expect(mockStore.set).toHaveBeenCalledWith('pollingInterval', 10000);
    });
  });

  describe('onSettingsChange', () => {
    it('should register change listener', () => {
      const store = createSettingsStore(mockStore);
      const callback = vi.fn();

      store.onSettingsChange(callback);

      expect(mockStore.onDidChange).toHaveBeenCalled();
    });

    it('should call callback when settings change', () => {
      const listeners: Array<(newValue: ISettings) => void> = [];
      mockStore.onDidChange = vi.fn().mockImplementation((_key, callback) => {
        listeners.push(callback);
      });

      const store = createSettingsStore(mockStore);
      const callback = vi.fn();
      store.onSettingsChange(callback);

      // Simulate store change
      mockStore.store = { ...DEFAULT_SETTINGS, pollingInterval: 10000 };
      (mockStore.get as ReturnType<typeof vi.fn>).mockImplementation((key: keyof ISettings) => {
        return mockStore.store[key];
      });

      // Trigger the first listener (polling interval change)
      if (listeners[0]) {
        listeners[0](mockStore.store);
      }

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('default values', () => {
    it('should use DEFAULT_SETTINGS for missing values', () => {
      mockStore.store = {} as ISettings;
      (mockStore.get as ReturnType<typeof vi.fn>).mockImplementation((key: keyof ISettings, defaultValue: unknown) => {
        return defaultValue;
      });

      const store = createSettingsStore(mockStore);
      const settings = store.getSettings();

      expect(settings.pollingInterval).toBe(DEFAULT_SETTINGS.pollingInterval);
      expect(settings.alwaysOnTop).toBe(DEFAULT_SETTINGS.alwaysOnTop);
    });
  });
});
