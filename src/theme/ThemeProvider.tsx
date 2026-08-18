import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkPalette, lightPalette, radii, spacing, typography, type Palette } from './tokens';
import { useSettingsStore } from '../store/settingsStore';

interface ThemeValue {
  palette: Palette;
  isDark: boolean;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  /** Multiplier applied to Quranic body text, from settings. */
  quranScale: number;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((s) => s.settings.theme);
  const quranScale = useSettingsStore((s) => s.settings.quranFontScale);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const value = useMemo<ThemeValue>(
    () => ({
      palette: isDark ? darkPalette : lightPalette,
      isDark,
      spacing,
      radii,
      typography,
      quranScale,
    }),
    [isDark, quranScale]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
