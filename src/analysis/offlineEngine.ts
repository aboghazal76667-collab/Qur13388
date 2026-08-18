/**
 * On-device analysis pipeline.
 *
 * Runs the full sequence — question analysis, retrieval, lexical and contextual
 * analysis, argument construction, assumption detection, counterargument,
 * evidence grading, confidence — with no network call and no language model.
 *
 * Two reasons this exists rather than being a stub:
 *   1. The app is fully usable before any API key is configured.
 *   2. It fixes the boundary. Everything here is computed from the corpus, so
 *      when the AI backend is enabled it can only ADD synthesis on top — it can
 *      never overwrite a count, a citation, or a thinker record.
 */

import type {
  AnalysisResult,
  AnalysisSection,
  ConfidenceLevel,
  ThinkerPerspectiveEntry,
  WordAnalysis,
} from '../types/analysis';
import type { QuranReference } from '../types/quran';
import { analyzeQuestion } from './questionAnalyzer';
import { analyzeWord, describeSenseSpread } from './internalAnalysis';
import { buildArgument, detectAssumptions } from './argument';
import { buildCounterArgument } from './counterArgument';
import { testRelevantPairs } from './nonSynonymy';
import { semanticSearch } from '../quran/search';
import { getRootProfile, referenceFromVerse } from '../quran/repository';
import { lightNormalize, normalizeArabic, normalizeRoot } from '../quran/arabic';
import { THINKERS, NO_DATA_MESSAGE, claimsForTopic } from '../knowledge/thinkers';
import { CONCEPT_BY_ID } from '../knowledge/concepts';

export const QURAN_ONLY_NOTICE =
  'هذا التحليل لا يستخدم الحديث أو المذاهب الفقهية كمصادر إثبات.';

export interface OfflineAnalysisOptions {
  /** Cap on words profiled in depth; each costs a corpus pass. */
  maxWords?: number;
  maxVerses?: number;
}

export function runOfflineAnalysis(
  question: string,
  options: OfflineAnalysisOptions = {}
): AnalysisResult {
  const maxWords = options.maxWords ?? 3;
  const maxVerses = options.maxVerses ?? 8;

  // STEP 1 — decompose the question
  const questionAnalysis = analyzeQuestion(question);

  // STEP 2 — retrieve
  const hits = semanticSearch(
    { roots: questionAnalysis.candidateRoots, terms: questionAnalysis.quranicTerms },
    { limit: maxVerses * 3 }
  );
  const centralVerses: QuranReference[] = hits
    .slice(0, maxVerses)
    .map((h) => referenceFromVerse(h.verse, h.reason));

  // STEP 3 — lexical + contextual analysis of the leading terms
  const wordTargets = pickWordTargets(questionAnalysis.quranicTerms, questionAnalysis.candidateRoots, maxWords);
  const wordAnalyses: WordAnalysis[] = wordTargets
    .map((t) => analyzeWord(t.term, { root: t.root, maxContexts: 250 }))
    .filter((w) => w.occurrenceCount > 0);

  // STEP 4/5 — structural sections + non-synonymy tests
  const quranicAnalysis = buildSections(wordAnalyses, questionAnalysis.relatedConcepts);
  const nonSynonymyNotes = testRelevantPairs(questionAnalysis.quranicTerms, 2);

  // STEP 7/8 — arguments with graded directness
  const args = wordAnalyses.slice(0, 2).map((analysis) => {
    const spread = describeSenseSpread(analysis);
    const dominant = analysis.usagePatterns[0];
    const evidence = (dominant?.sampleReferences ?? []).slice(0, 4);

    const premises = [
      `يرد الجذر (${(analysis.root ?? analysis.normalized).split('').join(' ')}) في ${analysis.occurrenceCount} موضعًا ضمن ${analysis.verseCount} آية.`,
      dominant
        ? `النمط البنيوي الأكثر ورودًا هو «${dominant.label}» في ${dominant.verseKeys.length} موضعًا.`
        : 'لم يُرصد نمط بنيوي غالب.',
      analysis.prepositionProfile.length > 0
        ? `أكثر حروف الجر مصاحبةً: ${analysis.prepositionProfile.slice(0, 3).map((p) => `${p.particle} (${p.count})`).join('، ')}.`
        : 'لا يغلب على اللفظ حرف جر بعينه.',
    ];

    const assumptions = [
      'الانتقال من «تكرار نمط بنيوي» إلى «وحدة المعنى» خطوة تحتاج إلى تسويغ، وليست لازمة عن الإحصاء وحده.',
    ];

    const detected = detectAssumptions(spread.headline, premises, evidence, normalizeArabic);
    for (const d of detected) assumptions.push(d.reason);

    return buildArgument({
      conclusion: `الاستعمال القرآني للفظ «${analysis.word}»: ${spread.headline}. ${spread.detail}`,
      premises,
      quranEvidence: evidence,
      assumptions,
      alternativeInterpretations: analysis.usagePatterns
        .slice(1, 4)
        .map((p) => `قراءة تجعل النمط «${p.label}» (${p.verseKeys.length} موضعًا) هو الأصل بدل النمط الغالب.`),
      confidence: spread.singleSenseLikely ? 'medium' : 'low',
    });
  });

  // STEP 9 — self-attack
  const primary = wordAnalyses[0];
  const strongestCounterArgument = primary ? buildCounterArgument(primary) : null;

  // STEP 6 — thinker records (local database only, never generated)
  const thinkerPerspectives = buildThinkerPerspectives(questionAnalysis.relatedConcepts);

  // STEP 10 — confidence, with the reason stated
  const confidence = deriveConfidence(wordAnalyses, centralVerses.length);

  const summary = buildSummary(question, wordAnalyses, centralVerses.length);

  return {
    id: `offline-${Date.now().toString(36)}`,
    question,
    createdAt: new Date().toISOString(),
    mode: 'quran-only',
    engine: 'offline',
    summary,
    questionAnalysis,
    centralVerses,
    quranicAnalysis,
    wordAnalyses,
    arguments: args,
    leadingView: primary
      ? {
          statement: describeSenseSpread(primary).headline,
          rationale: describeSenseSpread(primary).detail,
          directness: args[0]?.directness ?? 'C',
        }
      : null,
    strongestCounterArgument,
    nonSynonymyNotes,
    thinkerPerspectives,
    confidence,
    rejectedReferences: [],
    notices: [
      'هذا تحليل محلي بُني من إحصاء النص القرآني ومورفولوجيته دون استخدام نموذج لغوي. ' +
        'يعطي وقائع لغوية دقيقة، ولا يقدّم صياغة تفسيرية موسّعة.',
    ],
  };
}

/**
 * Choose which words to profile in depth.
 *
 * Each target's label is derived FROM its own root — the root's most frequent
 * surface form in the corpus — rather than being paired positionally with a
 * term from the question. Pairing by position produced mislabelled output, e.g.
 * the word «صلاتهم» presented under the root ق و م.
 *
 * A question word whose own spelling appears in the corpus keeps that spelling
 * as its label, since that is what the reader typed.
 */
function pickWordTargets(
  terms: string[],
  roots: string[],
  limit: number
): { term: string; root?: string }[] {
  const out: { term: string; root?: string }[] = [];
  const seenRoots = new Set<string>();

  for (const root of roots) {
    if (out.length >= limit) break;
    const key = normalizeRoot(root);
    if (seenRoots.has(key)) continue;

    const profile = getRootProfile(key);
    if (!profile || profile.occurrenceCount === 0) continue;
    seenRoots.add(key);

    // Prefer the reader's own wording when the corpus attests it under this
    // root; otherwise fall back to the root's most common form, stripped of
    // Uthmani diacritics so it reads as a heading rather than as scripture.
    const attested = new Set(profile.forms.map((f) => normalizeArabic(f.surface)));
    const fromQuestion = terms.find((t) => attested.has(normalizeArabic(t)));
    const label = fromQuestion ?? lightNormalize(profile.forms[0]?.surface ?? '') ?? key;

    out.push({ term: label, root: key });
  }

  return out;
}

function buildSections(analyses: WordAnalysis[], conceptIds: string[]): AnalysisSection[] {
  const sections: AnalysisSection[] = [];

  for (const analysis of analyses) {
    const spread = describeSenseSpread(analysis);
    const lines: string[] = [];

    lines.push(
      `الجذر: ${(analysis.root ?? '—').split('').join(' ')} — ` +
        `${analysis.occurrenceCount} موضعًا في ${analysis.verseCount} آية.`
    );

    if (analysis.distinctForms.length > 0) {
      lines.push(
        `أبرز الصيغ الواردة: ${analysis.distinctForms.slice(0, 8).map((f) => `${f.surface} (${f.count})`).join('، ')}.`
      );
    }
    if (analysis.grammarProfile.length > 0) {
      lines.push(
        `الخصائص الصرفية الغالبة: ${analysis.grammarProfile.slice(0, 6).map((g) => `${g.label} (${g.count})`).join('، ')}.`
      );
    }
    if (analysis.prepositionProfile.length > 0) {
      lines.push(
        `حروف الجر المصاحبة: ${analysis.prepositionProfile.slice(0, 5).map((p) => `${p.particle} (${p.count})`).join('، ')}. ` +
          'تغيّر حرف الجر كثيرًا ما يصاحب تغيّرًا في وجه الاستعمال.'
      );
    }
    lines.push(`أنماط الاستعمال: ${spread.headline} — ${spread.detail}`);

    sections.push({
      id: `word-${analysis.normalized}`,
      title: `الاستعمال القرآني للفظ «${analysis.word}»`,
      body: lines.join('\n\n'),
    });
  }

  for (const id of conceptIds.slice(0, 2)) {
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) continue;
    sections.push({
      id: `concept-${id}`,
      title: `أسئلة مفتوحة حول «${concept.labelArabic}»`,
      body: `${concept.summary}\n\n${concept.openQuestions.map((q) => `• ${q}`).join('\n')}`,
    });
  }

  return sections;
}

function buildThinkerPerspectives(conceptIds: string[]): ThinkerPerspectiveEntry[] {
  const topics = new Set([...conceptIds, 'method']);
  return THINKERS.map((thinker) => {
    const claims = Array.from(topics)
      .flatMap((topic) => claimsForTopic(topic))
      .filter((c) => c.thinkerId === thinker.id);

    // De-duplicate while preserving order.
    const unique = claims.filter((c, i) => claims.findIndex((x) => x.id === c.id) === i);

    return {
      thinkerId: thinker.id,
      thinkerName: thinker.nameArabic,
      claims: unique,
      noDataMessage: unique.length === 0 ? NO_DATA_MESSAGE : undefined,
    };
  });
}

function deriveConfidence(
  analyses: WordAnalysis[],
  verseCount: number
): { level: ConfidenceLevel; reason: string } {
  if (analyses.length === 0 || verseCount === 0) {
    return {
      level: 'undetermined',
      reason:
        'لم يُعثر على مواد قرآنية كافية مرتبطة بالسؤال، فلا يمكن بناء درجة ثقة. ' +
        'قد يكون السؤال بألفاظ غير قرآنية، أو يحتاج إلى إعادة صياغة بمفردات النص.',
    };
  }

  const primary = analyses[0];
  const patterns = primary.usagePatterns;
  const patternCount = patterns.length;

  // What matters is not how many buckets exist but how concentrated the usage
  // is. A word with eight buckets where one holds 80% of occurrences is far
  // more settled than one with three evenly split buckets.
  const total = patterns.reduce((sum, p) => sum + p.verseKeys.length, 0);
  const dominantShare = total > 0 ? (patterns[0]?.verseKeys.length ?? 0) / total : 0;

  if (patternCount <= 1 && primary.occurrenceCount >= 5) {
    return {
      level: 'medium',
      reason:
        `يرد اللفظ في ${primary.occurrenceCount} موضعًا بنمط بنيوي واحد، وهو اتساق يرفع الثقة. ` +
        'ومع ذلك تبقى الدرجة متوسطة لأن اتساق البنية النحوية لا يثبت وحدة الدلالة بمفرده.',
    };
  }

  if (dominantShare >= 0.65) {
    return {
      level: 'medium',
      reason:
        `يغطي النمط الغالب «${patterns[0].label}» نحو ${Math.round(dominantShare * 100)}% من المواضع، ` +
        `وتبقى ${patternCount - 1} أنماط أقل تكرارًا. ` +
        'التركّز الواضح يرفع الثقة، لكنه لا يبلغ اليقين ما دامت هناك مواضع خارج النمط تحتاج تفسيرًا.',
    };
  }

  if (dominantShare <= 0.4 && patternCount >= 3) {
    return {
      level: 'low',
      reason:
        `تتوزع المواضع على ${patternCount} أنماط دون هيمنة واضحة (أكبرها ${Math.round(dominantShare * 100)}% فقط)، ` +
        'ويمكن بناء أكثر من قراءة متماسكة على هذا التوزيع، فلا يصح الجزم بواحدة منها.',
    };
  }

  return {
    level: 'medium',
    reason:
      `رُصدت ${patternCount} أنماط استعمال، أكبرها يغطي ${Math.round(dominantShare * 100)}% من المواضع. ` +
      'الدرجة متوسطة لأن الترجيح بين الأنماط يحتاج فحصًا سياقيًا لكل موضع على حدة.',
  };
}

function buildSummary(question: string, analyses: WordAnalysis[], verseCount: number): string {
  if (analyses.length === 0) {
    return (
      'لم يتمكن المحرك المحلي من ربط السؤال بمواد قرآنية محددة. ' +
      'جرّب صياغة السؤال بلفظ قرآني مباشر، أو ابحث عن الجذر في تبويب «المصحف».'
    );
  }
  const primary = analyses[0];
  const spread = describeSenseSpread(primary);
  return (
    `يرد لفظ «${primary.word}» (الجذر ${(primary.root ?? '—').split('').join(' ')}) ` +
    `في ${primary.occurrenceCount} موضعًا داخل ${primary.verseCount} آية، ` +
    `و${spread.headline}. ` +
    `تم استخراج ${verseCount} آية مركزية للفحص. ` +
    'ما يلي وقائع لغوية من النص، والاستنتاج التفسيري مسؤولية قارئه.'
  );
}
