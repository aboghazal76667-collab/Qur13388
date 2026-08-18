/**
 * Term comparison engine — the machinery behind the "قارن" tab and behind the
 * non-synonymy mode.
 *
 * It reports distribution: where each term occurs, where they overlap, what
 * grammatical company each keeps. Distribution is evidence about usage. It is
 * not, by itself, proof that two words mean different things — two synonyms can
 * have different distributions, and one word can carry two senses.
 */

import type {
  ComparisonContrast,
  ComparisonResult,
  ConfidenceLevel,
  TermProfile,
} from '../types/analysis';
import type { QuranReference, QuranVerse, VerseKey } from '../types/quran';
import {
  getRootProfile,
  getSurah,
  getVerseByKey,
  getVersesForRoot,
  referenceFromVerse,
} from '../quran/repository';
import { rootsOfWord } from '../quran/search';
import { normalizeArabic, normalizeRoot } from '../quran/arabic';
import { analyzeWord } from './internalAnalysis';
import { featureLabel } from './grammar';

function buildTermProfile(term: string, explicitRoot?: string): TermProfile {
  const root = explicitRoot ? normalizeRoot(explicitRoot) : rootsOfWord(term)[0];
  const profile = root ? getRootProfile(root) : null;

  if (!profile) {
    return {
      term,
      root: undefined,
      occurrenceCount: 0,
      verseCount: 0,
      surahCount: 0,
      topSurahs: [],
      forms: [],
      coOccurringRoots: [],
      references: [],
    };
  }

  const verses = getVersesForRoot(root!);
  const surahCounts = new Map<number, number>();
  for (const o of profile.occurrences) {
    const s = Number(o.verseKey.split(':')[0]);
    surahCounts.set(s, (surahCounts.get(s) ?? 0) + 1);
  }

  // Roots that keep company with this one, excluding itself.
  const coRoots = new Map<string, number>();
  for (const verse of verses) {
    for (const r of verse.roots) {
      const key = normalizeRoot(r);
      if (key === root) continue;
      coRoots.set(key, (coRoots.get(key) ?? 0) + 1);
    }
  }

  return {
    term,
    root: profile.root,
    occurrenceCount: profile.occurrenceCount,
    verseCount: profile.verseCount,
    surahCount: profile.surahCount,
    topSurahs: Array.from(surahCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([surah, count]) => ({
        surah,
        nameArabic: getSurah(surah)?.nameArabic ?? String(surah),
        count,
      })),
    forms: profile.forms.slice(0, 24),
    coOccurringRoots: Array.from(coRoots.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([r, count]) => ({ root: r, count })),
    references: verses.slice(0, 200).map((v) => referenceFromVerse(v)),
  };
}

export interface CompareOptions {
  rootA?: string;
  rootB?: string;
  maxExamples?: number;
}

export function compareTerms(termA: string, termB: string, options: CompareOptions = {}): ComparisonResult {
  const profileA = buildTermProfile(termA, options.rootA);
  const profileB = buildTermProfile(termB, options.rootB);
  const max = options.maxExamples ?? 12;

  const keysA = new Set(profileA.references.map((r) => r.key));
  const keysB = new Set(profileB.references.map((r) => r.key));

  const sharedKeys: VerseKey[] = [];
  for (const key of keysA) if (keysB.has(key)) sharedKeys.push(key);

  const toRefs = (keys: VerseKey[], relevance: string, limit: number) =>
    keys
      .slice(0, limit)
      .map((k) => getVerseByKey(k))
      .filter(Boolean)
      .map((v) => referenceFromVerse(v as QuranVerse, relevance));

  const onlyAKeys = profileA.references.filter((r) => !keysB.has(r.key)).map((r) => r.key);
  const onlyBKeys = profileB.references.filter((r) => !keysA.has(r.key)).map((r) => r.key);

  const sharedVerses = toRefs(sharedKeys, 'يجتمع فيها اللفظان', max);
  const onlyA = toRefs(onlyAKeys, `${termA} دون ${termB}`, max);
  const onlyB = toRefs(onlyBKeys, `${termB} دون ${termA}`, max);

  const contrasts = buildContrasts(termA, termB, profileA, profileB, max);
  const verdict = buildVerdict(termA, termB, profileA, profileB, sharedKeys.length, contrasts);

  return {
    termA: profileA,
    termB: profileB,
    sharedVerses,
    onlyA,
    onlyB,
    sharedCount: sharedKeys.length,
    onlyACount: onlyAKeys.length,
    onlyBCount: onlyBKeys.length,
    contrasts,
    distributionalVerdict: verdict,
  };
}

function buildContrasts(
  termA: string,
  termB: string,
  a: TermProfile,
  b: TermProfile,
  max: number
): ComparisonContrast[] {
  const contrasts: ComparisonContrast[] = [];
  if (!a.root || !b.root) return contrasts;

  const analysisA = analyzeWord(termA, { root: a.root, maxContexts: 300 });
  const analysisB = analyzeWord(termB, { root: b.root, maxContexts: 300 });

  // 1. Grammatical company
  const featsA = new Map(analysisA.grammarProfile.map((g) => [g.feature, g.count]));
  const featsB = new Map(analysisB.grammarProfile.map((g) => [g.feature, g.count]));
  const distinctive: string[] = [];
  for (const [feature, count] of featsA) {
    const other = featsB.get(feature) ?? 0;
    if (count >= 5 && other === 0) distinctive.push(`${featureLabel(feature)} (خاص بـ${termA})`);
  }
  for (const [feature, count] of featsB) {
    const other = featsA.get(feature) ?? 0;
    if (count >= 5 && other === 0) distinctive.push(`${featureLabel(feature)} (خاص بـ${termB})`);
  }
  if (distinctive.length > 0) {
    contrasts.push({
      label: 'خصائص صرفية/نحوية غير مشتركة',
      detail: distinctive.slice(0, 8).join('، '),
      aExamples: a.references.slice(0, 3),
      bExamples: b.references.slice(0, 3),
    });
  }

  // 2. Particles each term attracts
  const prepA = new Set(analysisA.prepositionProfile.filter((p) => p.count >= 3).map((p) => p.particle));
  const prepB = new Set(analysisB.prepositionProfile.filter((p) => p.count >= 3).map((p) => p.particle));
  const onlyPrepA = Array.from(prepA).filter((p) => !prepB.has(p));
  const onlyPrepB = Array.from(prepB).filter((p) => !prepA.has(p));
  if (onlyPrepA.length > 0 || onlyPrepB.length > 0) {
    contrasts.push({
      label: 'حروف الجر المصاحبة',
      detail:
        (onlyPrepA.length ? `يختص «${termA}» بـ: ${onlyPrepA.join('، ')}. ` : '') +
        (onlyPrepB.length ? `ويختص «${termB}» بـ: ${onlyPrepB.join('، ')}.` : ''),
      aExamples: a.references.slice(0, 3),
      bExamples: b.references.slice(0, 3),
    });
  }

  // 3. Lexical neighbourhood
  const coA = new Map(a.coOccurringRoots.map((c) => [c.root, c.count]));
  const coB = new Map(b.coOccurringRoots.map((c) => [c.root, c.count]));
  const uniqueA = a.coOccurringRoots.filter((c) => !coB.has(c.root)).slice(0, 5);
  const uniqueB = b.coOccurringRoots.filter((c) => !coA.has(c.root)).slice(0, 5);
  if (uniqueA.length > 0 || uniqueB.length > 0) {
    contrasts.push({
      label: 'الحقل المعجمي المجاور',
      detail:
        `الجذور التي تصاحب «${termA}» ولا تصاحب «${termB}»: ${uniqueA.map((c) => c.root).join('، ') || '—'}. ` +
        `وبالعكس: ${uniqueB.map((c) => c.root).join('، ') || '—'}.`,
      aExamples: a.references.slice(0, 3),
      bExamples: b.references.slice(0, 3),
    });
  }

  // 4. Surah distribution
  const topA = a.topSurahs.slice(0, 3).map((s) => s.nameArabic).join('، ');
  const topB = b.topSurahs.slice(0, 3).map((s) => s.nameArabic).join('، ');
  if (topA && topB && topA !== topB) {
    contrasts.push({
      label: 'التوزّع على السور',
      detail: `«${termA}» أكثر ورودًا في: ${topA}. «${termB}» أكثر ورودًا في: ${topB}.`,
      aExamples: a.references.slice(0, 3),
      bExamples: b.references.slice(0, 3),
    });
  }

  return contrasts.slice(0, max);
}

function buildVerdict(
  termA: string,
  termB: string,
  a: TermProfile,
  b: TermProfile,
  sharedCount: number,
  contrasts: ComparisonContrast[]
): ComparisonResult['distributionalVerdict'] {
  if (a.occurrenceCount === 0 || b.occurrenceCount === 0) {
    const missing = a.occurrenceCount === 0 ? termA : termB;
    return {
      summary: `لم يُعثر على «${missing}» في المصحف بهذه الصورة، فلا يمكن بناء مقارنة توزيعية.`,
      supportsDistinction: [],
      weakensDistinction: [],
      confidence: 'undetermined',
    };
  }

  const supports: string[] = [];
  const weakens: string[] = [];

  const overlapRatio = sharedCount / Math.min(a.verseCount, b.verseCount);

  if (overlapRatio < 0.1) {
    supports.push(
      `التقاطع بين اللفظين ضعيف: يجتمعان في ${sharedCount} آية فقط من أصل ` +
        `${a.verseCount} و${b.verseCount}، أي أن السياقات متمايزة إلى حد بعيد.`
    );
  } else if (overlapRatio > 0.4) {
    weakens.push(
      `التقاطع كبير: يجتمعان في ${sharedCount} آية، وهي نسبة عالية قياسًا إلى ` +
        'مجموع مواضعهما، مما يجعل افتراض التمايز التام أصعب.'
    );
  }

  if (sharedCount > 0) {
    supports.push(
      `اجتماع اللفظين في ${sharedCount} آية داخل السياق نفسه يستحق الفحص: ` +
        'العطف بين لفظين في جملة واحدة يُستدل به عادةً على تغايرهما، وإن كان لا يلزم ذلك دائمًا.'
    );
  }

  for (const c of contrasts.slice(0, 3)) {
    supports.push(`${c.label}: ${c.detail}`);
  }

  const ratio = a.occurrenceCount / Math.max(1, b.occurrenceCount);
  if (ratio > 4 || ratio < 0.25) {
    weakens.push(
      `الفارق الكبير في التكرار (${a.occurrenceCount} مقابل ${b.occurrenceCount}) قد يفسّر ` +
        'جزءًا من اختلاف التوزيع دون الحاجة إلى افتراض فرق دلالي.'
    );
  }

  weakens.push(
    'التوزيع اللغوي في ذاته لا يحسم الدلالة: قد يختلف موضع اللفظين لأسباب أسلوبية أو إيقاعية ' +
      'أو لاختلاف المخاطَب، لا لاختلاف المعنى.'
  );

  let confidence: ConfidenceLevel = 'medium';
  if (supports.length >= 4 && overlapRatio < 0.15) confidence = 'high';
  else if (supports.length <= 1) confidence = 'low';

  return {
    summary:
      `يرد «${termA}» في ${a.occurrenceCount} موضعًا ضمن ${a.verseCount} آية، ` +
      `و«${termB}» في ${b.occurrenceCount} موضعًا ضمن ${b.verseCount} آية، ` +
      `ويجتمعان في ${sharedCount} آية. ` +
      'ما يلي وصف لتوزيع الاستعمال، وليس حكمًا على المعنى.',
    supportsDistinction: supports,
    weakensDistinction: weakens,
    confidence,
  };
}

export function normalizedTerm(term: string): string {
  return normalizeArabic(term);
}

/** Shared-verse lookup used by the knowledge graph builder. */
export function sharedVerseKeys(termA: string, termB: string): VerseKey[] {
  const a = new Set(getVersesForRoot(rootsOfWord(termA)[0] ?? '').map((v) => v.key));
  return getVersesForRoot(rootsOfWord(termB)[0] ?? '')
    .map((v) => v.key)
    .filter((k) => a.has(k));
}

export type { QuranReference };
