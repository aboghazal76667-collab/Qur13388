import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { EMBROIDERY_PATTERNS } from '@dd/data/embroidery';
import { FABRICS } from '@dd/data/fabrics';
import { GARMENT_COLORS, THREAD_COLORS } from '@dd/data/colors';
import type {
  EmbroideryPattern,
  Fabric,
  GarmentColor,
  ThreadColor,
} from '@dd/domain/types';
import { hexToHsl } from '@dd/engine/color';
import { createStorage } from './persist';

/**
 * Catalogue with admin overrides.
 *
 * Seed data is the baseline; the demo admin screen writes overrides on top and
 * persists them locally. When Supabase is connected the same shape is filled
 * from the database instead — screens read from here either way.
 */
type CatalogState = {
  fabrics: Fabric[];
  patterns: EmbroideryPattern[];
  colors: GarmentColor[];
  threads: ThreadColor[];

  setFabricActive: (id: string, active: boolean) => void;
  setFabricPrice: (id: string, price: number) => void;
  setFabricStock: (id: string, inStock: boolean) => void;
  addFabric: (fabric: Fabric) => void;
  setPatternActive: (id: string, active: boolean) => void;
  setPatternSurcharge: (id: string, surcharge: number) => void;
  addColor: (color: Omit<GarmentColor, 'lightness'>) => void;
  addThread: (thread: ThreadColor) => void;
  resetCatalog: () => void;
};

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      fabrics: FABRICS,
      patterns: EMBROIDERY_PATTERNS,
      colors: GARMENT_COLORS,
      threads: THREAD_COLORS,

      setFabricActive: (id, active) =>
        set({ fabrics: get().fabrics.map((f) => (f.id === id ? { ...f, active } : f)) }),

      setFabricPrice: (id, pricePerGarment) =>
        set({
          fabrics: get().fabrics.map((f) =>
            f.id === id ? { ...f, pricePerGarment: Math.max(0, pricePerGarment) } : f,
          ),
        }),

      setFabricStock: (id, inStock) =>
        set({ fabrics: get().fabrics.map((f) => (f.id === id ? { ...f, inStock } : f)) }),

      addFabric: (fabric) => set({ fabrics: [fabric, ...get().fabrics] }),

      setPatternActive: (id, active) =>
        set({ patterns: get().patterns.map((p) => (p.id === id ? { ...p, active } : p)) }),

      setPatternSurcharge: (id, surcharge) =>
        set({
          patterns: get().patterns.map((p) =>
            p.id === id ? { ...p, surcharge: Math.max(0, surcharge) } : p,
          ),
        }),

      addColor: (color) =>
        set({
          colors: [...get().colors, { ...color, lightness: hexToHsl(color.hex).l }],
        }),

      addThread: (thread) => set({ threads: [...get().threads, thread] }),

      resetCatalog: () =>
        set({
          fabrics: FABRICS,
          patterns: EMBROIDERY_PATTERNS,
          colors: GARMENT_COLORS,
          threads: THREAD_COLORS,
        }),
    }),
    { name: 'catalog', storage: createStorage<CatalogState>() },
  ),
);
