import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import type { IPortInfo, Result, ScanError } from '../../shared/types.js';
import { TIMEOUTS } from '../../shared/constants.js';
import {
  parseLsofOutput,
  parseCwdOutput,
  parseProcessInfo,
  mergeCwdWithPorts,
} from '../utils/lsof-parser.js';
import { scanPortsWindows } from './scanner-windows.js';
import { scanPortsLinux } from './scanner-linux.js';

export type ExecFunction = (
  command: string,
  options: { timeout: number }
) => Promise<{ stdout: string; stderr: string }>;

export interface PortScannerService {
  getPortList(): Promise<Result<IPortInfo[], ScanError>>;
}

/**
 * Create a PortScanner service
 * @param execFn - Execution function (for dependency injection in tests)
 */
export function createPortScanner(
  execFn: ExecFunction = promisify(exec) as ExecFunction
): PortScannerService {
  return {
    async getPortList(): Promise<Result<IPortInfo[], ScanError>> {
      const currentPlatform = platform();

      // Dispatch to platform-specific implementation
      if (currentPlatform === 'win32') {
        return scanPortsWindows(execFn);
      }

      if (currentPlatform === 'linux') {
        return scanPortsLinux(execFn);
      }

      // macOS (darwin) - use lsof
      return scanPortsDarwin(execFn);
    },
  };
}

/**
 * macOS port scanner using lsof
 */
async function scanPortsDarwin(
  execFn: ExecFunction
): Promise<Result<IPortInfo[], ScanError>> {
  try {
    // Step 1: Get listening ports
    const { stdout: portOutput } = await execFn(
      'lsof -iTCP -sTCP:LISTEN -n -P +c 0',
      { timeout: TIMEOUTS.LSOF_COMMAND }
    );

    const rawPorts = parseLsofOutput(portOutput);

    if (rawPorts.length === 0) {
      return { success: true, data: [] };
    }

    // Step 2: Get CWD for all PIDs in a single batch call
    const uniquePids = [...new Set(rawPorts.map((p) => p.pid))];
    let cwdMap = new Map<number, string>();

    try {
      const pidList = uniquePids.join(',');
      const { stdout: cwdOutput } = await execFn(
        `lsof -d cwd -a -p ${pidList}`,
        { timeout: TIMEOUTS.LSOF_COMMAND }
      );
      cwdMap = parseCwdOutput(cwdOutput);
    } catch {
      // CWD fetch failure is non-fatal, continue with "Unknown" directories
    }

    // Step 3: Get full command with arguments and parent PID
    let processInfoMap = new Map<number, { command: string; ppid: number }>();
    try {
      const pidList = uniquePids.join(',');
      const { stdout: psOutput } = await execFn(
        `ps -p ${pidList} -o pid=,ppid=,command=`,
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
    let parentCommandMap = new Map<number, string>();
    if (parentPids.length > 0) {
      try {
        const parentPidList = parentPids.join(',');
        const { stdout: parentPsOutput } = await execFn(
          `ps -p ${parentPidList} -o pid=,command=`,
          { timeout: TIMEOUTS.LSOF_COMMAND }
        );
        // Parse just pid and command for parents
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
    const ports = mergeCwdWithPorts(rawPorts, cwdMap, processInfoMap, parentCommandMap);

    return { success: true, data: ports };
  } catch (error) {
    const err = error as Error & { killed?: boolean };

    if (err.killed) {
      return {
        success: false,
        error: { type: 'TIMEOUT', message: 'lsof command timed out' },
      };
    }

    return {
      success: false,
      error: { type: 'COMMAND_FAILED', message: err.message },
    };
  }
}

/**
 * Default port scanner instance
 */
export const portScanner = createPortScanner();
