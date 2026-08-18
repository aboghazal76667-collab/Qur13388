/** App-level types: history, favourites, settings, backend contract. */

import type { AnalysisResult, ComparisonResult, WordAnalysis } from './analysis';
import type { QuranReference, VerseKey } from './quran';
import type { ThinkerClaim } from './knowledge';

export interface HistoryEntry {
  id: string;
  question: string;
  createdAt: string;
  engine: 'ai' | 'offline';
  summary: string;
  result: AnalysisResult;
}

export type FavoriteKind = 'verse' | 'analysis' | 'claim' | 'comparison' | 'word';

export interface FavoriteBase {
  id: string;
  kind: FavoriteKind;
  createdAt: string;
  title: string;
  subtitle?: string;
}

export interface VerseFavorite extends FavoriteBase {
  kind: 'verse';
  verseKey: VerseKey;
  reference: QuranReference;
}

export interface AnalysisFavorite extends FavoriteBase {
  kind: 'analysis';
  result: AnalysisResult;
}

export interface ClaimFavorite extends FavoriteBase {
  kind: 'claim';
  claim: ThinkerClaim;
}

export interface ComparisonFavorite extends FavoriteBase {
  kind: 'comparison';
  comparison: ComparisonResult;
}

export interface WordFavorite extends FavoriteBase {
  kind: 'word';
  analysis: WordAnalysis;
}

export type Favorite =
  | VerseFavorite
  | AnalysisFavorite
  | ClaimFavorite
  | ComparisonFavorite
  | WordFavorite;

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  /** Base font scale for Arabic body text. */
  quranFontScale: number;
  /** Backend proxy base URL. Empty means "auto-detect from the dev server". */
  apiBaseUrl: string;
  /** When false the app never leaves the device; only the offline engine runs. */
  aiEnabled: boolean;
  showTranslationHints: boolean;
}

// ---------------------------------------------------------------------------
// Backend contract
// ---------------------------------------------------------------------------

export interface AnalyzeRequest {
  question: string;
  mode: 'quran-only';
  /** Verses the client retrieved locally and is offering as context. */
  context: {
    key: string;
    surah: number;
    ayah: number;
    text: string;
  }[];
  /** Corpus facts the client computed, so the model does not have to guess. */
  lexicalFacts: {
    term: string;
    root?: string;
    occurrenceCount: number;
    verseCount: number;
    forms: string[];
    sampleKeys: string[];
  }[];
  questionAnalysis?: unknown;
}

export interface AnalyzeResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}
