import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';

import { format } from './format';
import { en, type Language, type Strings } from './strings';
import { ar } from './ar';

export type { Language, Strings } from './strings';
export { format } from './format';

const catalogues: Record<Language, Strings> = { en, ar };

export const rtlLanguages: readonly Language[] = ['ar'];

export function isRtlLanguage(language: Language): boolean {
  return rtlLanguages.includes(language);
}

/** The device language, if we support it; English otherwise. */
export function detectDeviceLanguage(): Language {
  try {
    const tags = Localization.getLocales();
    for (const locale of tags) {
      const code = (locale.languageCode ?? '').toLowerCase();
      if (code === 'ar') return 'ar';
      if (code === 'en') return 'en';
    }
  } catch {
    // Localization is unavailable in some test environments; fall through.
  }
  return 'en';
}

export interface I18nValue {
  language: Language;
  isRtl: boolean;
  t: Strings;
  /** `writingDirection` for text and `direction` for layout containers. */
  direction: 'ltr' | 'rtl';
  format: typeof format;
  /** Locale tag suitable for `Intl` / `toLocaleDateString`. */
  locale: string;
  formatDate: (isoDate: string, style?: 'long' | 'medium' | 'short') => string;
  formatNumber: (value: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  const isRtl = isRtlLanguage(language);

  // We drive direction through explicit style props rather than
  // I18nManager.forceRTL, because forceRTL requires a native reload to take
  // effect and would make language switching feel broken. `allowRTL` keeps
  // native components (e.g. text input carets) behaving correctly.
  if (I18nManager.allowRTL) {
    I18nManager.allowRTL(true);
  }

  const locale = language === 'ar' ? 'ar' : 'en-GB';

  const formatDate = useCallback(
    (isoDate: string, style: 'long' | 'medium' | 'short' = 'medium') => {
      const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(date.getTime())) return isoDate;
      const options: Intl.DateTimeFormatOptions =
        style === 'long'
          ? { day: 'numeric', month: 'long', year: 'numeric' }
          : style === 'short'
            ? { day: 'numeric', month: 'short' }
            : { day: 'numeric', month: 'short', year: 'numeric' };
      try {
        return new Intl.DateTimeFormat(locale, options).format(date);
      } catch {
        return isoDate;
      }
    },
    [locale],
  );

  const formatNumber = useCallback(
    (value: number) => {
      try {
        return new Intl.NumberFormat(locale).format(value);
      } catch {
        return String(value);
      }
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({
      language,
      isRtl,
      t: catalogues[language],
      direction: isRtl ? 'rtl' : 'ltr',
      format,
      locale,
      formatDate,
      formatNumber,
    }),
    [language, isRtl, locale, formatDate, formatNumber],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
