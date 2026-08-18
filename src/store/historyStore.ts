import { create } from 'zustand';

import type { AnalysisResult } from '../types/analysis';
import type { HistoryEntry } from '../types/app';
import { persist, persistConfig } from './persist';

interface HistoryState {
  entries: HistoryEntry[];
  add: (result: AnalysisResult) => HistoryEntry;
  remove: (id: string) => void;
  clear: () => void;
  get: (id: string) => HistoryEntry | undefined;
}

const MAX_ENTRIES = 100;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (result) => {
        const entry: HistoryEntry = {
          id: result.id,
          question: result.question,
          createdAt: result.createdAt,
          engine: result.engine,
          summary: result.summary,
          result,
        };
        set((s) => ({ entries: [entry, ...s.entries.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES) }));
        return entry;
      },
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
      get: (id) => get().entries.find((e) => e.id === id),
    }),
    persistConfig<HistoryState>('qi:history:v1', (state) => ({ entries: state.entries }) as HistoryState)
  )
);
