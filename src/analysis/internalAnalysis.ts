/**
 * QuranInternalAnalysisEngine
 *
 * Compares how one and the same word/root is used across the whole Quran, using
 * only what is countable in the text: surrounding words, attached particles,
 * grammatical form, subject/object shape, and position.
 *
 * Its output is deliberately of one kind only — LINGUISTIC OBSERVATION. It
 * never states what a word means. Distinguishing "the text uses X with the
 * particle بـ in 14 places" from "therefore X means Y" is the whole point of
 * the separation this app is built around.
 */

import type {
  UsagePattern,
  WordAnalysis,
  WordUsageContext,
} from '../types/analysis';
import type { QuranReference, QuranVerse, QuranWord, VerseKey } from '../types/quran';
import {
  getRootProfile,
  getVerseByKey,
  getVersesContainingWord,
  referenceFromVerse,
} from '../quran/repository';
import { normalizeArabic, normalizeRoot } from '../quran/arabic';
import { rootsOfWord } from '../quran/search';
import { PREPOSITIONS, PREPOSITION_SURFACES, caseOf, featureLabel, numberOf, tenseOf } from './grammar';

const CONTEXT_RADIUS = 3;

/** Particle attached as a prefix to the following word, e.g. بِالحقّ. */
function attachedParticle(word: QuranWord): string | undefined {
  const n = word.normalized;
  if (n.length < 3) return undefined;
  for (const p of ['ب', 'ل', 'ك']) {
    if (n.startsWith(p) && word.features.includes('P')) return p;
  }
  return undefined;
}

/** The nearest preceding preposition, which is what actually governs the word. */
function governingPreposition(verse: QuranVerse, wordIndex: number): string | undefined {
  for (let i = wordIndex; i >= Math.max(0, wordIndex - 2); i--) {
    const w = verse.words[i];
    if (!w) continue;
    const n = normalizeArabic(w.surface);
    if (i !== wordIndex && PREPOSITIONS.includes(n)) return n;
    const attached = attachedParticle(w);
    if (attached) return attached;
  }
  // A preposition may also directly follow, e.g. ضرب في الأرض.
  const next = verse.words[wordIndex + 1];
  if (next && PREPOSITIONS.includes(next.normalized)) return next.normalized;
  return undefined;
}

function buildContext(verse: QuranVerse, wordIndex: number): WordUsageContext {
  const word = verse.words[wordIndex];
  const before = verse.words
    .slice(Math.max(0, wordIndex - CONTEXT_RADIUS), wordIndex)
    .map((w) => w.surface);
  const after = verse.words
    .slice(wordIndex + 1, wordIndex + 1 + CONTEXT_RADIUS)
    .map((w) => w.surface);

  return {
    verseKey: verse.key,
    surface: word.surface,
    before,
    after,
    preposition: governingPreposition(verse, wordIndex),
    features: word.features,
    pos: word.pos,
  };
}

// ---------------------------------------------------------------------------
// Usage clustering
// ---------------------------------------------------------------------------

/**
 * Group occurrences into usage buckets. The signals used are structural, not
 * semantic: which particle governs the word, whether it is a verb or a noun,
 * whether it is definite, singular or plural.
 *
 * Two occurrences landing in the same bucket does NOT establish that they mean
 * the same thing; it establishes that the text deploys them the same way. That
 * is a much weaker — and much more defensible — claim.
 */
function clusterUsages(contexts: WordUsageContext[]): UsagePattern[] {
  const buckets = new Map<string, { label: string; signals: string[]; keys: VerseKey[] }>();

  for (const ctx of contexts) {
    const signals: string[] = [];
    let label: string;

    const tense = tenseOf(ctx.features);
    if (ctx.pos === 'V') {
      const t = tense ? featureLabel(tense) : 'فعل';
      if (ctx.preposition) {
        const prep = PREPOSITION_SURFACES[ctx.preposition] ?? ctx.preposition;
        label = `${t} + ${prep}`;
        signals.push(`تعدّى بحرف ${prep}`, t);
      } else {
        label = `${t} بلا حرف جر`;
        signals.push('متعدٍّ بنفسه أو لازم', t);
      }
    } else if (ctx.pos === 'N') {
      const num = numberOf(ctx.features);
      const grammaticalCase = caseOf(ctx.features);
      const parts = ['اسم'];
      if (num) parts.push(featureLabel(num));
      if (ctx.preposition) {
        const prep = PREPOSITION_SURFACES[ctx.preposition] ?? ctx.preposition;
        parts.push(`مسبوق بـ${prep}`);
        signals.push(`سبقه حرف ${prep}`);
      }
      if (grammaticalCase) signals.push(featureLabel(grammaticalCase));
      if (num) signals.push(featureLabel(num));
      label = parts.join(' — ');
    } else {
      label = 'استعمال حرفي/أداة';
      signals.push('أداة');
    }

    let bucket = buckets.get(label);
    if (!bucket) buckets.set(label, (bucket = { label, signals, keys: [] }));
    for (const s of signals) if (!bucket.signals.includes(s)) bucket.signals.push(s);
    if (!bucket.keys.includes(ctx.verseKey)) bucket.keys.push(ctx.verseKey);
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.keys.length - a.keys.length)
    .map((b, i) => ({
      id: `usage-${i}`,
      label: b.label,
      description:
        `يرد هذا الاستعمال في ${b.keys.length} موضعًا. ` +
        'هذا تصنيف بنيوي (نحوي) لا دلالي: تشابه البنية لا يثبت وحدة المعنى، ' +
        'واختلافها لا يثبت اختلافه.',
      verseKeys: b.keys,
      sampleReferences: b.keys
        .slice(0, 4)
        .map((k) => getVerseByKey(k))
        .filter(Boolean)
        .map((v) => referenceFromVerse(v as QuranVerse)),
      signals: b.signals,
    }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AnalyzeWordOptions {
  /** Force a specific root instead of resolving it from the surface form. */
  root?: string;
  /** Cap on contexts kept in the result, to keep payloads small. */
  maxContexts?: number;
}

/**
 * Full intra-Quran profile of a word: where it occurs, in what forms, governed
 * by what particles, and how those occurrences cluster.
 */
export function analyzeWord(word: string, options: AnalyzeWordOptions = {}): WordAnalysis {
  const normalized = normalizeArabic(word);
  const root = options.root ? normalizeRoot(options.root) : rootsOfWord(normalized)[0];
  const profile = root ? getRootProfile(root) : null;

  const contexts: WordUsageContext[] = [];
  const verseKeys = new Set<VerseKey>();
  const maxContexts = options.maxContexts ?? 400;

  if (profile) {
    for (const occurrence of profile.occurrences) {
      if (contexts.length >= maxContexts) break;
      const verse = getVerseByKey(occurrence.verseKey);
      if (!verse) continue;
      contexts.push(buildContext(verse, occurrence.wordIndex));
      verseKeys.add(verse.key);
    }
  } else {
    // No morphological root available: fall back to exact surface occurrences.
    for (const verse of getVersesContainingWord(normalized)) {
      if (contexts.length >= maxContexts) break;
      for (const w of verse.words) {
        if (w.normalized !== normalized) continue;
        contexts.push(buildContext(verse, w.index));
        verseKeys.add(verse.key);
      }
    }
  }

  // Preposition profile
  const prepCounts = new Map<string, { count: number; keys: VerseKey[] }>();
  for (const ctx of contexts) {
    if (!ctx.preposition) continue;
    let entry = prepCounts.get(ctx.preposition);
    if (!entry) prepCounts.set(ctx.preposition, (entry = { count: 0, keys: [] }));
    entry.count++;
    if (!entry.keys.includes(ctx.verseKey)) entry.keys.push(ctx.verseKey);
  }

  // Grammar profile
  const featureCounts = new Map<string, number>();
  for (const ctx of contexts) {
    for (const f of ctx.features) {
      if (f.startsWith('FAM:')) continue;
      featureCounts.set(f, (featureCounts.get(f) ?? 0) + 1);
    }
  }

  const patterns = clusterUsages(contexts);
  for (const ctx of contexts) {
    ctx.usageGroup = patterns.find((p) => p.verseKeys.includes(ctx.verseKey))?.label;
  }

  return {
    word,
    normalized,
    root: profile?.root ?? root,
    lemma: profile?.lemmas[0]?.lemma,
    occurrenceCount: profile ? profile.occurrenceCount : contexts.length,
    verseCount: profile ? profile.verseCount : verseKeys.size,
    distinctForms: profile ? profile.forms.slice(0, 30) : distinctForms(contexts),
    lemmaBreakdown: profile ? profile.lemmas.slice(0, 20) : [],
    contexts,
    usagePatterns: patterns,
    prepositionProfile: Array.from(prepCounts.entries())
      .map(([particle, v]) => ({
        particle: PREPOSITION_SURFACES[particle] ?? particle,
        count: v.count,
        verseKeys: v.keys,
      }))
      .sort((a, b) => b.count - a.count),
    grammarProfile: Array.from(featureCounts.entries())
      .map(([feature, count]) => ({ feature, label: featureLabel(feature), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 18),
  };
}

function distinctForms(contexts: WordUsageContext[]): { surface: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of contexts) counts.set(c.surface, (counts.get(c.surface) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([surface, count]) => ({ surface, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Verdict on whether the corpus itself shows one sense or several — phrased as
 * an observation about spread, with the reasoning shown so the user can
 * disagree with it.
 */
export function describeSenseSpread(analysis: WordAnalysis): {
  headline: string;
  detail: string;
  singleSenseLikely: boolean;
} {
  const patterns = analysis.usagePatterns;
  const total = analysis.occurrenceCount;
  const dominant = patterns[0];
  const dominantShare = dominant && total ? dominant.verseKeys.length / total : 0;

  if (patterns.length <= 1) {
    return {
      headline: 'نمط استعمال واحد',
      detail:
        'كل المواضع تقع في نمط بنيوي واحد. هذا يرجّح — ولا يثبت — استقرار الاستعمال، ' +
        'لأن وحدة البنية النحوية لا تستلزم وحدة المعنى.',
      singleSenseLikely: true,
    };
  }

  if (dominantShare > 0.7) {
    return {
      headline: 'نمط غالب مع استعمالات هامشية',
      detail:
        `النمط الغالب «${dominant.label}» يغطي نحو ${Math.round(dominantShare * 100)}% من المواضع، ` +
        `وتبقى ${patterns.length - 1} أنماط أخرى أقل تكرارًا تستحق الفحص المستقل قبل تعميم المعنى.`,
      singleSenseLikely: false,
    };
  }

  return {
    headline: 'استعمالات متعددة متوازنة',
    detail:
      `ترد الكلمة في ${patterns.length} أنماط بنيوية مختلفة دون هيمنة واضحة لأحدها. ` +
      'تعدد الأنماط يرفع احتمال تعدد المعاني، لكنه لا يثبته: قد يحمل نمطان مختلفان معنى واحدًا.',
    singleSenseLikely: false,
  };
}

/** Verses in which two words appear together — used for co-occurrence claims. */
export function coOccurrences(analysisA: WordAnalysis, analysisB: WordAnalysis): QuranReference[] {
  const keysB = new Set(analysisB.contexts.map((c) => c.verseKey));
  const shared: QuranReference[] = [];
  const seen = new Set<VerseKey>();
  for (const c of analysisA.contexts) {
    if (!keysB.has(c.verseKey) || seen.has(c.verseKey)) continue;
    seen.add(c.verseKey);
    const verse = getVerseByKey(c.verseKey);
    if (verse) shared.push(referenceFromVerse(verse, 'ترد فيها الكلمتان معًا'));
  }
  return shared;
}
