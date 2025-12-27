import type { IPortInfo } from '../../shared/types.js';

/**
 * Raw port info before merging with CWD
 */
export interface RawPortInfo {
  pid: number;
  port: number;
  command: string;
  protocol: 'TCP' | 'UDP';
}

/**
 * Parse lsof -iTCP -sTCP:LISTEN output
 *
 * Example output format:
 * COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
 * node      12345   user   23u  IPv4 0x1234567890123456      0t0  TCP *:3000 (LISTEN)
 */
export function parseLsofOutput(output: string): RawPortInfo[] {
  const lines = output.trim().split('\n');
  if (lines.length <= 1) {
    return [];
  }

  const results: RawPortInfo[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('(LISTEN)')) {
      continue;
    }

    try {
      const parsed = parseLsofLine(line);
      if (parsed) {
        results.push(parsed);
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return results;
}

/**
 * Parse a single lsof output line
 */
function parseLsofLine(line: string): RawPortInfo | null {
  // Find the TCP ... (LISTEN) part at the end
  const listenMatch = line.match(/TCP\s+([^\s]+):(\d+)\s+\(LISTEN\)/);
  if (!listenMatch) {
    return null;
  }

  const port = parseInt(listenMatch[2], 10);
  if (isNaN(port)) {
    return null;
  }

  // Parse the beginning of the line for COMMAND and PID
  // The format is: COMMAND<spaces>PID<spaces>...
  // But COMMAND can contain spaces when using +c 0
  // We need to find PID which is followed by USER

  // Split by whitespace and find the pattern
  const parts = line.trim().split(/\s+/);

  // Find the index where we have a numeric PID
  // The PID is typically the first numeric value after command
  let pidIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i])) {
      pidIndex = i;
      break;
    }
  }

  if (pidIndex === -1) {
    return null;
  }

  const pid = parseInt(parts[pidIndex], 10);
  const command = parts.slice(0, pidIndex).join(' ');

  return {
    pid,
    port,
    command,
    protocol: 'TCP',
  };
}

/**
 * Parse lsof -d cwd output to get working directories
 *
 * Example output format:
 * COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF     NODE NAME
 * node    12345   user  cwd    DIR    1,5      512 12345678 /Users/test/project
 */
export function parseCwdOutput(output: string): Map<number, string> {
  const lines = output.trim().split('\n');
  const cwdMap = new Map<number, string>();

  if (lines.length <= 1) {
    return cwdMap;
  }

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('cwd')) {
      continue;
    }

    try {
      const parsed = parseCwdLine(line);
      if (parsed) {
        cwdMap.set(parsed.pid, parsed.cwd);
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return cwdMap;
}

/**
 * Parse a single cwd output line
 */
function parseCwdLine(line: string): { pid: number; cwd: string } | null {
  // Split by whitespace
  const parts = line.trim().split(/\s+/);

  // Find PID (first numeric value)
  let pidIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i])) {
      pidIndex = i;
      break;
    }
  }

  if (pidIndex === -1) {
    return null;
  }

  const pid = parseInt(parts[pidIndex], 10);

  // Find 'cwd' and then DIR, the path is after the NODE number
  const cwdIndex = parts.indexOf('cwd');
  if (cwdIndex === -1) {
    return null;
  }

  // Find DIR index
  const dirIndex = parts.indexOf('DIR', cwdIndex);
  if (dirIndex === -1) {
    return null;
  }

  // The path starts after the NODE number (which is numeric)
  // Format: ... DIR    1,5      512 12345678 /path/to/dir
  // Find the last numeric part before the path
  let pathStartIndex = -1;
  for (let i = dirIndex + 1; i < parts.length; i++) {
    // NODE is numeric, path starts after it
    if (parts[i].startsWith('/')) {
      pathStartIndex = i;
      break;
    }
  }

  if (pathStartIndex === -1) {
    return null;
  }

  // Join remaining parts as path (handles paths with spaces)
  const cwd = parts.slice(pathStartIndex).join(' ');

  return { pid, cwd };
}

/**
 * Parse ps output to get full command with arguments and PPID
 *
 * Example output format:
 * 12345  1234 /usr/bin/node /path/to/app/server.js --port 3000
 */
export function parseProcessInfo(output: string): Map<number, { command: string; ppid: number }> {
  const processMap = new Map<number, { command: string; ppid: number }>();
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Format: PID PPID COMMAND
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    const pid = parseInt(parts[0], 10);
    const ppid = parseInt(parts[1], 10);
    const command = parts.slice(2).join(' ');

    if (!isNaN(pid) && !isNaN(ppid) && command) {
      processMap.set(pid, { command, ppid });
    }
  }

  return processMap;
}

/**
 * Merge raw port info with CWD, command, and parent process information
 * Also deduplicates by PID+port (same process listening on both IPv4 and IPv6)
 */
export function mergeCwdWithPorts(
  rawPorts: RawPortInfo[],
  cwdMap: Map<number, string>,
  processInfoMap: Map<number, { command: string; ppid: number }> = new Map(),
  parentCommandMap: Map<number, string> = new Map()
): IPortInfo[] {
  const seen = new Set<string>();
  const results: IPortInfo[] = [];

  for (const raw of rawPorts) {
    const key = `${raw.pid}:${raw.port}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const processInfo = processInfoMap.get(raw.pid);
    const ppid = processInfo?.ppid ?? 0;
    const parentCmd = parentCommandMap.get(ppid) ?? '';
    // Get just executable name from parent command
    const parentExec = parentCmd.split('/').pop()?.split(' ')[0] ?? 'Unknown';

    results.push({
      pid: raw.pid,
      port: raw.port,
      command: processInfo?.command ?? raw.command,
      directory: cwdMap.get(raw.pid) ?? 'Unknown',
      protocol: raw.protocol,
      parentPid: ppid,
      parentCommand: parentExec,
    });
  }

  return results;
}
