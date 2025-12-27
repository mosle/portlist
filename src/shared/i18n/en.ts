export const en = {
  app: {
    title: 'Port List Viewer',
  },
  port_list: {
    header_port: 'Port',
    header_directory: 'Directory',
    header_command: 'Command',
    header_pid: 'PID',
    header_parent: 'Parent',
    empty: 'No listening ports found',
    unknown_directory: 'Unknown',
  },
  actions: {
    reload: 'Reload',
    kill: 'Kill',
    settings: 'Settings',
    pin: 'Pin',
    unpin: 'Unpin',
    filter_placeholder: 'Filter...',
  },
  settings: {
    title: 'Settings',
    polling_interval: 'Polling Interval',
    seconds: 'seconds',
  },
  error: {
    fetch_failed: 'Failed to fetch port list',
    kill_failed: 'Failed to kill process',
    permission_denied: 'Permission denied to kill process {pid}',
  },
};

export type TranslationKeys = typeof en;
