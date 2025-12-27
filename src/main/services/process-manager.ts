import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import type { Result, KillError } from '../../shared/types.js';
import { TIMEOUTS } from '../../shared/constants.js';

const execAsync = promisify(exec);

export type KillFunction = (pid: number, signal: string | number) => boolean;

export interface ProcessManagerService {
  killProcess(pid: number): Promise<Result<void, KillError>>;
}

/**
 * Default kill function using process.kill
 */
function defaultKill(pid: number, signal: string | number): boolean {
  process.kill(pid, signal);
  return true;
}

/**
 * Wait for a process to exit (Unix)
 */
async function waitForProcessExit(
  pid: number,
  killFn: KillFunction,
  timeoutMs: number
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Signal 0 checks if process exists
      killFn(pid, 0);
      // Process still exists, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ESRCH') {
        // Process no longer exists
        return true;
      }
      throw error;
    }
  }

  return false;
}

/**
 * Kill process on Windows using taskkill
 */
async function killProcessWindows(pid: number): Promise<Result<void, KillError>> {
  try {
    // taskkill /F forces termination, /PID specifies the process ID
    await execAsync(`taskkill /F /PID ${pid}`, { timeout: 5000 });
    return { success: true, data: undefined };
  } catch (error) {
    const err = error as Error & { code?: number; stderr?: string };
    const stderr = err.stderr || err.message || '';

    // Check for common Windows error messages
    if (stderr.includes('not found') || stderr.includes('見つかりません')) {
      return {
        success: false,
        error: { type: 'NOT_FOUND', pid },
      };
    }

    if (stderr.includes('Access is denied') || stderr.includes('アクセスが拒否されました')) {
      return {
        success: false,
        error: { type: 'PERMISSION_DENIED', pid },
      };
    }

    return {
      success: false,
      error: { type: 'UNKNOWN', message: stderr },
    };
  }
}

/**
 * Kill process on Unix (macOS/Linux)
 */
async function killProcessUnix(
  pid: number,
  killFn: KillFunction,
  sigtermTimeout: number
): Promise<Result<void, KillError>> {
  try {
    // Try SIGTERM first
    killFn(pid, 'SIGTERM');

    // Wait for process to exit
    const exited = await waitForProcessExit(pid, killFn, sigtermTimeout);

    if (!exited) {
      // Process didn't exit, try SIGKILL
      try {
        killFn(pid, 'SIGKILL');
        await waitForProcessExit(pid, killFn, 1000);
      } catch {
        // SIGKILL errors are acceptable, process might already be gone
      }
    }

    return { success: true, data: undefined };
  } catch (error) {
    const err = error as Error & { code?: string };

    if (err.code === 'ESRCH') {
      return {
        success: false,
        error: { type: 'NOT_FOUND', pid },
      };
    }

    if (err.code === 'EPERM') {
      return {
        success: false,
        error: { type: 'PERMISSION_DENIED', pid },
      };
    }

    return {
      success: false,
      error: { type: 'UNKNOWN', message: err.message },
    };
  }
}

/**
 * Create a ProcessManager service
 * @param killFn - Kill function (for dependency injection in tests)
 * @param sigtermTimeout - Timeout for SIGTERM before using SIGKILL
 */
export function createProcessManager(
  killFn: KillFunction = defaultKill,
  sigtermTimeout: number = TIMEOUTS.KILL_SIGTERM
): ProcessManagerService {
  return {
    async killProcess(pid: number): Promise<Result<void, KillError>> {
      if (platform() === 'win32') {
        return killProcessWindows(pid);
      }
      return killProcessUnix(pid, killFn, sigtermTimeout);
    },
  };
}

/**
 * Default process manager instance
 */
export const processManager = createProcessManager();
