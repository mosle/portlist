import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPortScanner, type ExecFunction } from '../../main/services/port-scanner.js';

describe('PortScanner', () => {
  let mockExec: ExecFunction;

  beforeEach(() => {
    mockExec = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPortList', () => {
    it('should return port list on successful execution', async () => {
      const lsofPortOutput = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)
python    23456   user   5u   IPv4 0x1234567890123458      0t0  TCP *:8080 (LISTEN)`;

      const lsofCwdOutput = `COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF     NODE NAME
node    12345   user  cwd    DIR    1,5      512 12345678 /Users/test/project
python  23456   user  cwd    DIR    1,5      512 23456789 /Users/test/another`;

      mockExec = vi.fn()
        .mockResolvedValueOnce({ stdout: lsofPortOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: lsofCwdOutput, stderr: '' });

      const scanner = createPortScanner(mockExec);
      const result = await scanner.getPortList();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toEqual({
          pid: 12345,
          port: 3000,
          command: 'node',
          directory: '/Users/test/project',
          protocol: 'TCP',
        });
        expect(result.data[1]).toEqual({
          pid: 23456,
          port: 8080,
          command: 'python',
          directory: '/Users/test/another',
          protocol: 'TCP',
        });
      }
    });

    it('should return empty array when no ports are listening', async () => {
      const lsofOutput = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME`;

      mockExec = vi.fn().mockResolvedValue({ stdout: lsofOutput, stderr: '' });

      const scanner = createPortScanner(mockExec);
      const result = await scanner.getPortList();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return COMMAND_FAILED error on lsof failure', async () => {
      mockExec = vi.fn().mockRejectedValue(new Error('lsof not found'));

      const scanner = createPortScanner(mockExec);
      const result = await scanner.getPortList();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('COMMAND_FAILED');
        expect(result.error.message).toContain('lsof not found');
      }
    });

    it('should return TIMEOUT error when command times out', async () => {
      const timeoutError = new Error('timeout');
      (timeoutError as Error & { killed?: boolean }).killed = true;

      mockExec = vi.fn().mockRejectedValue(timeoutError);

      const scanner = createPortScanner(mockExec);
      const result = await scanner.getPortList();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TIMEOUT');
      }
    });

    it('should call lsof with correct arguments', async () => {
      mockExec = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });

      const scanner = createPortScanner(mockExec);
      await scanner.getPortList();

      expect(mockExec).toHaveBeenCalledWith(
        'lsof -iTCP -sTCP:LISTEN -n -P +c 0',
        expect.any(Object)
      );
    });

    it('should call lsof for CWD with correct PID list', async () => {
      const lsofPortOutput = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)
python    23456   user   5u   IPv4 0x1234567890123458      0t0  TCP *:8080 (LISTEN)`;

      mockExec = vi.fn()
        .mockResolvedValueOnce({ stdout: lsofPortOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const scanner = createPortScanner(mockExec);
      await scanner.getPortList();

      expect(mockExec).toHaveBeenCalledTimes(2);
      expect(mockExec).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('lsof -d cwd -a -p'),
        expect.any(Object)
      );
    });

    it('should handle CWD fetch failure gracefully', async () => {
      const lsofPortOutput = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)`;

      mockExec = vi.fn()
        .mockResolvedValueOnce({ stdout: lsofPortOutput, stderr: '' })
        .mockRejectedValueOnce(new Error('CWD fetch failed'));

      const scanner = createPortScanner(mockExec);
      const result = await scanner.getPortList();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].directory).toBe('Unknown');
      }
    });
  });
});
