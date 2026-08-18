import { create } from 'zustand';

import type { AnalysisResult } from '../types/analysis';
import type { AnalysisStage } from '../analysis/pipeline';

interface AnalysisState {
  /** Results keyed by id, kept in memory for the current session. */
  results: Record<string, AnalysisResult>;
  current: AnalysisResult | null;
  running: boolean;
  stage: AnalysisStage | null;
  error: string | null;
  setRunning: (running: boolean, stage?: AnalysisStage | null) => void;
  setStage: (stage: AnalysisStage) => void;
  setError: (error: string | null) => void;
  store: (result: AnalysisResult) => void;
  getResult: (id: string) => AnalysisResult | undefined;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  results: {},
  current: null,
  running: false,
  stage: null,
  error: null,
  setRunning: (running, stage = null) => set({ running, stage, error: running ? null : get().error }),
  setStage: (stage) => set({ stage }),
  setError: (error) => set({ error, running: false }),
  store: (result) =>
    set((s) => ({ results: { ...s.results, [result.id]: result }, current: result, running: false, stage: 'done' })),
  getResult: (id) => get().results[id],
}));
