/**
 * Core Quran data types.
 *
 * The Quranic text itself NEVER originates from a language model. Every string
 * in these structures is read from the bundled dataset. An LLM may only ask for
 * a reference (`surah` + `ayah`); the application resolves the text locally.
 */

export type SurahRevelationType = 'makki' | 'madani';

export interface Surah {
  /** 1-based surah number. */
  number: number;
  nameArabic: string;
  nameTransliterated: string;
  revelationType: SurahRevelationType;
  ayahCount: number;
  /** Index of this surah's first verse in the flat verse array. */
  startIndex: number;
}

/**
 * Grammatical features attached to a single word, derived from the
 * Quranic Arabic Corpus morphology.
 */
export interface QuranWordMorphology {
  root?: string;
  lemma?: string;
  /** Coarse part of speech: N (nominal), V (verb), P (particle). */
  pos?: string;
  /** Raw corpus feature tags, e.g. PERF, 3MP, GEN, ACT_PCPL, IMPV. */
  features: string[];
}

export interface QuranWord extends QuranWordMorphology {
  /** 0-based position within the verse. */
  index: number;
  /** Surface form as it appears in the Uthmani text. */
  surface: string;
  /** Diacritics/hamza/tatweel-normalised surface form. */
  normalized: string;
  verseKey: VerseKey;
}

/** Canonical `surah:ayah` string, e.g. `"2:183"`. */
export type VerseKey = string;

export interface QuranVerse {
  /** Flat 0-based index across the whole mushaf. */
  index: number;
  key: VerseKey;
  surahNumber: number;
  surahNameArabic: string;
  ayahNumber: number;
  /** Uthmani script, exactly as stored in the dataset. */
  uthmaniText: string;
  /** Search-friendly form: diacritics stripped, hamza and alif unified. */
  normalizedText: string;
  words: QuranWord[];
  roots: string[];
  lemmas: string[];
  /** Concept ids from the curated concept map that touch this verse. */
  topics: string[];
}

/**
 * A citation. `text` is always filled in by the app from the dataset, which is
 * how fabricated or mis-numbered verses get caught before they reach the UI.
 */
export interface QuranReference {
  surah: number;
  ayah: number;
  key: VerseKey;
  text: string;
  surahNameArabic: string;
  /** Why this verse was retrieved for the question at hand. */
  relevance?: string;
}

export interface RootOccurrence {
  root: string;
  verseKey: VerseKey;
  wordIndex: number;
  surface: string;
  lemma?: string;
  pos?: string;
  features: string[];
}

export interface RootProfile {
  root: string;
  occurrenceCount: number;
  verseCount: number;
  surahCount: number;
  lemmas: { lemma: string; count: number }[];
  forms: { surface: string; count: number }[];
  occurrences: RootOccurrence[];
}

export type SearchMode = 'exact' | 'normalized' | 'root' | 'semantic';

export interface SearchHit {
  verse: QuranVerse;
  mode: SearchMode;
  score: number;
  matchedWordIndexes: number[];
  reason: string;
}
