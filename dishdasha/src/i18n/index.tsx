import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { I18nManager } from 'react-native';

import { ACTIVE_MARKET } from '@dd/config/market';
import { dictionaries, type Language, type StringKey } from './strings';

export type { Language, StringKey };

export type Localized = { ar: string; en: string };

export type I18nValue = {
  lang: Language;
  isRTL: boolean;
  /** Text direction for flex rows; RTL-aware without relying on native RTL flip. */
  dir: 'rtl' | 'ltr';
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  /** Picks the right side of a `{ ar, en }` value coming from data. */
  L: (value: Localized | string | undefined) => string;
  setLang: (lang: Language) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export const I18nProvider: React.FC<{
  lang: Language;
  setLang: (lang: Language) => void;
  children: React.ReactNode;
}> = ({ lang, setLang, children }) => {
  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      let out: string = dictionaries[lang][key] ?? dictionaries.ar[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.split('{' + k + '}').join(String(v));
        }
      }
      return out;
    },
    [lang],
  );

  const L = useCallback(
    (value: Localized | string | undefined) => {
      if (value === undefined) return '';
      if (typeof value === 'string') return value;
      return value[lang] || value.ar || value.en;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      isRTL: lang === 'ar',
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      t,
      L,
      setLang,
    }),
    [lang, t, L, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback so a component rendered outside the provider (e.g. an
    // error boundary above it) still renders readable text.
    const lang: Language = ACTIVE_MARKET.defaultLanguage;
    return {
      lang,
      isRTL: lang === 'ar',
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      t: (k) => dictionaries[lang][k] ?? k,
      L: (v) => (typeof v === 'string' ? v : v ? v[lang] : ''),
      setLang: () => undefined,
    };
  }
  return ctx;
};

/**
 * We deliberately do NOT call I18nManager.forceRTL: it requires a native
 * reload to take effect, which breaks in-app language switching and Expo Go
 * demos. Instead every layout uses explicit `flexDirection` derived from
 * `dir`, and text uses `writingDirection`. This keeps Arabic first-class and
 * switchable at runtime on both platforms.
 */
export const rtlSupported = () => !I18nManager.isRTL;

export const rowDirection = (dir: 'rtl' | 'ltr') =>
  dir === 'rtl' ? ('row-reverse' as const) : ('row' as const);

export const textAlign = (dir: 'rtl' | 'ltr') =>
  dir === 'rtl' ? ('right' as const) : ('left' as const);

/**
 * Isolates a left-to-right token inside Arabic text.
 *
 * Without this the bidi algorithm moves leading neutral characters to the end:
 * a thread reference `#EFE7D6` renders as `EFE7D6#`, which a workshop would
 * read as the wrong colour code. U+2066 (LRI) … U+2069 (PDI) pins the token's
 * direction without affecting the surrounding sentence.
 */
export const ltr = (value: string | null | undefined): string =>
  value ? `\u2066${value}\u2069` : '';
