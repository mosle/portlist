import type { ISettings } from './types.js';

/**
 * Application name
 */
export const APP_NAME = 'portlist';

/**
 * Window configuration
 */
export const WINDOW_CONFIG = {
  DEFAULT_WIDTH: 400,
  DEFAULT_HEIGHT: 500,
  MIN_WIDTH: 300,
  MIN_HEIGHT: 400,
} as const;

/**
 * Default application settings
 */
export const DEFAULT_SETTINGS: ISettings = {
  pollingInterval: 5000,
  alwaysOnTop: false,
  sortColumn: 'port',
  sortDirection: 'asc',
  filterText: '',
  windowBounds: {
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
  },
};

/**
 * IPC channel names for communication between main and renderer processes
 */
export const IPC_CHANNELS = {
  GET_PORT_LIST: 'get-port-list',
  KILL_PROCESS: 'kill-process',
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  TOGGLE_ALWAYS_ON_TOP: 'toggle-always-on-top',
  PORT_LIST_UPDATED: 'port-list-updated',
} as const;

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  LSOF_COMMAND: 5000,
  KILL_SIGTERM: 3000,
} as const;
