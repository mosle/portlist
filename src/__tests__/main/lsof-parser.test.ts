import { describe, it, expect } from 'vitest';
import {
  parseLsofOutput,
  parseCwdOutput,
  mergeCwdWithPorts,
  type RawPortInfo,
} from '../../main/utils/lsof-parser.js';

describe('lsof-parser', () => {
  describe('parseLsofOutput', () => {
    it('should parse standard lsof -iTCP output', () => {
      const output = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)
node      12345   user   24u  IPv6 0x1234567890123457      0t0  TCP *:3000 (LISTEN)
python    23456   user   5u   IPv4 0x1234567890123458      0t0  TCP *:8080 (LISTEN)`;

      const result = parseLsofOutput(output);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        pid: 12345,
        port: 3000,
        command: 'node',
        protocol: 'TCP',
      });
      expect(result[1]).toEqual({
        pid: 12345,
        port: 3000,
        command: 'node',
        protocol: 'TCP',
      });
      expect(result[2]).toEqual({
        pid: 23456,
        port: 8080,
        command: 'python',
        protocol: 'TCP',
      });
    });

    it('should handle lsof output with +c 0 (full command names)', () => {
      const output = `COMMAND                      PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node /Users/test/app/server   12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)`;

      const result = parseLsofOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].command).toBe('node /Users/test/app/server');
      expect(result[0].pid).toBe(12345);
      expect(result[0].port).toBe(3000);
    });

    it('should handle localhost binding', () => {
      const output = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP 127.0.0.1:3000 (LISTEN)`;

      const result = parseLsofOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].port).toBe(3000);
    });

    it('should handle IPv6 localhost binding', () => {
      const output = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv6 0x1234567890123456      0t0  TCP [::1]:3000 (LISTEN)`;

      const result = parseLsofOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].port).toBe(3000);
    });

    it('should return empty array for empty output', () => {
      const result = parseLsofOutput('');
      expect(result).toEqual([]);
    });

    it('should return empty array for header-only output', () => {
      const output = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME`;
      const result = parseLsofOutput(output);
      expect(result).toEqual([]);
    });

    it('should skip non-LISTEN lines', () => {
      const output = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP 192.168.1.1:3000->10.0.0.1:4000 (ESTABLISHED)
node      12345   user   24u  IPv4 0x1234567890123457      0t0  TCP *:3000 (LISTEN)`;

      const result = parseLsofOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].port).toBe(3000);
    });

    it('should handle malformed lines gracefully', () => {
      const output = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
this is not a valid line
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)
another bad line`;

      const result = parseLsofOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].pid).toBe(12345);
    });

    it('should handle high port numbers', () => {
      const output = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:65535 (LISTEN)`;

      const result = parseLsofOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].port).toBe(65535);
    });
  });

  describe('parseCwdOutput', () => {
    it('should parse lsof -d cwd output', () => {
      const output = `COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF     NODE NAME
node    12345   user  cwd    DIR    1,5      512 12345678 /Users/test/project
python  23456   user  cwd    DIR    1,5      512 23456789 /Users/test/another`;

      const result = parseCwdOutput(output);

      expect(result.get(12345)).toBe('/Users/test/project');
      expect(result.get(23456)).toBe('/Users/test/another');
    });

    it('should handle paths with spaces', () => {
      const output = `COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF     NODE NAME
node    12345   user  cwd    DIR    1,5      512 12345678 /Users/test/My Project/app`;

      const result = parseCwdOutput(output);

      expect(result.get(12345)).toBe('/Users/test/My Project/app');
    });

    it('should return empty map for empty output', () => {
      const result = parseCwdOutput('');
      expect(result.size).toBe(0);
    });

    it('should handle header-only output', () => {
      const output = `COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF     NODE NAME`;
      const result = parseCwdOutput(output);
      expect(result.size).toBe(0);
    });
  });

  describe('mergeCwdWithPorts', () => {
    it('should merge CWD information with port info', () => {
      const rawPorts: RawPortInfo[] = [
        { pid: 12345, port: 3000, command: 'node', protocol: 'TCP' },
        { pid: 23456, port: 8080, command: 'python', protocol: 'TCP' },
      ];

      const cwdMap = new Map<number, string>([
        [12345, '/Users/test/project'],
        [23456, '/Users/test/another'],
      ]);

      const result = mergeCwdWithPorts(rawPorts, cwdMap);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        pid: 12345,
        port: 3000,
        command: 'node',
        directory: '/Users/test/project',
        protocol: 'TCP',
        parentPid: 0,
        parentCommand: '',
      });
      expect(result[1]).toEqual({
        pid: 23456,
        port: 8080,
        command: 'python',
        directory: '/Users/test/another',
        protocol: 'TCP',
        parentPid: 0,
        parentCommand: '',
      });
    });

    it('should use "Unknown" for missing CWD', () => {
      const rawPorts: RawPortInfo[] = [
        { pid: 12345, port: 3000, command: 'node', protocol: 'TCP' },
      ];

      const cwdMap = new Map<number, string>();

      const result = mergeCwdWithPorts(rawPorts, cwdMap);

      expect(result[0].directory).toBe('Unknown');
    });

    it('should deduplicate by PID and port', () => {
      const rawPorts: RawPortInfo[] = [
        { pid: 12345, port: 3000, command: 'node', protocol: 'TCP' },
        { pid: 12345, port: 3000, command: 'node', protocol: 'TCP' }, // IPv6 duplicate
      ];

      const cwdMap = new Map<number, string>([
        [12345, '/Users/test/project'],
      ]);

      const result = mergeCwdWithPorts(rawPorts, cwdMap);

      expect(result).toHaveLength(1);
    });
  });
});
