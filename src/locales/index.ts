/**
 * Lightweight i18n helper.
 *
 * Usage:
 *   import { t } from '@/locales';
 *   <Text>{t('auth.login')}</Text>
 *
 * To add a new language:
 *   1. Create e.g. src/locales/en.ts (copy ru.ts and translate)
 *   2. Import it here and add to `locales`
 *   3. Change `currentLocale` or make it dynamic (e.g. from AsyncStorage)
 */

import ru, { type LocaleStrings } from './ru';

// All registered locales
const locales: Record<string, LocaleStrings> = {
    ru,
};

// Current active locale
let currentLocale = 'ru';

/**
 * Get a translated string by dot-separated key path.
 * Example: t('auth.login') → 'Войти'
 */
export function t(keyPath: string): string {
    const keys = keyPath.split('.');
    let result: unknown = locales[currentLocale] ?? locales.ru;

    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = (result as Record<string, unknown>)[key];
        } else {
            // Key not found — return the path as fallback
            return keyPath;
        }
    }

    if (typeof result === 'string') return result;
    return keyPath;
}

/**
 * Set the active locale.
 */
export function setLocale(locale: string) {
    if (locales[locale]) {
        currentLocale = locale;
    }
}

/**
 * Get the current locale key.
 */
export function getLocale(): string {
    return currentLocale;
}

export { ru };
export type { LocaleStrings };
