import { create } from 'zustand';

import type { Settings, ThemePreference } from '../types/app';
import { persist, persistConfig } from './persist';

interface SettingsState {
  settings: Settings;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setQuranFontScale: (scale: number) => void;
  setApiBaseUrl: (url: string) => void;
  setAiEnabled: (enabled: boolean) => void;
  setShowTranslationHints: (enabled: boolean) => void;
  reset: () => void;
}

const DEFAULTS: Settings = {
  theme: 'system',
  quranFontScale: 1,
  apiBaseUrl: '',
  aiEnabled: true,
  showTranslationHints: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      hydrated: false,
      setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),
      setQuranFontScale: (quranFontScale) =>
        set((s) => ({
          settings: { ...s.settings, quranFontScale: Math.min(1.6, Math.max(0.8, quranFontScale)) },
        })),
      setApiBaseUrl: (apiBaseUrl) => set((s) => ({ settings: { ...s.settings, apiBaseUrl } })),
      setAiEnabled: (aiEnabled) => set((s) => ({ settings: { ...s.settings, aiEnabled } })),
      setShowTranslationHints: (showTranslationHints) =>
        set((s) => ({ settings: { ...s.settings, showTranslationHints } })),
      reset: () => set({ settings: DEFAULTS }),
    }),
    {
      ...persistConfig<SettingsState>('qi:settings:v1'),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
