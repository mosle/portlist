import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPortScanner, type ExecFunction } from '../../main/services/port-scanner.js';

// Mock os.platform to always return 'darwin' for consistent testing
vi.mock('node:os', () => ({
  platform: () => 'darwin',
}));

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

      const psOutput = `12345 1 node /Users/test/project/server.js
23456 1 python /Users/test/another/app.py`;

      mockExec = vi.fn()
        .mockResolvedValueOnce({ stdout: lsofPortOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: lsofCwdOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: psOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // parent commands (empty for ppid=1)

      const scanner = createPortScanner(mockExec);
      const result = await scanner.getPortList();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toEqual({
          pid: 12345,
          port: 3000,
          command: 'node /Users/test/project/server.js',
          directory: '/Users/test/project',
          protocol: 'TCP',
          parentPid: 1,
          parentCommand: '',
        });
        expect(result.data[1]).toEqual({
          pid: 23456,
          port: 8080,
          command: 'python /Users/test/another/app.py',
          directory: '/Users/test/another',
          protocol: 'TCP',
          parentPid: 1,
          parentCommand: '',
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
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // CWD
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // ps process info
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // ps parent commands

      const scanner = createPortScanner(mockExec);
      await scanner.getPortList();

      // Should call: 1) lsof ports, 2) lsof cwd, 3) ps process info
      // Parent command call (4th) may or may not happen depending on ppids
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('lsof -d cwd -a -p'),
        expect.any(Object)
      );
    });

    it('should handle CWD fetch failure gracefully', async () => {
      const lsofPortOutput = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)`;

      mockExec = vi.fn()
        .mockResolvedValueOnce({ stdout: lsofPortOutput, stderr: '' })
        .mockRejectedValueOnce(new Error('CWD fetch failed'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // ps process info
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // ps parent commands

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
