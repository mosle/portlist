import type { IPortInfo, Result, ScanError } from '../../shared/types.js';
import { TIMEOUTS } from '../../shared/constants.js';
import type { ExecFunction } from './port-scanner.js';

/**
 * Windows port scanner using netstat and wmic
 */
export async function scanPortsWindows(
  execFn: ExecFunction
): Promise<Result<IPortInfo[], ScanError>> {
  try {
    // Step 1: Get listening ports with netstat
    const { stdout: netstatOutput } = await execFn(
      'netstat -ano | findstr LISTENING',
      { timeout: TIMEOUTS.LSOF_COMMAND }
    );

    const ports = parseNetstatOutput(netstatOutput);

    if (ports.length === 0) {
      return { success: true, data: [] };
    }

    // Step 2: Get process info for each PID
    const uniquePids = [...new Set(ports.map(p => p.pid))];
    const processInfoMap = new Map<number, { command: string; ppid: number }>();

    try {
      const pidList = uniquePids.join(',');
      const { stdout: wmicOutput } = await execFn(
        `wmic process where "ProcessId=${pidList.split(',').join(' or ProcessId=')}" get ProcessId,ParentProcessId,CommandLine /format:csv`,
        { timeout: TIMEOUTS.LSOF_COMMAND }
      );
      parseWmicOutput(wmicOutput, processInfoMap);
    } catch {
      // Try tasklist as fallback
      try {
        const { stdout: tasklistOutput } = await execFn(
          'tasklist /fo csv /v',
          { timeout: TIMEOUTS.LSOF_COMMAND }
        );
        parseTasklistOutput(tasklistOutput, uniquePids, processInfoMap);
      } catch {
        // Process info fetch failure is non-fatal
      }
    }

    // Step 3: Get parent process commands
    const parentPids = [...new Set(
      [...processInfoMap.values()].map(info => info.ppid).filter(ppid => ppid > 0)
    )];
    const parentCommandMap = new Map<number, string>();

    if (parentPids.length > 0) {
      try {
        const pidList = parentPids.join(',');
        const { stdout: wmicOutput } = await execFn(
          `wmic process where "ProcessId=${pidList.split(',').join(' or ProcessId=')}" get ProcessId,CommandLine /format:csv`,
          { timeout: TIMEOUTS.LSOF_COMMAND }
        );
        parseWmicParentOutput(wmicOutput, parentCommandMap);
      } catch {
        // Parent command fetch failure is non-fatal
      }
    }

    // Step 4: Merge data
    const result: IPortInfo[] = ports.map(port => {
      const processInfo = processInfoMap.get(port.pid);
      const parentPid = processInfo?.ppid || 0;
      return {
        ...port,
        command: processInfo?.command || port.command,
        directory: 'Unknown', // Windows doesn't easily provide CWD
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
        error: { type: 'TIMEOUT', message: 'netstat command timed out' },
      };
    }

    return {
      success: false,
      error: { type: 'COMMAND_FAILED', message: err.message },
    };
  }
}

/**
 * Parse netstat output on Windows
 * Format: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234
 */
function parseNetstatOutput(output: string): IPortInfo[] {
  const ports: IPortInfo[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split by whitespace
    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) continue;

    const protocol = parts[0].toUpperCase();
    if (protocol !== 'TCP' && protocol !== 'UDP') continue;

    const localAddress = parts[1];
    const state = parts[3];
    const pid = parseInt(parts[4], 10);

    if (state !== 'LISTENING' || isNaN(pid)) continue;

    // Extract port from address (e.g., "0.0.0.0:3000" or "[::]:3000")
    const portMatch = localAddress.match(/:(\d+)$/);
    if (!portMatch) continue;

    const port = parseInt(portMatch[1], 10);

    ports.push({
      pid,
      port,
      command: `PID:${pid}`,
      directory: 'Unknown',
      protocol: protocol as 'TCP' | 'UDP',
      parentPid: 0,
      parentCommand: '',
    });
  }

  return ports;
}

/**
 * Parse wmic process output
 */
function parseWmicOutput(
  output: string,
  processInfoMap: Map<number, { command: string; ppid: number }>
): void {
  const lines = output.trim().split('\n');

  for (const line of lines) {
    if (!line.includes(',')) continue;

    // CSV format: Node,CommandLine,ParentProcessId,ProcessId
    const parts = line.split(',');
    if (parts.length < 4) continue;

    const commandLine = parts[1]?.replace(/"/g, '') || '';
    const ppid = parseInt(parts[2], 10);
    const pid = parseInt(parts[3], 10);

    if (!isNaN(pid) && commandLine) {
      processInfoMap.set(pid, {
        command: commandLine,
        ppid: isNaN(ppid) ? 0 : ppid,
      });
    }
  }
}

/**
 * Parse tasklist output as fallback
 */
function parseTasklistOutput(
  output: string,
  pids: number[],
  processInfoMap: Map<number, { command: string; ppid: number }>
): void {
  const lines = output.trim().split('\n');
  const pidSet = new Set(pids);

  for (const line of lines) {
    if (!line.includes(',')) continue;

    // CSV format: "Image Name","PID","Session Name","Session#","Mem Usage",...
    const parts = line.split(',').map(p => p.replace(/"/g, ''));
    if (parts.length < 2) continue;

    const imageName = parts[0];
    const pid = parseInt(parts[1], 10);

    if (!isNaN(pid) && pidSet.has(pid)) {
      processInfoMap.set(pid, {
        command: imageName,
        ppid: 0, // tasklist doesn't provide parent PID
      });
    }
  }
}

/**
 * Parse wmic output for parent commands
 */
function parseWmicParentOutput(
  output: string,
  parentCommandMap: Map<number, string>
): void {
  const lines = output.trim().split('\n');

  for (const line of lines) {
    if (!line.includes(',')) continue;

    // CSV format: Node,CommandLine,ProcessId
    const parts = line.split(',');
    if (parts.length < 3) continue;

    const commandLine = parts[1]?.replace(/"/g, '') || '';
    const pid = parseInt(parts[2], 10);

    if (!isNaN(pid) && commandLine) {
      parentCommandMap.set(pid, commandLine);
    }
  }
}
