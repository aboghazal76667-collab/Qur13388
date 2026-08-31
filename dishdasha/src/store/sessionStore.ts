import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ACTIVE_MARKET } from '@dd/config/market';
import { ENV } from '@dd/config/env';
import type { AppRole } from '@dd/domain/types';
import { createStorage } from './persist';

export type AuthMethod = 'demo' | 'phone' | 'email' | null;

type SessionState = {
  isAuthenticated: boolean;
  authMethod: AuthMethod;
  /** DEV-only view switcher — real authorisation is enforced server-side. */
  role: AppRole;
  /** Which tailor business the dashboard is scoped to while role = tailor. */
  activeTailorBusinessId: string | null;
  language: 'ar' | 'en';
  hasSeenWelcome: boolean;
  signInDemo: () => void;
  signIn: (method: Exclude<AuthMethod, null>) => void;
  signOut: () => void;
  setRole: (role: AppRole) => void;
  setActiveTailorBusinessId: (id: string | null) => void;
  setLanguage: (lang: 'ar' | 'en') => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      authMethod: null,
      role: 'customer',
      activeTailorBusinessId: 'tlr_al_asalah',
      language: ACTIVE_MARKET.defaultLanguage,
      hasSeenWelcome: false,
      signInDemo: () =>
        set({ isAuthenticated: true, authMethod: 'demo', hasSeenWelcome: true, role: 'customer' }),
      signIn: (method) =>
        set({ isAuthenticated: true, authMethod: method, hasSeenWelcome: true, role: 'customer' }),
      signOut: () => set({ isAuthenticated: false, authMethod: null, role: 'customer' }),
      setRole: (role) => set({ role: ENV.SHOW_ROLE_SWITCHER ? role : 'customer' }),
      setActiveTailorBusinessId: (id) => set({ activeTailorBusinessId: id }),
      setLanguage: (language) => set({ language }),
    }),
    { name: 'session', storage: createStorage<SessionState>() },
  ),
);
