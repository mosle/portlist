import type { IPortInfo, ISettings, SortColumn } from '../shared/types.js';
import { createAppState, filterPorts, type AppState } from './state/app-state.js';
import { renderPortList } from './components/port-list.js';
import { renderToolbar } from './components/toolbar.js';
import { renderSettingsView, removeSettingsView } from './components/settings-view.js';

// Application state
let state: AppState = createAppState();
let settings: ISettings | null = null;

// DOM elements
let portListContainer: HTMLElement;
let toolbarContainer: HTMLElement;
let appContainer: HTMLElement;

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Apply platform class to body for CSS styling
  document.body.classList.add(`platform-${window.electronAPI.platform}`);

  appContainer = document.getElementById('app')!;

  // Create layout
  appContainer.innerHTML = `
    <div class="toolbar" id="toolbar"></div>
    <div class="port-list-container" id="port-list"></div>
  `;

  toolbarContainer = document.getElementById('toolbar')!;
  portListContainer = document.getElementById('port-list')!;

  // Load initial settings
  settings = await window.electronAPI.getSettings();
  state = {
    ...state,
    sortColumn: settings.sortColumn,
    sortDirection: settings.sortDirection,
    isPinned: settings.alwaysOnTop,
    filterText: settings.filterText,
  };

  // Register for port updates
  window.electronAPI.onPortListUpdated(handlePortListUpdate);

  // Initial fetch
  await fetchPorts();

  // Initial render
  render();
}

/**
 * Fetch port list from main process
 */
async function fetchPorts(): Promise<void> {
  state = { ...state, isLoading: true, error: null };
  render();

  try {
    const ports = await window.electronAPI.getPortList();
    state = { ...state, ports, isLoading: false };
  } catch (err) {
    state = {
      ...state,
      isLoading: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  render();
}

/**
 * Handle port list updates from polling
 */
function handlePortListUpdate(ports: IPortInfo[]): void {
  state = { ...state, ports };
  render();
}

/**
 * Handle kill process - with confirmation
 */
async function handleKillProcess(pid: number): Promise<void> {
  const port = state.ports.find(p => p.pid === pid);
  const processName = port ? port.command.split('/').pop()?.split(' ')[0] || 'process' : 'process';

  // Confirm before killing
  const confirmed = window.confirm(`${processName} (PID: ${pid}) を終了しますか?`);
  if (!confirmed) return;

  // Optimistically remove from UI immediately
  state = {
    ...state,
    ports: state.ports.filter(p => p.pid !== pid),
  };
  render();

  // Kill in background, only show error if it fails
  try {
    await window.electronAPI.killProcess(pid);
  } catch (err) {
    // Ignore NOT_FOUND errors (process already gone)
    const message = err instanceof Error ? err.message : '';
    if (!message.includes('NOT_FOUND')) {
      state = {
        ...state,
        error: message || 'Failed to kill process',
      };
      render();

      setTimeout(() => {
        state = { ...state, error: null };
        render();
      }, 3000);
    }
  }
}

/**
 * Handle sort change
 */
async function handleSort(column: SortColumn): Promise<void> {
  let newDirection: 'asc' | 'desc' = 'asc';

  if (state.sortColumn === column) {
    newDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  state = {
    ...state,
    sortColumn: column,
    sortDirection: newDirection,
  };

  // Save to settings
  await window.electronAPI.updateSettings({
    sortColumn: column,
    sortDirection: newDirection,
  });

  render();
}

/**
 * Handle reload
 */
async function handleReload(): Promise<void> {
  await fetchPorts();
}

/**
 * Handle toggle pin
 */
async function handleTogglePin(): Promise<void> {
  const isPinned = await window.electronAPI.toggleAlwaysOnTop();
  state = { ...state, isPinned };
  render();
}

/**
 * Handle open settings
 */
function handleOpenSettings(): void {
  state = { ...state, isSettingsOpen: true };
  render();
}

/**
 * Handle close settings
 */
function handleCloseSettings(): void {
  state = { ...state, isSettingsOpen: false };
  render();
}

/**
 * Handle update settings
 */
async function handleUpdateSettings(newSettings: Partial<ISettings>): Promise<void> {
  await window.electronAPI.updateSettings(newSettings);
  settings = await window.electronAPI.getSettings();
}

/**
 * Handle filter change
 */
function handleFilterChange(text: string): void {
  state = { ...state, filterText: text };
  render();

  // Save filter text (debounced via the settings update mechanism)
  window.electronAPI.updateSettings({ filterText: text });
}

/**
 * Render the application
 */
function render(): void {
  renderToolbar(toolbarContainer, {
    isPinned: state.isPinned,
    isLoading: state.isLoading,
    filterText: state.filterText,
    onReload: handleReload,
    onTogglePin: handleTogglePin,
    onOpenSettings: handleOpenSettings,
    onFilterChange: handleFilterChange,
  });

  const filteredPorts = filterPorts(state.ports, state.filterText);

  renderPortList(portListContainer, {
    ports: filteredPorts,
    sortColumn: state.sortColumn,
    sortDirection: state.sortDirection,
    isLoading: state.isLoading,
    error: state.error,
    onKillProcess: handleKillProcess,
    onSort: handleSort,
  });

  // Settings modal
  if (state.isSettingsOpen && settings) {
    renderSettingsView(appContainer, {
      settings,
      onClose: handleCloseSettings,
      onUpdateSettings: handleUpdateSettings,
    });
  } else {
    removeSettingsView(appContainer);
  }
}

// Start the application
init();
