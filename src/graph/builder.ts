/**
 * Knowledge graph builder.
 *
 * Produces the node/edge model the graph screen renders, using the same six
 * node kinds and seven relationship kinds the wider architecture is designed
 * around. Today it is assembled in memory from the corpus and the local
 * knowledge base; the shape is deliberately the one a property graph
 * (Neo4j and friends) expects, so the storage swap is a repository change and
 * nothing else.
 */

import type { GraphEdge, GraphNode, KnowledgeGraph } from '../types/knowledge';
import type { WordAnalysis } from '../types/analysis';
import { getVerseByKey, getVersesForRoot } from '../quran/repository';
import { CONCEPT_BY_ID, CONCEPTS } from '../knowledge/concepts';
import { THINKER_CLAIMS, THINKER_BY_ID } from '../knowledge/thinkers';
import { displayRoot } from '../quran/arabic';

const verseNode = (key: string): GraphNode | null => {
  const verse = getVerseByKey(key);
  if (!verse) return null;
  return {
    id: `verse:${key}`,
    kind: 'verse',
    label: `${verse.surahNameArabic} ${verse.surahNumber}:${verse.ayahNumber}`,
    meta: { key, surah: verse.surahNumber, ayah: verse.ayahNumber },
  };
};

const rootNode = (root: string): GraphNode => ({
  id: `root:${root}`,
  kind: 'root',
  label: displayRoot(root),
  meta: { root },
});

const conceptNode = (id: string): GraphNode | null => {
  const concept = CONCEPT_BY_ID.get(id);
  if (!concept) return null;
  return { id: `concept:${id}`, kind: 'concept', label: concept.labelArabic, meta: { conceptId: id } };
};

class GraphBuilder {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();

  addNode(node: GraphNode | null): string | null {
    if (!node) return null;
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
    return node.id;
  }

  addEdge(from: string | null, to: string | null, kind: GraphEdge['kind'], weight = 1): void {
    if (!from || !to || from === to) return;
    const id = `${from}->${to}:${kind}`;
    const existing = this.edges.get(id);
    if (existing) existing.weight = (existing.weight ?? 1) + weight;
    else this.edges.set(id, { id, from, to, kind, weight });
  }

  build(): KnowledgeGraph {
    return { nodes: Array.from(this.nodes.values()), edges: Array.from(this.edges.values()) };
  }
}

export interface ConceptGraphOptions {
  /** Verses per root; kept small so the on-device layout stays readable. */
  versesPerRoot?: number;
}

/**
 * Graph centred on one concept: concept -> roots -> verses, plus any thinker
 * claims that cite the concept and the verses they lean on.
 */
export function buildConceptGraph(conceptId: string, options: ConceptGraphOptions = {}): KnowledgeGraph {
  const concept = CONCEPT_BY_ID.get(conceptId);
  const builder = new GraphBuilder();
  if (!concept) return builder.build();

  const versesPerRoot = options.versesPerRoot ?? 4;
  const conceptId_ = builder.addNode(conceptNode(concept.id));

  for (const root of concept.roots.slice(0, 4)) {
    const rootId = builder.addNode(rootNode(root));
    builder.addEdge(conceptId_, rootId, 'RELATED_TO');

    const verses = getVersesForRoot(root).slice(0, versesPerRoot);
    for (const verse of verses) {
      const vId = builder.addNode(verseNode(verse.key));
      builder.addEdge(rootId, vId, 'OCCURS_IN');
    }
  }

  // Contrasted concepts
  for (const otherId of concept.contrastWith) {
    const other = builder.addNode(conceptNode(otherId));
    builder.addEdge(conceptId_, other, 'RELATED_TO');
  }

  // Thinker claims touching this concept
  for (const claim of THINKER_CLAIMS.filter((c) => c.topic === conceptId)) {
    const thinker = THINKER_BY_ID.get(claim.thinkerId);
    if (!thinker) continue;
    const thinkerId = builder.addNode({
      id: `thinker:${thinker.id}`,
      kind: 'thinker',
      label: thinker.nameArabic,
    });
    const claimId = builder.addNode({
      id: `claim:${claim.id}`,
      kind: 'claim',
      label: truncate(claim.claim, 44),
      meta: { documentation: claim.documentation },
    });
    builder.addEdge(thinkerId, claimId, 'CITES');
    builder.addEdge(claimId, conceptId_, 'INTERPRETS');
    for (const ref of claim.quranReferences.slice(0, 3)) {
      const vId = builder.addNode(verseNode(ref.key));
      builder.addEdge(claimId, vId, 'SUPPORTS');
    }
  }

  return builder.build();
}

/** Graph centred on a single analysed word. */
export function buildWordGraph(analysis: WordAnalysis, limit = 6): KnowledgeGraph {
  const builder = new GraphBuilder();

  const wordId = builder.addNode({
    id: `word:${analysis.normalized}`,
    kind: 'word',
    label: analysis.word,
    meta: { occurrences: analysis.occurrenceCount },
  });

  if (analysis.root) {
    const rootId = builder.addNode(rootNode(analysis.root));
    builder.addEdge(wordId, rootId, 'SHARES_ROOT');

    for (const pattern of analysis.usagePatterns.slice(0, 3)) {
      for (const key of pattern.verseKeys.slice(0, limit)) {
        const vId = builder.addNode(verseNode(key));
        builder.addEdge(rootId, vId, 'OCCURS_IN');
      }
    }
  }

  // Concepts that claim this root
  if (analysis.root) {
    for (const concept of CONCEPTS) {
      if (!concept.roots.includes(analysis.root)) continue;
      const cId = builder.addNode(conceptNode(concept.id));
      builder.addEdge(cId, wordId, 'RELATED_TO');
    }
  }

  return builder.build();
}

/** Graph for a completed analysis: question concept -> verses -> arguments. */
export function buildAnalysisGraph(
  conceptIds: string[],
  verseKeys: string[],
  claimIds: string[] = []
): KnowledgeGraph {
  const builder = new GraphBuilder();

  const conceptNodeIds = conceptIds
    .map((id) => builder.addNode(conceptNode(id)))
    .filter(Boolean) as string[];

  for (const key of verseKeys.slice(0, 12)) {
    const vId = builder.addNode(verseNode(key));
    for (const cId of conceptNodeIds) builder.addEdge(cId, vId, 'RELATED_TO');
  }

  for (const claimId of claimIds) {
    const claim = THINKER_CLAIMS.find((c) => c.id === claimId);
    if (!claim) continue;
    const thinker = THINKER_BY_ID.get(claim.thinkerId);
    const tId = thinker
      ? builder.addNode({ id: `thinker:${thinker.id}`, kind: 'thinker', label: thinker.nameArabic })
      : null;
    const cId = builder.addNode({
      id: `claim:${claim.id}`,
      kind: 'claim',
      label: truncate(claim.claim, 44),
    });
    builder.addEdge(tId, cId, 'CITES');
    for (const conceptNodeId of conceptNodeIds) builder.addEdge(cId, conceptNodeId, 'INTERPRETS');
  }

  return builder.build();
}

function truncate(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length)}…`;
}

export const EDGE_LABELS: Record<GraphEdge['kind'], string> = {
  OCCURS_IN: 'يرد في',
  SHARES_ROOT: 'يشترك في الجذر',
  RELATED_TO: 'مرتبط بـ',
  CITES: 'يستشهد',
  SUPPORTS: 'يؤيد',
  CONTRADICTS: 'يعارض',
  INTERPRETS: 'يفسّر',
};

export const NODE_LABELS: Record<GraphNode['kind'], string> = {
  verse: 'آية',
  word: 'كلمة',
  root: 'جذر',
  concept: 'مفهوم',
  claim: 'ادعاء',
  thinker: 'مفكر',
};
