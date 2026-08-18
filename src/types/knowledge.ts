/**
 * Thinkers, claims and concepts.
 *
 * Hard rule enforced across this module: a claim is only ever displayed when it
 * carries a `source`. Nothing here may be inferred, paraphrased from memory or
 * generated. Where we hold no documented position, the UI says so explicitly
 * instead of filling the gap.
 */

import type { QuranReference } from './quran';
import type { ConfidenceLevel } from './analysis';

export type SourceKind = 'book' | 'article' | 'lecture' | 'video' | 'interview' | 'website';

export interface SourceReference {
  kind: SourceKind;
  title: string;
  /** Author/speaker as printed on the source. */
  author?: string;
  year?: string;
  /** Page, chapter, or timestamp. */
  locator?: string;
  url?: string;
}

/**
 * Documentation status of a claim.
 *  - `documented`   : we hold a specific citation.
 *  - `attributed`   : widely attributed, citation not yet pinned down.
 *  - `undocumented` : we hold nothing. Never rendered as the thinker's view.
 */
export type DocumentationLevel = 'documented' | 'attributed' | 'undocumented';

export interface ThinkerClaim {
  id: string;
  thinkerId: string;
  /** Concept id this claim addresses. */
  topic: string;
  topicLabel: string;
  claim: string;
  reasoning?: string;
  quranReferences: QuranReference[];
  source?: SourceReference;
  date?: string;
  documentation: DocumentationLevel;
  confidence: number;
}

export interface Thinker {
  id: string;
  nameArabic: string;
  nameTransliterated: string;
  lifespan?: string;
  country?: string;
  /** One-paragraph description of the method, not of the conclusions. */
  methodSummary: string;
  /** Named methodological commitments, e.g. non-synonymy. */
  methodPrinciples: string[];
  /** Works/channels we would cite from. */
  knownSources: SourceReference[];
  /** Set when our claim database for this thinker is thin or empty. */
  dataCoverage: 'none' | 'partial' | 'good';
  coverageNote: string;
}

export interface Concept {
  id: string;
  labelArabic: string;
  labelEnglish: string;
  /** Roots that carry this concept in the text. */
  roots: string[];
  /** Surface terms worth searching for. */
  terms: string[];
  /** Concepts commonly contrasted with this one. */
  contrastWith: string[];
  /** Neutral framing of the interpretive question, never an answer. */
  openQuestions: string[];
  summary: string;
}

export interface ConceptPair {
  id: string;
  labelArabic: string;
  termA: string;
  termB: string;
  rootA?: string;
  rootB?: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Knowledge graph
// ---------------------------------------------------------------------------

export type GraphNodeKind = 'verse' | 'word' | 'root' | 'concept' | 'claim' | 'thinker';

export type GraphEdgeKind =
  | 'OCCURS_IN'
  | 'SHARES_ROOT'
  | 'RELATED_TO'
  | 'CITES'
  | 'SUPPORTS'
  | 'CONTRADICTS'
  | 'INTERPRETS';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Free-form payload keyed by node kind, kept loose on purpose. */
  meta?: Record<string, string | number>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: GraphEdgeKind;
  weight?: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
