import { create } from 'zustand';

import { getBackend, prepareBackend, type AuthSession, type SignInInput, type SignUpInput } from '@/data';
import { toAppError } from '@/lib/errors';
import { log } from '@/lib/log';
import { analytics } from '@/services/analytics';
import type { Profile } from '@/domain';

/**
 * Who is signed in.
 *
 * Nothing in the app reads the backend's auth gateway directly; screens read
 * this store, which means swapping backends changes nothing above this line.
 */
interface SessionState {
  status: 'unknown' | 'signed_out' | 'signed_in';
  profile: Profile | null;
  familyId: string | null;
  error: unknown;
  busy: boolean;

  restore: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'displayName' | 'language' | 'allowsModelTraining'>>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

function apply(session: AuthSession | null): Partial<SessionState> {
  return session
    ? { status: 'signed_in', profile: session.profile, familyId: session.familyId, error: null }
    : { status: 'signed_out', profile: null, familyId: null };
}

export const useSession = create<SessionState>((set) => ({
  status: 'unknown',
  profile: null,
  familyId: null,
  error: null,
  busy: false,

  restore: async () => {
    try {
      await prepareBackend();
      const session = await getBackend().auth.getSession();
      set(apply(session));
      analytics.track('app_opened', { signedIn: Boolean(session) });
    } catch (error) {
      log.warn('could not restore session', { error: String(error) });
      set({ status: 'signed_out' });
    }
  },

  signUp: async (input) => {
    set({ busy: true, error: null });
    try {
      const session = await getBackend().auth.signUp(input);
      set({ ...apply(session), busy: false });
    } catch (error) {
      set({ busy: false, error: toAppError(error, 'validation') });
      throw error;
    }
  },

  signIn: async (input) => {
    set({ busy: true, error: null });
    try {
      const session = await getBackend().auth.signIn(input);
      set({ ...apply(session), busy: false });
    } catch (error) {
      set({ busy: false, error: toAppError(error, 'auth') });
      throw error;
    }
  },

  signOut: async () => {
    await getBackend().auth.signOut();
    set(apply(null));
  },

  updateProfile: async (patch) => {
    const profile = await getBackend().auth.updateProfile(patch);
    set({ profile });
  },

  deleteAccount: async () => {
    set({ busy: true });
    try {
      await getBackend().auth.deleteAccount();
      set({ ...apply(null), busy: false });
    } catch (error) {
      set({ busy: false, error: toAppError(error) });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
