import type { IPortInfo, SortColumn } from '../../shared/types.js';
import { i18n } from '../../shared/i18n/index.js';
import { groupByDirectory, groupByParent, sortPorts } from '../state/app-state.js';

export interface PortListProps {
  ports: IPortInfo[];
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  isLoading: boolean;
  error: string | null;
  onKillProcess: (pid: number) => void;
  onSort: (column: SortColumn) => void;
}

// Cache for preventing unnecessary re-renders
let lastRenderKey = '';

/**
 * Generate a cache key from props to detect changes
 */
function generateRenderKey(props: PortListProps): string {
  const { ports, sortColumn, sortDirection, isLoading, error } = props;
  // Create a key based on content that affects rendering
  const portsKey = ports.map(p => `${p.pid}:${p.port}:${p.command}`).join('|');
  return `${portsKey}::${sortColumn}::${sortDirection}::${isLoading}::${error || ''}`;
}

/**
 * Render port list with grouped view
 */
export function renderPortList(container: HTMLElement, props: PortListProps): void {
  const { ports, sortColumn, sortDirection, isLoading, error, onKillProcess, onSort } = props;

  // Skip re-render if nothing changed (prevents hover flickering during polling)
  const currentKey = generateRenderKey(props);
  if (currentKey === lastRenderKey && container.children.length > 0) {
    return;
  }
  lastRenderKey = currentKey;

  container.innerHTML = '';

  // Error state
  if (error) {
    container.innerHTML = `<div class="error-message">${error}</div>`;
    return;
  }

  // Loading state
  if (isLoading) {
    container.innerHTML = `<div class="loading">${i18n.t('actions.reload')}...</div>`;
    return;
  }

  // Empty state
  if (ports.length === 0) {
    container.innerHTML = `<div class="empty-message">${i18n.t('port_list.empty')}</div>`;
    return;
  }

  // Header
  const header = createHeader(sortColumn, sortDirection, onSort);
  container.appendChild(header);

  const sorted = sortPorts(ports, sortColumn, sortDirection);

  // When sorting by port or pid, show flat list without grouping
  if (sortColumn === 'port' || sortColumn === 'pid') {
    const list = createFlatList(sorted, onKillProcess);
    container.appendChild(list);
  } else if (sortColumn === 'parent') {
    // Group by parent process
    const grouped = groupByParent(sorted);
    for (const [parentCommand, groupPorts] of grouped) {
      const group = createGroup(parentCommand, groupPorts, onKillProcess, true);
      container.appendChild(group);
    }
  } else {
    // Group by directory for directory and command sorts
    const grouped = groupByDirectory(sorted);
    for (const [directory, groupPorts] of grouped) {
      const group = createGroup(directory, groupPorts, onKillProcess, false);
      container.appendChild(group);
    }
  }
}

/**
 * Create sortable header
 */
function createHeader(
  sortColumn: SortColumn,
  sortDirection: 'asc' | 'desc',
  onSort: (column: SortColumn) => void
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'port-list-header';

  const columns: { key: SortColumn; label: string; cellClass: string }[] = [
    { key: 'port', label: i18n.t('port_list.header_port'), cellClass: 'header-port' },
    { key: 'command', label: i18n.t('port_list.header_command'), cellClass: 'header-command' },
    { key: 'parent', label: i18n.t('port_list.header_parent'), cellClass: 'header-parent' },
    { key: 'pid', label: i18n.t('port_list.header_pid'), cellClass: 'header-pid' },
  ];

  for (const col of columns) {
    const cell = document.createElement('div');
    cell.className = `header-cell ${col.cellClass} ${sortColumn === col.key ? 'sorted' : ''}`;
    cell.textContent = col.label;

    if (sortColumn === col.key) {
      cell.textContent += sortDirection === 'asc' ? ' ↑' : ' ↓';
    }

    cell.addEventListener('click', () => onSort(col.key));
    header.appendChild(cell);
  }

  // Kill button placeholder column
  const actionCell = document.createElement('div');
  actionCell.className = 'header-cell action-cell';
  header.appendChild(actionCell);

  return header;
}

/**
 * Create flat list without grouping
 */
function createFlatList(
  ports: IPortInfo[],
  onKillProcess: (pid: number) => void
): HTMLElement {
  const list = document.createElement('div');
  list.className = 'port-flat-list';

  for (const port of ports) {
    const row = createPortRow(port, onKillProcess);
    list.appendChild(row);
  }

  return list;
}

/**
 * Create directory or parent group
 */
function createGroup(
  label: string,
  ports: IPortInfo[],
  onKillProcess: (pid: number) => void,
  isParent: boolean = false
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'port-group';

  // Group header
  const groupHeader = document.createElement('div');
  groupHeader.className = `group-header ${isParent ? 'group-parent' : ''}`;

  const displayLabel = isParent ? formatCommand(label) : shortenPath(label);
  groupHeader.innerHTML = `
    <span class="group-directory">${displayLabel}</span>
    <span class="group-count">${ports.length}</span>
  `;
  groupHeader.title = label;
  group.appendChild(groupHeader);

  // Port rows
  for (const port of ports) {
    const row = createPortRow(port, onKillProcess);
    group.appendChild(row);
  }

  return group;
}

/**
 * Create port row
 */
function createPortRow(
  port: IPortInfo,
  onKillProcess: (pid: number) => void
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'port-row';

  // Port cell
  const portCell = document.createElement('div');
  portCell.className = 'port-cell port-number';
  portCell.textContent = String(port.port);
  row.appendChild(portCell);

  // Command cell with tooltip
  const commandCell = document.createElement('div');
  commandCell.className = 'port-cell port-command has-tooltip';

  // Wrap text in span for ellipsis while keeping cell overflow:visible for tooltip
  const commandSpan = document.createElement('span');
  commandSpan.textContent = formatCommand(port.command);
  commandCell.appendChild(commandSpan);

  // Add tooltip for full command (with line breaks for readability)
  const tooltipText = formatTooltip(port.command);
  commandCell.setAttribute('data-tooltip', tooltipText);

  row.appendChild(commandCell);

  // Parent cell
  const parentCell = document.createElement('div');
  parentCell.className = 'port-cell port-parent';
  const parentName = port.parentCommand ? formatCommand(port.parentCommand) : '-';
  parentCell.textContent = parentName.split(' ')[0]; // Just the executable name
  parentCell.title = port.parentCommand || '';
  row.appendChild(parentCell);

  // PID cell
  const pidCell = document.createElement('div');
  pidCell.className = 'port-cell port-pid';
  pidCell.textContent = String(port.pid);
  row.appendChild(pidCell);

  // Kill button
  const killBtn = document.createElement('button');
  killBtn.className = 'kill-button';
  killBtn.textContent = '×';
  killBtn.title = i18n.t('actions.kill');
  killBtn.addEventListener('click', () => onKillProcess(port.pid));
  row.appendChild(killBtn);

  return row;
}

/**
 * Shorten path for display
 */
function shortenPath(path: string): string {
  if (path === 'Unknown') return path;

  // Get last 2 directories
  const parts = path.split('/');
  if (parts.length <= 3) return path;

  return '.../' + parts.slice(-2).join('/');
}

/**
 * Format command for display - show executable name + full arguments
 */
function formatCommand(command: string): string {
  // Find first space to separate executable from arguments
  const firstSpace = command.indexOf(' ');

  if (firstSpace === -1) {
    // No arguments, just return executable name
    return command.split('/').pop() || command;
  }

  // Get executable name (without path) and keep all arguments
  const execPath = command.substring(0, firstSpace);
  const args = command.substring(firstSpace);
  const execName = execPath.split('/').pop() || execPath;

  return execName + args;
}

/**
 * Format tooltip text with line breaks for readability
 */
function formatTooltip(command: string): string {
  // Split at common argument prefixes for better readability
  // Insert newlines before --, -, and long paths
  const parts: string[] = [];

  // Split command into tokens
  const tokens = command.split(/\s+/);
  let currentLine = '';

  for (const token of tokens) {
    // Start new line for argument flags
    if (token.startsWith('--') || (token.startsWith('-') && currentLine.length > 0)) {
      if (currentLine) {
        parts.push(currentLine.trim());
      }
      currentLine = token + ' ';
    } else if (currentLine.length + token.length > 60) {
      // Line too long, break it
      if (currentLine) {
        parts.push(currentLine.trim());
      }
      currentLine = token + ' ';
    } else {
      currentLine += token + ' ';
    }
  }

  if (currentLine.trim()) {
    parts.push(currentLine.trim());
  }

  return parts.join('\n');
}
