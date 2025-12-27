import { en, type TranslationKeys } from './en.js';
import { ja } from './ja.js';

export type Locale = 'en' | 'ja';

const translations: Record<Locale, TranslationKeys> = {
  en,
  ja,
};

export interface I18n {
  t(key: string, params?: Record<string, string | number>): string;
  setLocale(locale: Locale): void;
  getLocale(): Locale;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Replace parameters in translation string
 * Format: {paramName}
 */
function replaceParams(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;

  let result = text;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Create a new i18n instance
 */
export function createI18n(initialLocale: Locale = 'en'): I18n {
  let currentLocale: Locale = initialLocale;

  return {
    t(key: string, params?: Record<string, string | number>): string {
      const translation = getNestedValue(translations[currentLocale], key);
      if (translation === undefined) {
        return key;
      }
      return replaceParams(translation, params);
    },

    setLocale(locale: Locale): void {
      currentLocale = locale;
    },

    getLocale(): Locale {
      return currentLocale;
    },
  };
}

/**
 * Default i18n instance
 */
export const i18n = createI18n();

export { en } from './en.js';
export { ja } from './ja.js';
