/**
 * Port information retrieved from lsof command
 */
export interface IPortInfo {
  pid: number;
  port: number;
  command: string;
  directory: string;
  protocol: 'TCP' | 'UDP';
  parentPid: number;
  parentCommand: string;
}

/**
 * Sort column options for port list
 */
export type SortColumn = 'port' | 'directory' | 'command' | 'pid' | 'parent';

/**
 * Application settings
 */
export interface ISettings {
  pollingInterval: number;
  alwaysOnTop: boolean;
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Errors that can occur during port scanning
 */
export type ScanError =
  | { type: 'COMMAND_FAILED'; message: string }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'TIMEOUT'; message: string };

/**
 * Errors that can occur when killing a process
 */
export type KillError =
  | { type: 'NOT_FOUND'; pid: number }
  | { type: 'PERMISSION_DENIED'; pid: number }
  | { type: 'UNKNOWN'; message: string };

/**
 * Grouped port info by directory
 */
export interface IGroupedPortInfo {
  directory: string;
  ports: IPortInfo[];
}
