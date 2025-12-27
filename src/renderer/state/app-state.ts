import type { IPortInfo, SortColumn } from '../../shared/types.js';

/**
 * Application state for the renderer process
 */
export interface AppState {
  ports: IPortInfo[];
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  isLoading: boolean;
  error: string | null;
  isSettingsOpen: boolean;
  isPinned: boolean;
  filterText: string;
}

/**
 * Create initial application state
 */
export function createAppState(): AppState {
  return {
    ports: [],
    sortColumn: 'port',
    sortDirection: 'asc',
    isLoading: false,
    error: null,
    isSettingsOpen: false,
    isPinned: false,
    filterText: '',
  };
}

/**
 * Filter ports by search text
 */
export function filterPorts(ports: IPortInfo[], filterText: string): IPortInfo[] {
  if (!filterText.trim()) return ports;

  const search = filterText.toLowerCase();
  return ports.filter(port =>
    port.port.toString().includes(search) ||
    port.command.toLowerCase().includes(search) ||
    port.directory.toLowerCase().includes(search) ||
    port.pid.toString().includes(search) ||
    port.parentCommand.toLowerCase().includes(search)
  );
}

/**
 * Group ports by directory
 * Uses Map to preserve insertion order
 */
export function groupByDirectory(ports: IPortInfo[]): Map<string, IPortInfo[]> {
  const groups = new Map<string, IPortInfo[]>();

  for (const port of ports) {
    const existing = groups.get(port.directory);
    if (existing) {
      existing.push(port);
    } else {
      groups.set(port.directory, [port]);
    }
  }

  return groups;
}

/**
 * Group ports by parent process
 */
export function groupByParent(ports: IPortInfo[]): Map<string, IPortInfo[]> {
  const groups = new Map<string, IPortInfo[]>();

  for (const port of ports) {
    const key = port.parentCommand || 'Unknown';
    const existing = groups.get(key);
    if (existing) {
      existing.push(port);
    } else {
      groups.set(key, [port]);
    }
  }

  return groups;
}

/**
 * Sort ports by column
 */
export function sortPorts(
  ports: IPortInfo[],
  column: SortColumn,
  direction: 'asc' | 'desc'
): IPortInfo[] {
  const sorted = [...ports];
  const multiplier = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    let comparison: number;

    switch (column) {
      case 'port':
        comparison = a.port - b.port;
        break;
      case 'pid':
        comparison = a.pid - b.pid;
        break;
      case 'directory':
        comparison = a.directory.localeCompare(b.directory);
        break;
      case 'command':
        comparison = a.command.localeCompare(b.command);
        break;
      case 'parent':
        comparison = a.parentCommand.localeCompare(b.parentCommand);
        break;
      default:
        comparison = 0;
    }

    return comparison * multiplier;
  });

  return sorted;
}

/**
 * Get sorted and grouped ports
 */
export function getSortedGroupedPorts(
  ports: IPortInfo[],
  sortColumn: SortColumn,
  sortDirection: 'asc' | 'desc'
): Map<string, IPortInfo[]> {
  const sorted = sortPorts(ports, sortColumn, sortDirection);
  return groupByDirectory(sorted);
}
