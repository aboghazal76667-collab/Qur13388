/** AsyncStorage-backed persistence helper shared by the zustand stores. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, type PersistOptions } from 'zustand/middleware';

export const STORAGE_KEYS = {
  settings: 'qi:settings:v1',
  history: 'qi:history:v1',
  favorites: 'qi:favorites:v1',
} as const;

/**
 * Storage is a convenience, never a dependency.
 *
 * The web build of AsyncStorage is backed by localStorage, which throws when it
 * is unavailable — a sandboxed frame, Safari private browsing, a full quota.
 * An unhandled throw there would take the whole app down on launch over saved
 * history, so every call degrades to an in-memory map instead. The session
 * still works; only persistence across restarts is lost.
 */
const memoryFallback = new Map<string, string>();
let persistentStorageWorks = true;

export const safeStorage = {
  async getItem(name: string): Promise<string | null> {
    if (persistentStorageWorks) {
      try {
        return await AsyncStorage.getItem(name);
      } catch {
        persistentStorageWorks = false;
      }
    }
    return memoryFallback.get(name) ?? null;
  },

  async setItem(name: string, value: string): Promise<void> {
    memoryFallback.set(name, value);
    if (!persistentStorageWorks) return;
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      persistentStorageWorks = false;
    }
  },

  async removeItem(name: string): Promise<void> {
    memoryFallback.delete(name);
    if (!persistentStorageWorks) return;
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      persistentStorageWorks = false;
    }
  },
};

/** False once a storage call has failed, so the UI can say so if it matters. */
export function isPersistenceAvailable(): boolean {
  return persistentStorageWorks;
}

export function persistConfig<T>(name: string, partialize?: PersistOptions<T>['partialize']) {
  return {
    name,
    storage: createJSONStorage(() => safeStorage),
    partialize,
    version: 1,
  } satisfies PersistOptions<T>;
}

export { persist };
