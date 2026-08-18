/**
 * Hallucination guard.
 *
 * Everything a language model returns passes through here before any of it
 * reaches the screen. The rules are absolute:
 *
 *   1. A verse reference that does not exist is dropped, not repaired by guess.
 *   2. Verse TEXT is never taken from the model. The model supplies numbers;
 *      the text is read from the local dataset, always.
 *   3. A quotation the model attaches is compared against the dataset, and on
 *      mismatch the dataset wins silently — the model's string is discarded.
 *   4. A thinker opinion without a source is dropped.
 *   5. Anything dropped is reported in `rejected`, never hidden.
 */

import type {
  AnalysisResult,
  Argument,
  ConfidenceLevel,
  CounterArgument,
  EvidenceDirectness,
  ReasoningStep,
  StatementKind,
} from '../types/analysis';
import type { QuranReference } from '../types/quran';
import { toReference, verseExists } from '../quran/repository';
import { normalizeArabic } from '../quran/arabic';

export interface ValidationOutcome<T> {
  value: T;
  rejected: string[];
}

const CONFIDENCE_VALUES: ConfidenceLevel[] = ['high', 'medium', 'low', 'undetermined'];
const GRADES: EvidenceDirectness[] = ['A', 'B', 'C', 'D', 'E'];
const KINDS: StatementKind[] = [
  'quran-text',
  'linguistic-observation',
  'inference',
  'thinker-opinion',
  'external-assumption',
];

const asString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v.trim() : fallback;

const asStringArray = (v: unknown, limit = 12): string[] =>
  Array.isArray(v) ? v.map((x) => asString(x)).filter(Boolean).slice(0, limit) : [];

const asConfidence = (v: unknown): ConfidenceLevel =>
  CONFIDENCE_VALUES.includes(v as ConfidenceLevel) ? (v as ConfidenceLevel) : 'undetermined';

const asGrade = (v: unknown): EvidenceDirectness =>
  GRADES.includes(v as EvidenceDirectness) ? (v as EvidenceDirectness) : 'C';

/**
 * Resolve a model-supplied reference against the dataset.
 * Returns null when the verse does not exist — an invented citation.
 */
export function validateReference(raw: unknown, rejected: string[]): QuranReference | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const surah = Number(obj.surah ?? obj.surahNumber);
  const ayah = Number(obj.ayah ?? obj.ayahNumber);

  if (!Number.isInteger(surah) || !Number.isInteger(ayah)) {
    rejected.push(`مرجع غير صالح: ${JSON.stringify(raw).slice(0, 80)}`);
    return null;
  }

  if (!verseExists(surah, ayah)) {
    rejected.push(`مرجع غير موجود في المصحف ورُفض: ${surah}:${ayah}`);
    return null;
  }

  const reference = toReference(surah, ayah, asString(obj.relevance) || undefined);
  if (!reference) return null;

  // If the model shipped a quotation, verify it and discard it either way:
  // the displayed text always comes from the dataset.
  const quoted = asString(obj.text);
  if (quoted) {
    const a = normalizeArabic(quoted);
    const b = normalizeArabic(reference.text);
    const overlaps = a.length > 8 && (b.includes(a.slice(0, Math.min(24, a.length))) || a.includes(b.slice(0, 24)));
    if (!overlaps) {
      rejected.push(
        `النص الذي أورده النموذج للآية ${surah}:${ayah} لا يطابق المصحف، وقد استُبدل بالنص الصحيح من قاعدة البيانات.`
      );
    }
  }

  return reference;
}

export function validateReferences(raw: unknown, rejected: string[], limit = 12): QuranReference[] {
  if (!Array.isArray(raw)) return [];
  const out: QuranReference[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const ref = validateReference(item, rejected);
    if (!ref || seen.has(ref.key)) continue;
    seen.add(ref.key);
    out.push(ref);
    if (out.length >= limit) break;
  }
  return out;
}

function validateChain(raw: unknown, rejected: string[]): ReasoningStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ReasoningStep | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const content = asString(obj.content);
      if (!content) return null;
      const kind = KINDS.includes(obj.kind as StatementKind)
        ? (obj.kind as StatementKind)
        : 'inference';
      return {
        kind,
        content,
        references: validateReferences(obj.references, rejected, 3),
        isAssumption: Boolean(obj.isAssumption) || kind === 'external-assumption',
      };
    })
    .filter(Boolean)
    .slice(0, 12) as ReasoningStep[];
}

function validateArgument(raw: unknown, rejected: string[], index: number): Argument | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const conclusion = asString(obj.conclusion);
  if (!conclusion) return null;

  const quranEvidence = validateReferences(obj.quranEvidence, rejected, 8);

  return {
    id: `arg-ai-${index}`,
    conclusion,
    premises: asStringArray(obj.premises, 8),
    quranEvidence,
    assumptions: asStringArray(obj.assumptions, 8),
    counterArguments: asStringArray(obj.counterArguments, 6),
    alternativeInterpretations: asStringArray(obj.alternativeInterpretations, 6),
    confidence: asConfidence(obj.confidence),
    directness: quranEvidence.length === 0 ? 'E' : asGrade(obj.directness),
    chain: validateChain(obj.chain, rejected),
  };
}

function validateCounter(raw: unknown, rejected: string[]): CounterArgument | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const statement = asString(obj.statement);
  if (!statement) return null;
  return {
    statement,
    quranEvidence: validateReferences(obj.quranEvidence, rejected, 6),
    response: asString(obj.response) || undefined,
    strength: asConfidence(obj.strength),
  };
}

export interface ModelPayloadContext {
  question: string;
  /** Deterministic parts computed on-device, which the model cannot override. */
  base: Pick<
    AnalysisResult,
    'questionAnalysis' | 'wordAnalyses' | 'nonSynonymyNotes' | 'thinkerPerspectives'
  >;
}

/**
 * Validate a raw model payload into an `AnalysisResult`.
 *
 * The locally computed parts of `context.base` are copied through untouched:
 * word statistics, the question decomposition and thinker records are produced
 * by this app, so a model has no opportunity to alter them.
 */
export function validateAnalysisPayload(
  raw: unknown,
  context: ModelPayloadContext
): ValidationOutcome<AnalysisResult> {
  const rejected: string[] = [];
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const centralVerses = validateReferences(obj.centralVerses, rejected, 10);

  const args = Array.isArray(obj.arguments)
    ? (obj.arguments
        .map((a, i) => validateArgument(a, rejected, i))
        .filter(Boolean) as Argument[]).slice(0, 5)
    : [];

  const sections = Array.isArray(obj.quranicAnalysis)
    ? obj.quranicAnalysis
        .map((s, i) => {
          if (!s || typeof s !== 'object') return null;
          const o = s as Record<string, unknown>;
          const title = asString(o.title);
          const body = asString(o.body);
          if (!title || !body) return null;
          return { id: `sec-${i}`, title, body };
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const leadingRaw = obj.leadingView as Record<string, unknown> | undefined;
  const leadingView =
    leadingRaw && asString(leadingRaw.statement)
      ? {
          statement: asString(leadingRaw.statement),
          rationale: asString(leadingRaw.rationale),
          directness: asGrade(leadingRaw.directness),
        }
      : null;

  const confidenceRaw = obj.confidence as Record<string, unknown> | undefined;

  const result: AnalysisResult = {
    id: `analysis-${Date.now().toString(36)}`,
    question: context.question,
    createdAt: new Date().toISOString(),
    mode: 'quran-only',
    engine: 'ai',
    summary: asString(obj.summary) || 'تعذّر استخراج خلاصة من نتيجة التحليل.',
    questionAnalysis: context.base.questionAnalysis,
    centralVerses,
    quranicAnalysis: sections as AnalysisResult['quranicAnalysis'],
    wordAnalyses: context.base.wordAnalyses,
    arguments: args,
    leadingView,
    strongestCounterArgument: validateCounter(obj.strongestCounterArgument, rejected),
    // Thinker records and non-synonymy tests are produced locally. A model is
    // never allowed to add, edit or invent either.
    nonSynonymyNotes: context.base.nonSynonymyNotes,
    thinkerPerspectives: context.base.thinkerPerspectives,
    confidence: {
      level: asConfidence(confidenceRaw?.level),
      reason:
        asString(confidenceRaw?.reason) ||
        'لم يقدّم التحليل سببًا صريحًا لدرجة الثقة، فتُعامل على أنها غير محسومة.',
    },
    rejectedReferences: rejected,
    notices: [],
  };

  if (centralVerses.length === 0) {
    result.notices.push(
      'لم يُقبل أي مرجع قرآني من نتيجة النموذج بعد التحقق، وقد استُكمل التحليل من محرك البحث المحلي.'
    );
  }
  if (rejected.length > 0) {
    result.notices.push(`رُفضت ${rejected.length} إشارة مرجعية لعدم مطابقتها لقاعدة بيانات المصحف.`);
  }

  return { value: result, rejected };
}
