/**
 * Quran Retrieval Engine.
 *
 * Four retrieval modes, all deterministic and running on-device:
 *   exact       - the string as written, diacritics included
 *   normalized  - diacritics/hamza/tatweel-insensitive substring match
 *   root        - every word whose morphological root matches
 *   semantic    - concept expansion over curated roots + co-occurrence
 *
 * A root match tells you WHERE to look. It never tells you what a word means:
 * words sharing a root routinely diverge in sense, so the caller must go on to
 * inspect context (see QuranInternalAnalysisEngine).
 */

import type { QuranVerse, SearchHit, SearchMode, VerseKey } from '../types/quran';
import {
  TOTAL_VERSES,
  forEachVerse,
  getIndexes,
  getVerseByIndex,
  getVerseByKey,
  getVersesForRoot,
  rootExists,
} from './repository';
import {
  collapseAlif,
  extractContentWords,
  looseStem,
  normalizeArabic,
  normalizeRoot,
  parseRootInput,
} from './arabic';

export interface SearchOptions {
  limit?: number;
  /** Restrict to a single surah. */
  surah?: number;
}

const DEFAULT_LIMIT = 60;

// ---------------------------------------------------------------------------
// Exact
// ---------------------------------------------------------------------------

export function exactSearch(query: string, options: SearchOptions = {}): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const limit = options.limit ?? DEFAULT_LIMIT;
  const hits: SearchHit[] = [];

  forEachVerse((verse) => {
    if (hits.length >= limit) return;
    if (options.surah && verse.surahNumber !== options.surah) return;
    if (!verse.uthmaniText.includes(q)) return;
    const matched = verse.words.filter((w) => w.surface.includes(q)).map((w) => w.index);
    hits.push({
      verse,
      mode: 'exact',
      score: 1,
      matchedWordIndexes: matched,
      reason: `تطابق حرفي تام مع "${q}"`,
    });
  });

  return hits;
}

// ---------------------------------------------------------------------------
// Normalized
// ---------------------------------------------------------------------------

export function normalizedSearch(query: string, options: SearchOptions = {}): SearchHit[] {
  const q = normalizeArabic(query);
  if (!q) return [];

  const direct = runNormalizedPass(q, false, options);
  if (direct.length > 0) return direct;

  // Nothing matched on the faithful key. A handful of words carry an alif in
  // the mushaf that ordinary typing omits (الرحمان/الرحمن, هاذا/هذا,
  // اولاءك/اولئك), so retry with both sides alif-collapsed before giving up.
  return runNormalizedPass(collapseAlif(q), true, options);
}

function runNormalizedPass(needle: string, collapsed: boolean, options: SearchOptions): SearchHit[] {
  if (!needle) return [];
  const limit = options.limit ?? DEFAULT_LIMIT;
  const hits: SearchHit[] = [];
  const key = (value: string) => (collapsed ? collapseAlif(value) : value);
  // A multi-word query is a phrase and has to be matched against the whole
  // verse; matching it word by word could never succeed.
  const isPhrase = needle.includes(' ');

  forEachVerse((verse) => {
    if (hits.length >= limit) return;
    if (options.surah && verse.surahNumber !== options.surah) return;

    if (isPhrase) {
      if (!key(verse.normalizedText).includes(needle)) return;
      hits.push({
        verse,
        mode: 'normalized',
        score: 0.9,
        matchedWordIndexes: [],
        reason: `الآية تحتوي على العبارة "${needle}"`,
      });
      return;
    }

    const matched = verse.words.filter((w) => key(w.normalized).includes(needle)).map((w) => w.index);
    if (matched.length === 0) return;
    const whole = verse.words.some((w) => key(w.normalized) === needle);

    hits.push({
      verse,
      mode: 'normalized',
      score: whole ? 1 : 0.75,
      matchedWordIndexes: matched,
      reason: whole
        ? `الكلمة "${needle}" ترد في الآية`
        : `الآية تحتوي على "${needle}" ضمن كلمة أطول`,
    });
  });

  return hits;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function rootSearch(rootInput: string, options: SearchOptions = {}): SearchHit[] {
  const root = parseRootInput(rootInput);
  if (!root || !rootExists(root)) return [];
  const limit = options.limit ?? 200;
  const occurrences = getIndexes().byRoot.get(root) ?? [];

  const byVerse = new Map<VerseKey, number[]>();
  for (const o of occurrences) {
    const list = byVerse.get(o.verseKey);
    if (list) list.push(o.wordIndex);
    else byVerse.set(o.verseKey, [o.wordIndex]);
  }

  const hits: SearchHit[] = [];
  for (const [key, wordIndexes] of byVerse) {
    if (hits.length >= limit) break;
    const verse = getVerseByKey(key);
    if (!verse) continue;
    if (options.surah && verse.surahNumber !== options.surah) continue;
    hits.push({
      verse,
      mode: 'root',
      score: 1,
      matchedWordIndexes: wordIndexes,
      reason: `يشترك في الجذر (${root.split('').join(' ')}) — الاشتراك في الجذر لا يعني اتحاد المعنى`,
    });
  }
  return hits.sort((a, b) => a.verse.index - b.verse.index);
}

// ---------------------------------------------------------------------------
// Semantic (concept expansion, no embeddings required)
// ---------------------------------------------------------------------------

export interface SemanticSeed {
  /** Roots that carry the concept. */
  roots: string[];
  /** Additional surface terms. */
  terms: string[];
}

/**
 * Concept-level retrieval: score verses by how many seed roots/terms they
 * carry, weighted so that rarer signals count for more. Deliberately simple —
 * the `SemanticIndex` interface below is where a real embedding backend plugs
 * in later without any UI change.
 */
export function semanticSearch(seed: SemanticSeed, options: SearchOptions = {}): SearchHit[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const roots = seed.roots.map(parseRootInput).filter((r) => r && rootExists(r));
  const terms = seed.terms.map(normalizeArabic).filter(Boolean);
  if (roots.length === 0 && terms.length === 0) return [];

  const { byRoot, byWord } = getIndexes();

  // Inverse-frequency weights: a root occurring 12 times is more telling than
  // one occurring 900 times.
  const weights = new Map<string, number>();
  for (const r of roots) {
    const n = byRoot.get(r)?.length ?? 1;
    weights.set(`r:${r}`, Math.log(1 + TOTAL_VERSES / Math.max(1, n)));
  }
  for (const t of terms) {
    const n = byWord.get(t)?.length ?? 1;
    weights.set(`t:${t}`, Math.log(1 + TOTAL_VERSES / Math.max(1, n)));
  }

  const scores = new Map<VerseKey, { score: number; signals: string[]; words: number[] }>();

  const bump = (key: VerseKey, weight: number, signal: string, wordIndex: number) => {
    let entry = scores.get(key);
    if (!entry) scores.set(key, (entry = { score: 0, signals: [], words: [] }));
    entry.score += weight;
    if (!entry.signals.includes(signal)) entry.signals.push(signal);
    if (!entry.words.includes(wordIndex)) entry.words.push(wordIndex);
  };

  for (const r of roots) {
    const weight = weights.get(`r:${r}`) ?? 1;
    for (const o of byRoot.get(r) ?? []) {
      bump(o.verseKey, weight, `الجذر ${r.split('').join(' ')}`, o.wordIndex);
    }
  }
  for (const t of terms) {
    const weight = weights.get(`t:${t}`) ?? 1;
    for (const flatIndex of byWord.get(t) ?? []) {
      const v = getVerseByIndex(flatIndex);
      if (!v) continue;
      const wi = v.words.find((w) => w.normalized.includes(t))?.index ?? 0;
      bump(v.key, weight, `اللفظ ${t}`, wi);
    }
  }

  const hits: SearchHit[] = [];
  for (const [key, entry] of scores) {
    const verse = getVerseByKey(key);
    if (!verse) continue;
    if (options.surah && verse.surahNumber !== options.surah) continue;
    // Verses hitting more than one distinct signal are far more likely on-topic.
    const bonus = 1 + (entry.signals.length - 1) * 0.35;
    hits.push({
      verse,
      mode: 'semantic',
      score: entry.score * bonus,
      matchedWordIndexes: entry.words,
      reason: `مرتبطة بالمفهوم عبر: ${entry.signals.join('، ')}`,
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Unified entry point
// ---------------------------------------------------------------------------

/**
 * Free-text search that picks sensible modes automatically: root notation
 * ("ح ج ب") goes to root search, everything else runs exact + normalized and,
 * when the term resolves to a root in the corpus, root search too.
 */
export function search(query: string, options: SearchOptions = {}): SearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const looksLikeRoot = /^[ء-ي](\s+[ء-ي]){1,3}$/.test(q);
  if (looksLikeRoot) return rootSearch(q, options);

  const merged = new Map<VerseKey, SearchHit>();
  const add = (hit: SearchHit) => {
    const existing = merged.get(hit.verse.key);
    if (!existing || hit.score > existing.score) merged.set(hit.verse.key, hit);
  };

  for (const hit of normalizedSearch(q, { ...options, limit: 400 })) add(hit);

  // A single content word: also pull in the whole root family.
  const words = extractContentWords(q);
  if (words.length === 1) {
    const rootsForWord = rootsOfWord(words[0]);
    for (const root of rootsForWord) {
      for (const hit of rootSearch(root, { ...options, limit: 400 })) add(hit);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score || a.verse.index - b.verse.index)
    .slice(0, options.limit ?? DEFAULT_LIMIT);
}

/**
 * Roots attested for a surface word, taken from the morphology dataset rather
 * than guessed. Falls back to a loose stem match only when the exact form is
 * absent from the corpus.
 */
const rootsOfWordCache = new Map<string, string[]>();

export function rootsOfWord(word: string): string[] {
  const normalized = normalizeArabic(word);
  if (!normalized) return [];
  const cached = rootsOfWordCache.get(normalized);
  if (cached) return cached;
  const counts = new Map<string, number>();

  const scan = (predicate: (n: string) => boolean) => {
    forEachVerse((verse) => {
      for (const w of verse.words) {
        if (!w.root) continue;
        if (predicate(w.normalized)) {
          const key = normalizeRoot(w.root);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    });
  };

  scan((n) => n === normalized);
  if (counts.size === 0) {
    // Same alif fallback as normalizedSearch, before the much looser stem pass.
    const collapsed = collapseAlif(normalized);
    if (collapsed !== normalized) scan((n) => collapseAlif(n) === collapsed);
  }
  if (counts.size === 0) {
    const stem = looseStem(normalized);
    if (stem.length >= 3) scan((n) => n.includes(stem));
  }

  const result = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([root]) => root);
  rootsOfWordCache.set(normalized, result);
  return result;
}

/** Verses where two roots both appear — the backbone of the compare screen. */
export function versesWithBothRoots(rootA: string, rootB: string): QuranVerse[] {
  const a = new Set(getVersesForRoot(rootA).map((v) => v.key));
  return getVersesForRoot(rootB).filter((v) => a.has(v.key));
}

// ---------------------------------------------------------------------------
// Future backend seam
// ---------------------------------------------------------------------------

/**
 * Implemented on-device today by `semanticSearch`. A Qdrant/pgvector backed
 * implementation can be dropped in behind this interface without touching any
 * screen.
 */
export interface SemanticIndex {
  query(text: string, limit: number): Promise<SearchHit[]>;
}

export const localSemanticIndex: SemanticIndex = {
  async query(text: string, limit: number) {
    const words = extractContentWords(text);
    const roots = words.flatMap((w) => rootsOfWord(w));
    return semanticSearch({ roots, terms: words }, { limit });
  },
};
