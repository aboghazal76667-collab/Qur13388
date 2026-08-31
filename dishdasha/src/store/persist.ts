import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * Storage adapter for zustand's persist middleware.
 *
 * Everything is device-local. Unfinished designs, cart contents and demo
 * orders survive an app restart and a lost connection, which is the whole
 * point on a patchy mobile network.
 */
export const STORAGE_PREFIX = 'dishdasha.v1.';

export const createStorage = <T>(): PersistStorage<T> => ({
  getItem: async (name) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + name);
      return raw ? (JSON.parse(raw) as StorageValue<T>) : null;
    } catch {
      // Corrupt or unreadable state must never brick the app: start fresh.
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(value));
    } catch {
      /* Storage full or unavailable — the session continues in memory. */
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(STORAGE_PREFIX + name);
    } catch {
      /* ignore */
    }
  },
});

/** Used by the "delete my data" flow. */
export const clearAllPersistedState = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    /* ignore */
  }
};
