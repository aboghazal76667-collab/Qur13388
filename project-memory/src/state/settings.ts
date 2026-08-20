import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { detectDeviceLanguage, type Language } from '@/i18n';
import type { AppearancePreference } from '@/theme';

/**
 * Device preferences.
 *
 * Kept separate from the account so that language and appearance survive
 * signing out — a parent who set the app to Arabic should not be handed an
 * English sign-in screen.
 */

const KEY = 'project-memory:settings:v1';

interface PersistedSettings {
  language: Language;
  appearance: AppearancePreference;
  onboardingSeen: boolean;
}

interface SettingsState extends PersistedSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => void;
  setAppearance: (appearance: AppearancePreference) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

function persist(state: PersistedSettings): void {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export const useSettings = create<SettingsState>((set, get) => ({
  language: 'en',
  appearance: 'system',
  onboardingSeen: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
        set({
          language: parsed.language === 'ar' ? 'ar' : 'en',
          appearance: parsed.appearance ?? 'system',
          onboardingSeen: parsed.onboardingSeen ?? false,
          hydrated: true,
        });
        return;
      }
      // First launch: follow the phone rather than assuming English.
      set({ language: detectDeviceLanguage(), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setLanguage: (language) => {
    set({ language });
    const { appearance, onboardingSeen } = get();
    persist({ language, appearance, onboardingSeen });
  },

  setAppearance: (appearance) => {
    set({ appearance });
    const { language, onboardingSeen } = get();
    persist({ language, appearance, onboardingSeen });
  },

  completeOnboarding: () => {
    set({ onboardingSeen: true });
    const { language, appearance } = get();
    persist({ language, appearance, onboardingSeen: true });
  },

  resetOnboarding: () => {
    set({ onboardingSeen: false });
    const { language, appearance } = get();
    persist({ language, appearance, onboardingSeen: false });
  },
}));
