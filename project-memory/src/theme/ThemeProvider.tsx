import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import {
  elevation,
  minTouchTarget,
  motion,
  palettes,
  radius,
  spacing,
  typography,
  type ColorScheme,
  type Palette,
} from './tokens';

export type AppearancePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
  minTouchTarget: number;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  preference,
  children,
}: {
  preference: AppearancePreference;
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      colors: palettes[scheme],
      spacing,
      radius,
      typography,
      elevation,
      motion,
      minTouchTarget,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
