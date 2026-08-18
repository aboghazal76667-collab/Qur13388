/** AsyncStorage-backed persistence helper shared by the zustand stores. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, type PersistOptions } from 'zustand/middleware';

export const STORAGE_KEYS = {
  settings: 'qi:settings:v1',
  history: 'qi:history:v1',
  favorites: 'qi:favorites:v1',
} as const;

export function persistConfig<T>(name: string, partialize?: PersistOptions<T>['partialize']) {
  return {
    name,
    storage: createJSONStorage(() => AsyncStorage),
    partialize,
    version: 1,
  } satisfies PersistOptions<T>;
}

export { persist };
