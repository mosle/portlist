import { readlink } from 'node:fs/promises';
import type { IPortInfo, Result, ScanError } from '../../shared/types.js';
import { TIMEOUTS } from '../../shared/constants.js';
import type { ExecFunction } from './port-scanner.js';

/**
 * Linux port scanner using ss command
 */
export async function scanPortsLinux(
  execFn: ExecFunction
): Promise<Result<IPortInfo[], ScanError>> {
  try {
    // Step 1: Get listening ports with ss
    // -t: TCP, -l: listening, -n: numeric, -p: show process
    const { stdout: ssOutput } = await execFn(
      'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null',
      { timeout: TIMEOUTS.LSOF_COMMAND }
    );

    const ports = parseSsOutput(ssOutput);

    if (ports.length === 0) {
      return { success: true, data: [] };
    }

    // Step 2: Get CWD for each PID via /proc
    const uniquePids = [...new Set(ports.map(p => p.pid))];
    const cwdMap = new Map<number, string>();

    for (const pid of uniquePids) {
      try {
        const cwd = await readlink(`/proc/${pid}/cwd`);
        cwdMap.set(pid, cwd);
      } catch {
        // CWD fetch failure is non-fatal
      }
    }

    // Step 3: Get full command with arguments and parent PID
    let processInfoMap = new Map<number, { command: string; ppid: number }>();
    try {
      const pidList = uniquePids.join(',');
      const { stdout: psOutput } = await execFn(
        `ps -p ${pidList} -o pid=,ppid=,args= 2>/dev/null`,
        { timeout: TIMEOUTS.LSOF_COMMAND }
      );
      processInfoMap = parseProcessInfo(psOutput);
    } catch {
      // Process info fetch failure is non-fatal
    }

    // Step 4: Get parent process commands
    const parentPids = [...new Set(
      [...processInfoMap.values()].map(info => info.ppid).filter(ppid => ppid > 0)
    )];
    const parentCommandMap = new Map<number, string>();

    if (parentPids.length > 0) {
      try {
        const parentPidList = parentPids.join(',');
        const { stdout: parentPsOutput } = await execFn(
          `ps -p ${parentPidList} -o pid=,args= 2>/dev/null`,
          { timeout: TIMEOUTS.LSOF_COMMAND }
        );
        for (const line of parentPsOutput.trim().split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const firstSpace = trimmed.indexOf(' ');
          if (firstSpace === -1) continue;
          const pid = parseInt(trimmed.substring(0, firstSpace), 10);
          const cmd = trimmed.substring(firstSpace + 1).trim();
          if (!isNaN(pid) && cmd) {
            parentCommandMap.set(pid, cmd);
          }
        }
      } catch {
        // Parent command fetch failure is non-fatal
      }
    }

    // Step 5: Merge data
    const result: IPortInfo[] = ports.map(port => {
      const processInfo = processInfoMap.get(port.pid);
      const parentPid = processInfo?.ppid || 0;
      return {
        ...port,
        command: processInfo?.command || port.command,
        directory: cwdMap.get(port.pid) || 'Unknown',
        parentPid,
        parentCommand: parentCommandMap.get(parentPid) || '',
      };
    });

    return { success: true, data: result };
  } catch (error) {
    const err = error as Error & { killed?: boolean };

    if (err.killed) {
      return {
        success: false,
        error: { type: 'TIMEOUT', message: 'ss command timed out' },
      };
    }

    return {
      success: false,
      error: { type: 'COMMAND_FAILED', message: err.message },
    };
  }
}

/**
 * Parse ss output on Linux
 * Format: LISTEN  0  128  0.0.0.0:3000  0.0.0.0:*  users:(("node",pid=1234,fd=19))
 */
function parseSsOutput(output: string): IPortInfo[] {
  const ports: IPortInfo[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('State') || trimmed.startsWith('Proto')) continue;

    // Try ss format first
    const ssMatch = trimmed.match(/LISTEN\s+\d+\s+\d+\s+[\d.*:]+:(\d+)\s+.*users:\(\("([^"]+)",pid=(\d+)/);
    if (ssMatch) {
      const port = parseInt(ssMatch[1], 10);
      const command = ssMatch[2];
      const pid = parseInt(ssMatch[3], 10);

      if (!isNaN(port) && !isNaN(pid)) {
        ports.push({
          pid,
          port,
          command,
          directory: 'Unknown',
          protocol: 'TCP',
          parentPid: 0,
          parentCommand: '',
        });
        continue;
      }
    }

    // Try netstat format: tcp  0  0  0.0.0.0:3000  0.0.0.0:*  LISTEN  1234/node
    const netstatMatch = trimmed.match(/^tcp\s+\d+\s+\d+\s+[\d.*:]+:(\d+)\s+[\d.*:]+:\*\s+LISTEN\s+(\d+)\/(.+)/);
    if (netstatMatch) {
      const port = parseInt(netstatMatch[1], 10);
      const pid = parseInt(netstatMatch[2], 10);
      const command = netstatMatch[3];

      if (!isNaN(port) && !isNaN(pid)) {
        ports.push({
          pid,
          port,
          command,
          directory: 'Unknown',
          protocol: 'TCP',
          parentPid: 0,
          parentCommand: '',
        });
      }
    }
  }

  return ports;
}

/**
 * Parse ps output for process info
 */
function parseProcessInfo(output: string): Map<number, { command: string; ppid: number }> {
  const processMap = new Map<number, { command: string; ppid: number }>();
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

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
