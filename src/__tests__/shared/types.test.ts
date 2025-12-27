import { describe, it, expect } from 'vitest';
import type {
  IPortInfo,
  ISettings,
  SortColumn,
  Result,
  ScanError,
  KillError,
} from '../../shared/types.js';
import { DEFAULT_SETTINGS, IPC_CHANNELS } from '../../shared/constants.js';

describe('Shared Types', () => {
  describe('IPortInfo', () => {
    it('should have required properties', () => {
      const portInfo: IPortInfo = {
        pid: 1234,
        port: 3000,
        command: 'node',
        directory: '/Users/test/project',
        protocol: 'TCP',
      };

      expect(portInfo.pid).toBe(1234);
      expect(portInfo.port).toBe(3000);
      expect(portInfo.command).toBe('node');
      expect(portInfo.directory).toBe('/Users/test/project');
      expect(portInfo.protocol).toBe('TCP');
    });
  });

  describe('ISettings', () => {
    it('should have required properties', () => {
      const settings: ISettings = {
        pollingInterval: 5000,
        alwaysOnTop: false,
        sortColumn: 'port',
        sortDirection: 'asc',
      };

      expect(settings.pollingInterval).toBe(5000);
      expect(settings.alwaysOnTop).toBe(false);
      expect(settings.sortColumn).toBe('port');
      expect(settings.sortDirection).toBe('asc');
    });
  });

  describe('Result type', () => {
    it('should represent success', () => {
      const result: Result<number, string> = { success: true, data: 42 };
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should represent failure', () => {
      const result: Result<number, string> = { success: false, error: 'Something went wrong' };
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Something went wrong');
      }
    });
  });

  describe('ScanError', () => {
    it('should have COMMAND_FAILED type', () => {
      const error: ScanError = { type: 'COMMAND_FAILED', message: 'lsof not found' };
      expect(error.type).toBe('COMMAND_FAILED');
    });

    it('should have PARSE_ERROR type', () => {
      const error: ScanError = { type: 'PARSE_ERROR', message: 'Invalid format' };
      expect(error.type).toBe('PARSE_ERROR');
    });

    it('should have TIMEOUT type', () => {
      const error: ScanError = { type: 'TIMEOUT', message: 'Command timed out' };
      expect(error.type).toBe('TIMEOUT');
    });
  });

  describe('KillError', () => {
    it('should have NOT_FOUND type', () => {
      const error: KillError = { type: 'NOT_FOUND', pid: 1234 };
      expect(error.type).toBe('NOT_FOUND');
      expect(error.pid).toBe(1234);
    });

    it('should have PERMISSION_DENIED type', () => {
      const error: KillError = { type: 'PERMISSION_DENIED', pid: 5678 };
      expect(error.type).toBe('PERMISSION_DENIED');
    });

    it('should have UNKNOWN type', () => {
      const error: KillError = { type: 'UNKNOWN', message: 'Unknown error' };
      expect(error.type).toBe('UNKNOWN');
    });
  });
});

describe('Constants', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have default polling interval of 5000ms', () => {
      expect(DEFAULT_SETTINGS.pollingInterval).toBe(5000);
    });

    it('should have alwaysOnTop disabled by default', () => {
      expect(DEFAULT_SETTINGS.alwaysOnTop).toBe(false);
    });

    it('should have default sort by port ascending', () => {
      expect(DEFAULT_SETTINGS.sortColumn).toBe('port');
      expect(DEFAULT_SETTINGS.sortDirection).toBe('asc');
    });
  });

  describe('IPC_CHANNELS', () => {
    it('should have get-port-list channel', () => {
      expect(IPC_CHANNELS.GET_PORT_LIST).toBe('get-port-list');
    });

    it('should have kill-process channel', () => {
      expect(IPC_CHANNELS.KILL_PROCESS).toBe('kill-process');
    });

    it('should have settings channels', () => {
      expect(IPC_CHANNELS.GET_SETTINGS).toBe('get-settings');
      expect(IPC_CHANNELS.UPDATE_SETTINGS).toBe('update-settings');
    });

    it('should have toggle-always-on-top channel', () => {
      expect(IPC_CHANNELS.TOGGLE_ALWAYS_ON_TOP).toBe('toggle-always-on-top');
    });

    it('should have port-list-updated channel', () => {
      expect(IPC_CHANNELS.PORT_LIST_UPDATED).toBe('port-list-updated');
    });
  });
});
