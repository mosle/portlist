import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPollingManager } from '../../main/services/polling-manager.js';
import type { IPortInfo, Result, ScanError } from '../../shared/types.js';

describe('PollingManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should call onUpdate callback immediately on start', async () => {
      const mockPorts: IPortInfo[] = [
        { pid: 12345, port: 3000, command: 'node', directory: '/test', protocol: 'TCP' },
      ];
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: mockPorts });
      const onUpdate = vi.fn();

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.onUpdate(onUpdate);
      manager.start();

      // Wait for the initial fetch to complete
      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(1);
      });

      await vi.waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(mockPorts);
      });
    });

    it('should poll at the specified interval', async () => {
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: [] });

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.start();

      // Wait for initial call
      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(1);
      });

      // Advance timer and wait for second call
      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(2);
      });

      // Advance timer and wait for third call
      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(3);
      });

      manager.stop();
    });

    it('should not start if already running', async () => {
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: [] });

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.start();
      manager.start(); // Second call should be ignored

      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(1);
      });

      // After one interval, should only have 2 calls (not 3 or more)
      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(2);
      });

      manager.stop();
    });
  });

  describe('stop', () => {
    it('should stop polling', async () => {
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: [] });

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.start();

      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(1);
      });

      manager.stop();

      // Advance time significantly - no more calls should happen
      vi.advanceTimersByTime(20000);

      // Should still be 1 call
      expect(mockGetPortList).toHaveBeenCalledTimes(1);
    });

    it('should allow restart after stop', async () => {
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: [] });

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.start();

      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(1);
      });

      manager.stop();
      manager.start();

      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(2);
      });

      manager.stop();
    });
  });

  describe('setInterval', () => {
    it('should change the polling interval', async () => {
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: [] });

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.start();

      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(1);
      });

      // Change interval to 2000ms
      manager.setInterval(2000);

      // Advance by 2000ms - should trigger with new interval
      vi.advanceTimersByTime(2000);
      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(2);
      });

      manager.stop();
    });
  });

  describe('onUpdate', () => {
    it('should support multiple listeners', async () => {
      const mockPorts: IPortInfo[] = [
        { pid: 12345, port: 3000, command: 'node', directory: '/test', protocol: 'TCP' },
      ];
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: mockPorts });
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.onUpdate(listener1);
      manager.onUpdate(listener2);
      manager.start();

      await vi.waitFor(() => {
        expect(listener1).toHaveBeenCalledWith(mockPorts);
        expect(listener2).toHaveBeenCalledWith(mockPorts);
      });

      manager.stop();
    });

    it('should return unsubscribe function', async () => {
      const mockPorts: IPortInfo[] = [];
      const mockGetPortList = vi.fn().mockResolvedValue({ success: true, data: mockPorts });
      const listener = vi.fn();

      const manager = createPollingManager(mockGetPortList, 5000);
      const unsubscribe = manager.onUpdate(listener);
      manager.start();

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      // Unsubscribe
      unsubscribe();

      vi.advanceTimersByTime(5000);
      // Allow any pending promises to resolve
      await Promise.resolve();

      // Listener should not be called again
      expect(listener).toHaveBeenCalledTimes(1);

      manager.stop();
    });
  });

  describe('error handling', () => {
    it('should not call onUpdate when getPortList fails', async () => {
      const error: Result<IPortInfo[], ScanError> = {
        success: false,
        error: { type: 'COMMAND_FAILED', message: 'lsof not found' },
      };
      const mockGetPortList = vi.fn().mockResolvedValue(error);
      const onUpdate = vi.fn();

      const manager = createPollingManager(mockGetPortList, 5000);
      manager.onUpdate(onUpdate);
      manager.start();

      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalled();
      });

      // onUpdate should not be called for failed results
      expect(onUpdate).not.toHaveBeenCalled();

      manager.stop();
    });

    it('should continue polling after errors', async () => {
      const error: Result<IPortInfo[], ScanError> = {
        success: false,
        error: { type: 'COMMAND_FAILED', message: 'error' },
      };
      const success: Result<IPortInfo[], ScanError> = {
        success: true,
        data: [],
      };

      const mockGetPortList = vi.fn()
        .mockResolvedValueOnce(error)
        .mockResolvedValueOnce(success);

      const onUpdate = vi.fn();
      const manager = createPollingManager(mockGetPortList, 5000);
      manager.onUpdate(onUpdate);
      manager.start();

      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(1);
      });
      expect(onUpdate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(mockGetPortList).toHaveBeenCalledTimes(2);
      });
      expect(onUpdate).toHaveBeenCalledWith([]);

      manager.stop();
    });
  });
});
