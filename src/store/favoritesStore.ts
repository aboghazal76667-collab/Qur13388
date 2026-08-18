import { create } from 'zustand';

import type { Favorite } from '../types/app';
import { persist, persistConfig } from './persist';

interface FavoritesState {
  items: Favorite[];
  add: (favorite: Favorite) => void;
  remove: (id: string) => void;
  toggle: (favorite: Favorite) => void;
  has: (id: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (favorite) =>
        set((s) => (s.items.some((i) => i.id === favorite.id) ? s : { items: [favorite, ...s.items] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      toggle: (favorite) =>
        set((s) =>
          s.items.some((i) => i.id === favorite.id)
            ? { items: s.items.filter((i) => i.id !== favorite.id) }
            : { items: [favorite, ...s.items] }
        ),
      has: (id) => get().items.some((i) => i.id === id),
      clear: () => set({ items: [] }),
    }),
    persistConfig<FavoritesState>('qi:favorites:v1', (state) => ({ items: state.items }) as FavoritesState)
  )
);
