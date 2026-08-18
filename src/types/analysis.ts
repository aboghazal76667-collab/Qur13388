/**
 * Types for the analytical layer.
 *
 * The system's central rule is that these four things stay separated and are
 * never collapsed into one another:
 *   1. the Quranic text            -> QuranReference
 *   2. a linguistic observation    -> LinguisticObservation
 *   3. an inference                -> Argument / ReasoningStep
 *   4. a thinker's position        -> ThinkerClaim
 * plus 5. how confident we are     -> ConfidenceLevel
 */

import type { QuranReference, VerseKey } from './quran';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'undetermined';

/**
 * How directly a conclusion follows from the text. This grades DISTANCE FROM
 * THE TEXT, not truth. An E-grade claim is not thereby false, and an A-grade
 * claim is not thereby the only reading.
 */
export type EvidenceDirectness = 'A' | 'B' | 'C' | 'D' | 'E';

export interface EvidenceGrade {
  grade: EvidenceDirectness;
  label: string;
  description: string;
}

export type StatementKind =
  /** Quoted Quranic text. */
  | 'quran-text'
  /** Something countable/observable in the corpus (occurrences, forms, order). */
  | 'linguistic-observation'
  /** A step of reasoning produced by this system. */
  | 'inference'
  /** A position held by a named thinker. */
  | 'thinker-opinion'
  /** A premise that is being brought in from outside the text. */
  | 'external-assumption';

export interface LinguisticObservation {
  id: string;
  /** What can be checked in the corpus. */
  statement: string;
  root?: string;
  lemma?: string;
  word?: string;
  verseKeys: VerseKey[];
  /** True when this observation was computed by the app, not written by an LLM. */
  computed: boolean;
}

export interface ReasoningStep {
  kind: StatementKind;
  content: string;
  /** References backing this specific step. */
  references?: QuranReference[];
  /** Set when the step introduces something not present in the text. */
  isAssumption?: boolean;
}

export interface Argument {
  id: string;
  conclusion: string;
  premises: string[];
  quranEvidence: QuranReference[];
  /** Premises the argument needs but the text does not state. */
  assumptions: string[];
  counterArguments: string[];
  alternativeInterpretations: string[];
  confidence: ConfidenceLevel;
  directness: EvidenceDirectness;
  /** The visual chain: verse -> observation -> assumption -> conclusion. */
  chain: ReasoningStep[];
}

export interface CounterArgument {
  statement: string;
  quranEvidence: QuranReference[];
  /** How the leading reading answers it, if it can. */
  response?: string;
  strength: ConfidenceLevel;
}

export interface WordUsageContext {
  verseKey: VerseKey;
  surface: string;
  /** Words immediately before, in text order. */
  before: string[];
  after: string[];
  /** Preposition attached to or governing the word, when detectable. */
  preposition?: string;
  /** Grammatical person/number/tense tags. */
  features: string[];
  pos?: string;
  /** Grouped sense bucket assigned by the internal analysis engine. */
  usageGroup?: string;
}

export interface WordAnalysis {
  word: string;
  normalized: string;
  root?: string;
  lemma?: string;
  occurrenceCount: number;
  verseCount: number;
  distinctForms: { surface: string; count: number }[];
  lemmaBreakdown: { lemma: string; count: number }[];
  contexts: WordUsageContext[];
  /** Distinct usage clusters found inside the Quran itself. */
  usagePatterns: UsagePattern[];
  /** Prepositions that co-occur, which often mark a shift in sense. */
  prepositionProfile: { particle: string; count: number; verseKeys: VerseKey[] }[];
  grammarProfile: { feature: string; label: string; count: number }[];
}

export interface UsagePattern {
  id: string;
  label: string;
  description: string;
  verseKeys: VerseKey[];
  sampleReferences: QuranReference[];
  /** Signals that produced this grouping (particle, object type, form...). */
  signals: string[];
}

export interface ComparisonResult {
  termA: TermProfile;
  termB: TermProfile;
  /**
   * Examples only — capped for display. The `*Count` fields carry the true
   * totals, so the UI never reports a capped example list as a total.
   */
  sharedVerses: QuranReference[];
  onlyA: QuranReference[];
  onlyB: QuranReference[];
  sharedCount: number;
  onlyACount: number;
  onlyBCount: number;
  /** Contexts where either term appears but the other does not. */
  contrasts: ComparisonContrast[];
  /**
   * Whether Quranic usage, on its own, supports treating the two as
   * non-synonymous. This is an observation about distribution, not a verdict.
   */
  distributionalVerdict: {
    summary: string;
    supportsDistinction: string[];
    weakensDistinction: string[];
    confidence: ConfidenceLevel;
  };
}

export interface TermProfile {
  term: string;
  root?: string;
  occurrenceCount: number;
  verseCount: number;
  surahCount: number;
  topSurahs: { surah: number; nameArabic: string; count: number }[];
  forms: { surface: string; count: number }[];
  coOccurringRoots: { root: string; count: number }[];
  references: QuranReference[];
}

export interface ComparisonContrast {
  label: string;
  detail: string;
  aExamples: QuranReference[];
  bExamples: QuranReference[];
}

/** Output of STEP 1: the question, decomposed. */
export interface QuestionAnalysis {
  originalQuestion: string;
  mainIssue: string;
  quranicTerms: string[];
  candidateRoots: string[];
  /** Premises the question itself smuggles in. */
  implicitAssumptions: string[];
  subQuestions: string[];
  relatedConcepts: string[];
}

export interface AnalysisSection {
  id: string;
  title: string;
  body: string;
}

/** The full result rendered by the answer screen. */
export interface AnalysisResult {
  id: string;
  question: string;
  createdAt: string;
  mode: 'quran-only';
  /** 'ai' when the backend synthesised it, 'offline' for the on-device engine. */
  engine: 'ai' | 'offline';
  summary: string;
  questionAnalysis: QuestionAnalysis;
  centralVerses: QuranReference[];
  quranicAnalysis: AnalysisSection[];
  wordAnalyses: WordAnalysis[];
  arguments: Argument[];
  leadingView: {
    statement: string;
    rationale: string;
    directness: EvidenceDirectness;
  } | null;
  strongestCounterArgument: CounterArgument | null;
  nonSynonymyNotes: NonSynonymyHypothesis[];
  thinkerPerspectives: ThinkerPerspectiveEntry[];
  confidence: {
    level: ConfidenceLevel;
    reason: string;
  };
  /** Verse references the model produced that failed dataset validation. */
  rejectedReferences: string[];
  notices: string[];
}

export interface NonSynonymyHypothesis {
  id: string;
  terms: string[];
  hypothesis: string;
  supporting: string[];
  weakening: string[];
  quranEvidence: QuranReference[];
  confidence: ConfidenceLevel;
  /** Always true: this is a hypothesis under test, not a settled result. */
  isHypothesis: true;
}

export interface ThinkerPerspectiveEntry {
  thinkerId: string;
  thinkerName: string;
  /** Empty when we hold no documented position for this thinker on this topic. */
  claims: import('./knowledge').ThinkerClaim[];
  /** Shown verbatim when `claims` is empty. */
  noDataMessage?: string;
}
