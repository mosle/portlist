import type { TranslationKeys } from './en.js';

export const ja: TranslationKeys = {
  app: {
    title: 'Port List Viewer',
  },
  port_list: {
    header_port: 'ポート',
    header_directory: 'ディレクトリ',
    header_command: 'コマンド',
    header_pid: 'PID',
    header_parent: '親',
    empty: 'リッスン中のポートがありません',
    unknown_directory: '不明',
  },
  actions: {
    reload: '更新',
    kill: '終了',
    settings: '設定',
    pin: 'ピン留め',
    unpin: 'ピン解除',
    filter_placeholder: 'フィルタ...',
  },
  settings: {
    title: '設定',
    polling_interval: 'ポーリング間隔',
    seconds: '秒',
  },
  error: {
    fetch_failed: 'ポートリストの取得に失敗しました',
    kill_failed: 'プロセスの終了に失敗しました',
    permission_denied: 'プロセス {pid} を終了する権限がありません',
  },
};
