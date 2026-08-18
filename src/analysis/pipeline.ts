/**
 * Top-level analysis orchestration.
 *
 * The deterministic pipeline always runs first, on-device. Its output is the
 * floor: retrieval, counts, morphology, thinker records and non-synonymy tests
 * are settled before any network call happens. The backend is then given that
 * material and asked only to synthesise prose and arguments on top of it.
 *
 * Consequence: an unreachable backend degrades the answer's readability, never
 * its factual base, and a misbehaving model cannot corrupt a single number.
 */

import type { AnalysisResult } from '../types/analysis';
import type { AnalyzeRequest } from '../types/app';
import { runOfflineAnalysis } from './offlineEngine';
import { BackendUnavailableError, requestAnalysis, resolveBaseUrl } from '../api/client';

export interface AnalyzeQuestionOptions {
  /** When false the request never leaves the device. */
  aiEnabled: boolean;
  apiBaseUrl: string;
  signal?: AbortSignal;
  onStage?: (stage: AnalysisStage) => void;
}

export type AnalysisStage =
  | 'analyzing-question'
  | 'retrieving-verses'
  | 'analyzing-words'
  | 'building-arguments'
  | 'contacting-ai'
  | 'validating'
  | 'done';

export const STAGE_LABELS: Record<AnalysisStage, string> = {
  'analyzing-question': 'تحليل السؤال واستخراج المفاهيم…',
  'retrieving-verses': 'البحث في المصحف عن المواضع…',
  'analyzing-words': 'تحليل الكلمات والجذور والسياقات…',
  'building-arguments': 'بناء مسار الاستدلال والاعتراضات…',
  'contacting-ai': 'إرسال الوقائع اللغوية إلى محرك التحليل…',
  validating: 'التحقق من كل مرجع قرآني من قاعدة البيانات…',
  done: 'اكتمل التحليل',
};

export async function analyzeQuestion(
  question: string,
  options: AnalyzeQuestionOptions
): Promise<AnalysisResult> {
  const report = options.onStage ?? (() => {});

  report('analyzing-question');
  report('retrieving-verses');
  report('analyzing-words');
  report('building-arguments');

  // The deterministic base. Never skipped, never overridden.
  const base = runOfflineAnalysis(question);

  if (!options.aiEnabled) {
    report('done');
    return base;
  }

  const baseUrl = resolveBaseUrl(options.apiBaseUrl);

  const request: AnalyzeRequest = {
    question,
    mode: 'quran-only',
    context: base.centralVerses.map((v) => ({
      key: v.key,
      surah: v.surah,
      ayah: v.ayah,
      text: v.text,
    })),
    lexicalFacts: base.wordAnalyses.map((w) => ({
      term: w.word,
      root: w.root,
      occurrenceCount: w.occurrenceCount,
      verseCount: w.verseCount,
      forms: w.distinctForms.slice(0, 10).map((f) => f.surface),
      sampleKeys: w.contexts.slice(0, 12).map((c) => c.verseKey),
    })),
    questionAnalysis: base.questionAnalysis,
  };

  try {
    report('contacting-ai');
    const aiResult = await requestAnalysis(
      request,
      {
        question,
        base: {
          questionAnalysis: base.questionAnalysis,
          wordAnalyses: base.wordAnalyses,
          nonSynonymyNotes: base.nonSynonymyNotes,
          thinkerPerspectives: base.thinkerPerspectives,
        },
      },
      { baseUrl, signal: options.signal }
    );
    report('validating');

    // Backfill anything the model left thin from the deterministic run, so a
    // sparse AI answer is still at least as informative as the offline one.
    const merged: AnalysisResult = {
      ...aiResult,
      centralVerses: aiResult.centralVerses.length > 0 ? aiResult.centralVerses : base.centralVerses,
      quranicAnalysis:
        aiResult.quranicAnalysis.length > 0 ? aiResult.quranicAnalysis : base.quranicAnalysis,
      arguments: aiResult.arguments.length > 0 ? aiResult.arguments : base.arguments,
      strongestCounterArgument:
        aiResult.strongestCounterArgument ?? base.strongestCounterArgument,
      leadingView: aiResult.leadingView ?? base.leadingView,
      notices: [...aiResult.notices],
    };

    report('done');
    return merged;
  } catch (error) {
    const reason =
      error instanceof BackendUnavailableError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'خطأ غير معروف';

    report('done');
    return {
      ...base,
      notices: [
        `تعذّر الاتصال بمحرك التحليل، وعُرضت النتيجة من المحرك المحلي. (${reason})`,
        ...base.notices,
      ],
    };
  }
}
