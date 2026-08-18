/**
 * The Quran repository: the only place verse text ever comes from.
 *
 * Everything is loaded from the bundled dataset and indexed lazily on first
 * use. No verse string in this application is ever produced by, or passed
 * through, a language model.
 */

import surahsRaw from '../data/generated/surahs.json';
import versesRaw from '../data/generated/verses.json';
import morphologyRaw from '../data/generated/morphology.json';

import type {
  QuranReference,
  QuranVerse,
  QuranWord,
  RootOccurrence,
  RootProfile,
  Surah,
  VerseKey,
} from '../types/quran';
import { normalizeArabic, normalizeRoot } from './arabic';

interface RawSurah {
  n: number;
  ar: string;
  en: string;
  tr: string;
  type: 'makki' | 'madani';
  count: number;
  start: number;
}

/** [rootIdx, lemmaIdx, posIdx, featureIdxs] with -1 meaning "absent". */
type RawToken = [number, number, number, number[]];

interface RawMorphology {
  roots: string[];
  lemmas: string[];
  pos: string[];
  feats: string[];
  /** `0` marks a verse whose word boundaries could not be aligned. */
  verses: (RawToken[] | 0)[];
}

const rawSurahs = surahsRaw as RawSurah[];
const rawVerses = versesRaw as string[];
const morph = morphologyRaw as unknown as RawMorphology;

export const TOTAL_VERSES = rawVerses.length;

export const surahs: Surah[] = rawSurahs.map((s) => ({
  number: s.n,
  nameArabic: s.ar,
  nameTransliterated: s.tr,
  revelationType: s.type,
  ayahCount: s.count,
  startIndex: s.start,
}));

const surahByNumber = new Map<number, Surah>(surahs.map((s) => [s.number, s]));

// ---------------------------------------------------------------------------
// Verse construction (memoised per verse)
// ---------------------------------------------------------------------------

const verseCache = new Map<number, QuranVerse>();
const keyToIndex = new Map<VerseKey, number>();
const topicsByVerse = new Map<VerseKey, string[]>();

(function buildKeyIndex() {
  for (const s of rawSurahs) {
    for (let a = 1; a <= s.count; a++) {
      keyToIndex.set(`${s.n}:${a}`, s.start + a - 1);
    }
  }
})();

function surahOfIndex(index: number): RawSurah {
  // Binary search over surah start offsets.
  let lo = 0;
  let hi = rawSurahs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rawSurahs[mid].start <= index) lo = mid;
    else hi = mid - 1;
  }
  return rawSurahs[lo];
}

function buildVerse(index: number): QuranVerse {
  const cached = verseCache.get(index);
  if (cached) return cached;

  const surah = surahOfIndex(index);
  const ayahNumber = index - surah.start + 1;
  const key: VerseKey = `${surah.n}:${ayahNumber}`;
  const uthmaniText = rawVerses[index];
  const surfaces = uthmaniText.split(' ');
  const tokens = morph.verses[index];

  const words: QuranWord[] = surfaces.map((surface, i) => {
    const token = tokens === 0 ? undefined : tokens[i];
    const rootIdx = token ? token[0] : -1;
    const lemmaIdx = token ? token[1] : -1;
    const posIdx = token ? token[2] : -1;
    return {
      index: i,
      surface,
      normalized: normalizeArabic(surface),
      verseKey: key,
      root: rootIdx >= 0 ? morph.roots[rootIdx] : undefined,
      lemma: lemmaIdx >= 0 ? morph.lemmas[lemmaIdx] : undefined,
      pos: posIdx >= 0 ? morph.pos[posIdx] : undefined,
      features: token ? token[3].map((f) => morph.feats[f]) : [],
    };
  });

  const roots = Array.from(new Set(words.map((w) => w.root).filter(Boolean) as string[]));
  const lemmas = Array.from(new Set(words.map((w) => w.lemma).filter(Boolean) as string[]));

  const verse: QuranVerse = {
    index,
    key,
    surahNumber: surah.n,
    surahNameArabic: surah.ar,
    ayahNumber,
    uthmaniText,
    normalizedText: normalizeArabic(uthmaniText),
    words,
    roots,
    lemmas,
    topics: topicsByVerse.get(key) ?? [],
  };
  verseCache.set(index, verse);
  return verse;
}

/** Registered by the concept module so verses can report their topics. */
export function registerVerseTopics(map: Map<VerseKey, string[]>): void {
  for (const [key, topics] of map) topicsByVerse.set(key, topics);
  verseCache.clear();
}

export function getSurah(n: number): Surah | undefined {
  return surahByNumber.get(n);
}

export function getVerseByIndex(index: number): QuranVerse | undefined {
  if (index < 0 || index >= TOTAL_VERSES) return undefined;
  return buildVerse(index);
}

export function getVerse(surah: number, ayah: number): QuranVerse | undefined {
  const index = keyToIndex.get(`${surah}:${ayah}`);
  return index === undefined ? undefined : buildVerse(index);
}

export function getVerseByKey(key: VerseKey): QuranVerse | undefined {
  const index = keyToIndex.get(key);
  return index === undefined ? undefined : buildVerse(index);
}

export function getSurahVerses(surahNumber: number): QuranVerse[] {
  const s = surahByNumber.get(surahNumber);
  if (!s) return [];
  const out: QuranVerse[] = [];
  for (let i = 0; i < s.ayahCount; i++) out.push(buildVerse(s.startIndex + i));
  return out;
}

export function allVerses(): QuranVerse[] {
  const out: QuranVerse[] = new Array(TOTAL_VERSES);
  for (let i = 0; i < TOTAL_VERSES; i++) out[i] = buildVerse(i);
  return out;
}

/** Iterate without materialising every verse object at once. */
export function forEachVerse(fn: (verse: QuranVerse) => void): void {
  for (let i = 0; i < TOTAL_VERSES; i++) fn(buildVerse(i));
}

// ---------------------------------------------------------------------------
// Reference resolution — the hallucination guard
// ---------------------------------------------------------------------------

export function verseExists(surah: number, ayah: number): boolean {
  return keyToIndex.has(`${surah}:${ayah}`);
}

/**
 * Turn a numeric reference into a citation whose text comes from the dataset.
 * Returns null when the reference does not exist, which is how invented verses
 * are rejected before they can reach the screen.
 */
export function toReference(surah: number, ayah: number, relevance?: string): QuranReference | null {
  const verse = getVerse(surah, ayah);
  if (!verse) return null;
  return {
    surah: verse.surahNumber,
    ayah: verse.ayahNumber,
    key: verse.key,
    text: verse.uthmaniText,
    surahNameArabic: verse.surahNameArabic,
    relevance,
  };
}

export function referenceFromVerse(verse: QuranVerse, relevance?: string): QuranReference {
  return {
    surah: verse.surahNumber,
    ayah: verse.ayahNumber,
    key: verse.key,
    text: verse.uthmaniText,
    surahNameArabic: verse.surahNameArabic,
    relevance,
  };
}

export function referenceFromKey(key: VerseKey, relevance?: string): QuranReference | null {
  const verse = getVerseByKey(key);
  return verse ? referenceFromVerse(verse, relevance) : null;
}

// ---------------------------------------------------------------------------
// Root / lemma / word indexes (built once, on demand)
// ---------------------------------------------------------------------------

interface Indexes {
  /** normalised root -> occurrences */
  byRoot: Map<string, RootOccurrence[]>;
  /** canonical root spelling for a normalised key */
  rootDisplay: Map<string, string>;
  /** lemma -> verse keys */
  byLemma: Map<string, VerseKey[]>;
  /** normalised surface word -> verse indexes */
  byWord: Map<string, number[]>;
  /** normalised word -> total occurrences */
  wordCounts: Map<string, number>;
}

let indexes: Indexes | null = null;

function buildIndexes(): Indexes {
  const byRoot = new Map<string, RootOccurrence[]>();
  const rootDisplay = new Map<string, string>();
  const byLemma = new Map<string, VerseKey[]>();
  const byWord = new Map<string, number[]>();
  const wordCounts = new Map<string, number>();

  for (let i = 0; i < TOTAL_VERSES; i++) {
    const verse = buildVerse(i);
    const seenWords = new Set<string>();
    for (const w of verse.words) {
      if (w.root) {
        const key = normalizeRoot(w.root);
        if (!rootDisplay.has(key)) rootDisplay.set(key, w.root);
        let list = byRoot.get(key);
        if (!list) byRoot.set(key, (list = []));
        list.push({
          root: w.root,
          verseKey: verse.key,
          wordIndex: w.index,
          surface: w.surface,
          lemma: w.lemma,
          pos: w.pos,
          features: w.features,
        });
      }
      if (w.lemma) {
        let list = byLemma.get(w.lemma);
        if (!list) byLemma.set(w.lemma, (list = []));
        if (list[list.length - 1] !== verse.key) list.push(verse.key);
      }
      if (w.normalized) {
        wordCounts.set(w.normalized, (wordCounts.get(w.normalized) ?? 0) + 1);
        if (!seenWords.has(w.normalized)) {
          seenWords.add(w.normalized);
          let list = byWord.get(w.normalized);
          if (!list) byWord.set(w.normalized, (list = []));
          list.push(i);
        }
      }
    }
  }

  return { byRoot, rootDisplay, byLemma, byWord, wordCounts };
}

export function getIndexes(): Indexes {
  if (!indexes) indexes = buildIndexes();
  return indexes;
}

export function listRoots(): { root: string; count: number }[] {
  const { byRoot, rootDisplay } = getIndexes();
  const out: { root: string; count: number }[] = [];
  for (const [key, occurrences] of byRoot) {
    out.push({ root: rootDisplay.get(key) ?? key, count: occurrences.length });
  }
  return out.sort((a, b) => b.count - a.count);
}

export function getRootOccurrences(root: string): RootOccurrence[] {
  return getIndexes().byRoot.get(normalizeRoot(root)) ?? [];
}

export function rootExists(root: string): boolean {
  return getIndexes().byRoot.has(normalizeRoot(root));
}

export function getRootProfile(root: string): RootProfile | null {
  const key = normalizeRoot(root);
  const { byRoot, rootDisplay } = getIndexes();
  const occurrences = byRoot.get(key);
  if (!occurrences || occurrences.length === 0) return null;

  const lemmaCounts = new Map<string, number>();
  const formCounts = new Map<string, number>();
  const verseKeys = new Set<VerseKey>();
  const surahNumbers = new Set<number>();

  for (const o of occurrences) {
    if (o.lemma) lemmaCounts.set(o.lemma, (lemmaCounts.get(o.lemma) ?? 0) + 1);
    formCounts.set(o.surface, (formCounts.get(o.surface) ?? 0) + 1);
    verseKeys.add(o.verseKey);
    surahNumbers.add(Number(o.verseKey.split(':')[0]));
  }

  const sortByCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

  return {
    root: rootDisplay.get(key) ?? root,
    occurrenceCount: occurrences.length,
    verseCount: verseKeys.size,
    surahCount: surahNumbers.size,
    lemmas: Array.from(lemmaCounts, ([lemma, count]) => ({ lemma, count })).sort(sortByCount),
    forms: Array.from(formCounts, ([surface, count]) => ({ surface, count })).sort(sortByCount),
    occurrences,
  };
}

export function getWordOccurrenceCount(word: string): number {
  return getIndexes().wordCounts.get(normalizeArabic(word)) ?? 0;
}

export function getVersesContainingWord(word: string): QuranVerse[] {
  const list = getIndexes().byWord.get(normalizeArabic(word)) ?? [];
  return list.map(buildVerse);
}

export function getVersesForLemma(lemma: string): QuranVerse[] {
  const keys = getIndexes().byLemma.get(lemma) ?? [];
  return keys.map((k) => getVerseByKey(k)).filter(Boolean) as QuranVerse[];
}

/** Distinct verses (in mushaf order) in which a root occurs. */
export function getVersesForRoot(root: string): QuranVerse[] {
  const occurrences = getRootOccurrences(root);
  const seen = new Set<VerseKey>();
  const out: QuranVerse[] = [];
  for (const o of occurrences) {
    if (seen.has(o.verseKey)) continue;
    seen.add(o.verseKey);
    const v = getVerseByKey(o.verseKey);
    if (v) out.push(v);
  }
  return out;
}

/** Roots present in a word's verse neighbourhood, used for co-occurrence stats. */
export function getSurroundingText(verseKey: VerseKey, radius = 1): QuranVerse[] {
  const verse = getVerseByKey(verseKey);
  if (!verse) return [];
  const out: QuranVerse[] = [];
  for (let d = -radius; d <= radius; d++) {
    const v = getVerseByIndex(verse.index + d);
    if (v && v.surahNumber === verse.surahNumber) out.push(v);
  }
  return out;
}
