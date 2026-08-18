/**
 * Argument Engine + Assumption Detector.
 *
 * Rather than returning a verdict, the engine lays a claim out as a chain and
 * marks the links. The question it is built to answer is not "is this true?"
 * but "which step here is doing the real work, and is that step in the text?"
 */

import type {
  Argument,
  ConfidenceLevel,
  ReasoningStep,
  StatementKind,
} from '../types/analysis';
import type { QuranReference } from '../types/quran';
import { gradeArgument } from './evidence';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export interface BuildArgumentInput {
  conclusion: string;
  premises: string[];
  quranEvidence: QuranReference[];
  assumptions?: string[];
  counterArguments?: string[];
  alternativeInterpretations?: string[];
  confidence?: ConfidenceLevel;
  /** Pre-built chain; when omitted one is derived from premises + evidence. */
  chain?: ReasoningStep[];
}

export function buildArgument(input: BuildArgumentInput): Argument {
  const assumptions = input.assumptions ?? [];
  const chain = input.chain ?? deriveChain(input, assumptions);

  const partial = {
    id: nextId('arg'),
    conclusion: input.conclusion,
    premises: input.premises,
    quranEvidence: input.quranEvidence,
    assumptions,
    counterArguments: input.counterArguments ?? [],
    alternativeInterpretations: input.alternativeInterpretations ?? [],
    confidence: input.confidence ?? inferConfidence(input, assumptions),
    chain,
  };

  return { ...partial, directness: gradeArgument(partial) };
}

function deriveChain(input: BuildArgumentInput, assumptions: string[]): ReasoningStep[] {
  const chain: ReasoningStep[] = [];

  for (const ref of input.quranEvidence.slice(0, 3)) {
    chain.push({
      kind: 'quran-text',
      content: `${ref.surahNameArabic} ${ref.surah}:${ref.ayah} — ${ref.text}`,
      references: [ref],
    });
  }

  for (const premise of input.premises) {
    chain.push({
      kind: classifyPremise(premise),
      content: premise,
      isAssumption: assumptions.includes(premise),
    });
  }

  for (const assumption of assumptions) {
    if (input.premises.includes(assumption)) continue;
    chain.push({
      kind: 'external-assumption',
      content: assumption,
      isAssumption: true,
    });
  }

  chain.push({ kind: 'inference', content: input.conclusion });
  return chain;
}

const OBSERVATION_MARKERS = ['يرد', 'ترد', 'تكرر', 'عدد المواضع', 'موضعًا', 'الجذر', 'الصيغة', 'لم ترد', 'لا ترد'];
const ASSUMPTION_MARKERS = ['نفترض', 'المفترض', 'يُفترض', 'إذا سلّمنا', 'بناءً على', 'المعروف أن', 'عادةً'];

function classifyPremise(premise: string): StatementKind {
  if (ASSUMPTION_MARKERS.some((m) => premise.includes(m))) return 'external-assumption';
  if (OBSERVATION_MARKERS.some((m) => premise.includes(m))) return 'linguistic-observation';
  return 'inference';
}

function inferConfidence(input: BuildArgumentInput, assumptions: string[]): ConfidenceLevel {
  if (input.quranEvidence.length === 0) return 'undetermined';
  if (assumptions.length === 0 && input.quranEvidence.length >= 2) return 'high';
  if (assumptions.length <= 1) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Assumption detection
// ---------------------------------------------------------------------------

export interface DetectedAssumption {
  statement: string;
  reason: string;
  /** True when the assumed term is nowhere in the cited verses. */
  absentFromText: boolean;
}

/**
 * Find premises that the cited verses do not actually contain. This is the
 * check behind "is B in the Quran, or was B inserted between the text and the
 * conclusion?" — it looks for content words in the claim that appear in none of
 * the verses supporting it.
 */
export function detectAssumptions(
  conclusion: string,
  premises: string[],
  evidence: QuranReference[],
  normalize: (s: string) => string
): DetectedAssumption[] {
  const corpus = normalize(evidence.map((e) => e.text).join(' '));
  const out: DetectedAssumption[] = [];

  const candidates = [conclusion, ...premises];
  for (const statement of candidates) {
    const words = normalize(statement)
      .split(' ')
      .filter((w) => w.length >= 4);
    const missing = words.filter((w) => !corpus.includes(w));
    if (words.length === 0) continue;
    const missingRatio = missing.length / words.length;
    if (missingRatio > 0.75 && missing.length >= 2) {
      out.push({
        statement,
        reason:
          `المفردات المحورية في هذه العبارة (${missing.slice(0, 4).join('، ')}) ` +
          'لا ترد في الآيات المستشهد بها، فهي إذن مقدمة مضافة إلى النص لا مستخرجة منه.',
        absentFromText: true,
      });
    }
  }

  return out;
}

/** Turn an argument into the vertical chain the UI draws. */
export function chainForDisplay(argument: Argument): ReasoningStep[] {
  return argument.chain.length > 0
    ? argument.chain
    : [{ kind: 'inference' as StatementKind, content: argument.conclusion }];
}

export const STATEMENT_KIND_LABELS: Record<StatementKind, string> = {
  'quran-text': 'نص قرآني',
  'linguistic-observation': 'ملاحظة لغوية',
  inference: 'استنتاج',
  'thinker-opinion': 'رأي مفكر',
  'external-assumption': 'افتراض خارجي',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'مرتفعة',
  medium: 'متوسطة',
  low: 'منخفضة',
  undetermined: 'غير محسوم',
};
