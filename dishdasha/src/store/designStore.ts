import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEMO_CUSTOMER_ID, DEMO_DESIGNS } from '@dd/data/demo';
import { ENV } from '@dd/config/env';
import {
  applyPattern,
  applyThreadColor,
  createDefaultConfig,
  hashConfig,
  normalizeConfig,
} from '@dd/engine/design';
import type { Design, DesignConfig, PaletteSuggestion, PriceBreakdown } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import { createStorage } from './persist';

const HISTORY_LIMIT = 25;

type DesignState = {
  /** The design currently open in the studio. Persisted, so a dropped network
   *  or a killed app never loses work in progress. */
  config: DesignConfig;
  history: DesignConfig[];
  /** Design id when the studio is editing a saved design rather than a new one. */
  editingDesignId: string | null;
  savedDesigns: Design[];
  /** Up to three configs held for side-by-side comparison. */
  compareSlots: DesignConfig[];
  lastAppliedPaletteId: string | null;

  setConfig: (config: DesignConfig) => void;
  setFabric: (fabricId: string) => void;
  setBaseColor: (colorId: string) => void;
  setPattern: (patternId: string | null) => void;
  setThreadColor: (channelIndex: number, threadColorId: string) => void;
  setFurakhaColor: (threadColorId: string) => void;
  setComponentOption: (componentId: string, optionId: string) => void;
  applyPalette: (palette: PaletteSuggestion) => void;
  undo: () => void;
  reset: () => void;
  startNew: () => void;
  loadDesign: (designId: string) => void;

  saveDesign: (name: string, price: PriceBreakdown | null, extras?: Partial<Design>) => Design;
  toggleFavorite: (designId: string) => void;
  deleteDesign: (designId: string) => void;

  addToCompare: (config?: DesignConfig) => boolean;
  removeFromCompare: (index: number) => void;
  clearCompare: () => void;
};

const push = (history: DesignConfig[], config: DesignConfig): DesignConfig[] =>
  [...history, config].slice(-HISTORY_LIMIT);

export const useDesignStore = create<DesignState>()(
  persist(
    (set, get) => ({
      config: createDefaultConfig(),
      history: [],
      editingDesignId: null,
      savedDesigns: ENV.DEMO_MODE ? DEMO_DESIGNS : [],
      compareSlots: [],
      lastAppliedPaletteId: null,

      setConfig: (config) =>
        set({ history: push(get().history, get().config), config: normalizeConfig(config) }),

      setFabric: (fabricId) =>
        set({
          history: push(get().history, get().config),
          config: normalizeConfig({ ...get().config, fabricId }),
        }),

      setBaseColor: (baseColorId) =>
        set({
          history: push(get().history, get().config),
          config: normalizeConfig({ ...get().config, baseColorId }),
        }),

      setPattern: (patternId) =>
        set({
          history: push(get().history, get().config),
          config: applyPattern(get().config, patternId),
        }),

      // Only the named channel changes — the rest of the embroidery is untouched.
      setThreadColor: (channelIndex, threadColorId) =>
        set({
          history: push(get().history, get().config),
          config: applyThreadColor(get().config, channelIndex, threadColorId),
        }),

      setFurakhaColor: (furakhaColorId) =>
        set({
          history: push(get().history, get().config),
          config: normalizeConfig({ ...get().config, furakhaColorId }),
        }),

      setComponentOption: (componentId, optionId) =>
        set({
          history: push(get().history, get().config),
          config: normalizeConfig({
            ...get().config,
            componentOptions: { ...get().config.componentOptions, [componentId]: optionId },
          }),
        }),

      applyPalette: (palette) => {
        const base = get().config;
        const withPattern = palette.suggestedPatternId
          ? applyPattern(base, palette.suggestedPatternId)
          : base;
        set({
          history: push(get().history, base),
          config: normalizeConfig({
            ...withPattern,
            baseColorId: palette.baseColorId,
            threadColorIds: palette.threadColorIds,
            furakhaColorId: palette.furakhaColorId,
          }),
          lastAppliedPaletteId: palette.id,
        });
      },

      undo: () => {
        const history = get().history;
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        set({ config: previous, history: history.slice(0, -1) });
      },

      reset: () => set({ config: createDefaultConfig(), history: [], lastAppliedPaletteId: null }),

      startNew: () =>
        set({
          config: createDefaultConfig(),
          history: [],
          editingDesignId: null,
          lastAppliedPaletteId: null,
        }),

      loadDesign: (designId) => {
        const design = get().savedDesigns.find((d) => d.id === designId);
        if (!design) return;
        set({
          history: push(get().history, get().config),
          config: normalizeConfig(design.config),
          editingDesignId: design.id,
        });
      },

      saveDesign: (name, price, extras) => {
        const config = normalizeConfig(get().config);
        const at = nowIso();
        const editingId = get().editingDesignId;
        const existing = editingId
          ? get().savedDesigns.find((d) => d.id === editingId)
          : undefined;

        const design: Design = {
          id: existing?.id ?? uuid(),
          customerId: existing?.customerId ?? DEMO_CUSTOMER_ID,
          name: name.trim() || `تصميم ${new Date().getDate()}/${new Date().getMonth() + 1}`,
          config,
          configHash: hashConfig(config),
          measurementProfileId: extras?.measurementProfileId ?? existing?.measurementProfileId ?? null,
          tailorBusinessId: extras?.tailorBusinessId ?? existing?.tailorBusinessId ?? null,
          aiRecommendationId: get().lastAppliedPaletteId,
          priceSnapshot: price,
          previewAssetId: extras?.previewAssetId ?? null,
          isFavorite: existing?.isFavorite ?? false,
          createdAt: existing?.createdAt ?? at,
          updatedAt: at,
          deletedAt: null,
        };

        const others = get().savedDesigns.filter((d) => d.id !== design.id);
        set({ savedDesigns: [design, ...others], editingDesignId: design.id });
        return design;
      },

      toggleFavorite: (designId) =>
        set({
          savedDesigns: get().savedDesigns.map((d) =>
            d.id === designId ? { ...d, isFavorite: !d.isFavorite, updatedAt: nowIso() } : d,
          ),
        }),

      deleteDesign: (designId) =>
        set({ savedDesigns: get().savedDesigns.filter((d) => d.id !== designId) }),

      addToCompare: (config) => {
        const slots = get().compareSlots;
        if (slots.length >= 3) return false;
        const candidate = normalizeConfig(config ?? get().config);
        const hash = hashConfig(candidate);
        if (slots.some((s) => hashConfig(s) === hash)) return false;
        set({ compareSlots: [...slots, candidate] });
        return true;
      },

      removeFromCompare: (index) =>
        set({ compareSlots: get().compareSlots.filter((_, i) => i !== index) }),

      clearCompare: () => set({ compareSlots: [] }),
    }),
    { name: 'design', storage: createStorage<DesignState>() },
  ),
);

export const visibleDesigns = (designs: Design[]) => designs.filter((d) => d.deletedAt === null);
