import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProcessManager, type KillFunction } from '../../main/services/process-manager.js';

describe('ProcessManager', () => {
  let mockKill: KillFunction;

  beforeEach(() => {
    mockKill = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('killProcess', () => {
    it('should return success when SIGTERM succeeds', async () => {
      mockKill = vi.fn().mockReturnValue(true);

      const manager = createProcessManager(mockKill);
      const result = await manager.killProcess(12345);

      expect(result.success).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
    });

    it('should return NOT_FOUND error when process does not exist', async () => {
      const error = new Error('ESRCH');
      (error as Error & { code?: string }).code = 'ESRCH';
      mockKill = vi.fn().mockImplementation(() => {
        throw error;
      });

      const manager = createProcessManager(mockKill);
      const result = await manager.killProcess(12345);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('NOT_FOUND');
        expect(result.error.pid).toBe(12345);
      }
    });

    it('should return PERMISSION_DENIED error when no permission', async () => {
      const error = new Error('EPERM');
      (error as Error & { code?: string }).code = 'EPERM';
      mockKill = vi.fn().mockImplementation(() => {
        throw error;
      });

      const manager = createProcessManager(mockKill);
      const result = await manager.killProcess(12345);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('PERMISSION_DENIED');
        expect(result.error.pid).toBe(12345);
      }
    });

    it('should return UNKNOWN error for other errors', async () => {
      const error = new Error('Unknown error');
      mockKill = vi.fn().mockImplementation(() => {
        throw error;
      });

      const manager = createProcessManager(mockKill);
      const result = await manager.killProcess(12345);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('UNKNOWN');
        expect(result.error.message).toContain('Unknown error');
      }
    });

    it('should try SIGKILL after SIGTERM timeout', async () => {
      // First call (SIGTERM) succeeds but process doesn't die
      // We'll simulate this by making kill return true but process still exists
      let callCount = 0;
      mockKill = vi.fn().mockImplementation((_pid: number, signal: string) => {
        callCount++;
        if (signal === 'SIGTERM' && callCount === 1) {
          return true;
        }
        if (signal === 'SIGKILL') {
          return true;
        }
        // Checking if process exists (signal 0)
        if (signal === 0 || signal === '0') {
          if (callCount <= 2) {
            return true; // Process still exists
          }
          const error = new Error('ESRCH');
          (error as Error & { code?: string }).code = 'ESRCH';
          throw error; // Process gone
        }
        return true;
      });

      const manager = createProcessManager(mockKill, 100); // Short timeout for test
      const result = await manager.killProcess(12345);

      expect(result.success).toBe(true);
    });
  });
});
