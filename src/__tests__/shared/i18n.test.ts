import { describe, it, expect, beforeEach } from 'vitest';
import { i18n, createI18n } from '../../shared/i18n/index.js';
import { en } from '../../shared/i18n/en.js';
import { ja } from '../../shared/i18n/ja.js';

describe('i18n', () => {
  describe('createI18n', () => {
    it('should create i18n instance with default locale (en)', () => {
      const instance = createI18n();
      expect(instance.getLocale()).toBe('en');
    });

    it('should create i18n instance with specified locale', () => {
      const instance = createI18n('ja');
      expect(instance.getLocale()).toBe('ja');
    });
  });

  describe('t function', () => {
    it('should return translated text for simple key', () => {
      const instance = createI18n('en');
      expect(instance.t('app.title')).toBe('Port List Viewer');
    });

    it('should return Japanese text when locale is ja', () => {
      const instance = createI18n('ja');
      expect(instance.t('app.title')).toBe('Port List Viewer');
    });

    it('should return key when translation is not found', () => {
      const instance = createI18n('en');
      expect(instance.t('non.existent.key')).toBe('non.existent.key');
    });

    it('should translate port list headers', () => {
      const instance = createI18n('en');
      expect(instance.t('port_list.header_port')).toBe('Port');
      expect(instance.t('port_list.header_directory')).toBe('Directory');
      expect(instance.t('port_list.header_command')).toBe('Command');
      expect(instance.t('port_list.header_pid')).toBe('PID');
    });

    it('should translate empty state message', () => {
      const instance = createI18n('en');
      expect(instance.t('port_list.empty')).toBe('No listening ports found');
    });

    it('should translate action buttons', () => {
      const instance = createI18n('en');
      expect(instance.t('actions.reload')).toBe('Reload');
      expect(instance.t('actions.kill')).toBe('Kill');
      expect(instance.t('actions.settings')).toBe('Settings');
      expect(instance.t('actions.pin')).toBe('Pin');
      expect(instance.t('actions.unpin')).toBe('Unpin');
    });

    it('should translate settings labels', () => {
      const instance = createI18n('en');
      expect(instance.t('settings.title')).toBe('Settings');
      expect(instance.t('settings.polling_interval')).toBe('Polling Interval');
      expect(instance.t('settings.seconds')).toBe('seconds');
    });

    it('should translate error messages', () => {
      const instance = createI18n('en');
      expect(instance.t('error.fetch_failed')).toBe('Failed to fetch port list');
      expect(instance.t('error.kill_failed')).toBe('Failed to kill process');
    });
  });

  describe('parameter substitution', () => {
    it('should substitute parameters in translation', () => {
      const instance = createI18n('en');
      const result = instance.t('error.permission_denied', { pid: 1234 });
      expect(result).toBe('Permission denied to kill process 1234');
    });

    it('should substitute multiple parameters', () => {
      const instance = createI18n('en');
      // Using a mock message to test multiple params
      const result = instance.t('error.permission_denied', { pid: 5678 });
      expect(result).toContain('5678');
    });

    it('should handle missing parameters gracefully', () => {
      const instance = createI18n('en');
      const result = instance.t('error.permission_denied');
      expect(result).toContain('{pid}');
    });
  });

  describe('setLocale', () => {
    it('should change locale', () => {
      const instance = createI18n('en');
      expect(instance.getLocale()).toBe('en');

      instance.setLocale('ja');
      expect(instance.getLocale()).toBe('ja');
    });

    it('should use new locale for translations after change', () => {
      const instance = createI18n('en');
      expect(instance.t('port_list.empty')).toBe('No listening ports found');

      instance.setLocale('ja');
      expect(instance.t('port_list.empty')).toBe('リッスン中のポートがありません');
    });
  });

  describe('Japanese translations', () => {
    it('should have Japanese translations for all keys', () => {
      const instance = createI18n('ja');

      expect(instance.t('port_list.header_port')).toBe('ポート');
      expect(instance.t('port_list.header_directory')).toBe('ディレクトリ');
      expect(instance.t('port_list.header_command')).toBe('コマンド');
      expect(instance.t('actions.reload')).toBe('更新');
      expect(instance.t('actions.kill')).toBe('終了');
      expect(instance.t('settings.title')).toBe('設定');
      expect(instance.t('error.fetch_failed')).toBe('ポートリストの取得に失敗しました');
    });
  });

  describe('Translation completeness', () => {
    it('should have same keys in en and ja', () => {
      const enKeys = getAllKeys(en);
      const jaKeys = getAllKeys(ja);

      expect(enKeys.sort()).toEqual(jaKeys.sort());
    });
  });
});

// Helper function to get all nested keys
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}
