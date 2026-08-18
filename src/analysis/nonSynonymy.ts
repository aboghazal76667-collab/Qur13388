/**
 * Non-synonymy mode.
 *
 * Inspired by the methodological commitment associated with Muhammad Shahrour
 * and others: do not assume two Quranic words are interchangeable.
 *
 * ── Treated strictly as a hypothesis ────────────────────────────────────────
 * Non-synonymy is NOT asserted here as a property of the text. It is applied as
 * a testable assumption, and every result reports both what supports it and
 * what weakens it. `isHypothesis` is hard-coded to `true` on every output so no
 * consumer can accidentally render one of these as a finding.
 */

import type { ConfidenceLevel, NonSynonymyHypothesis } from '../types/analysis';
import type { QuranReference } from '../types/quran';
import { compareTerms } from './comparison';
import { CONCEPT_PAIRS } from '../knowledge/concepts';

let counter = 0;

export interface NonSynonymyInput {
  termA: string;
  termB: string;
  rootA?: string;
  rootB?: string;
}

export function testNonSynonymy(input: NonSynonymyInput): NonSynonymyHypothesis {
  const comparison = compareTerms(input.termA, input.termB, {
    rootA: input.rootA,
    rootB: input.rootB,
    maxExamples: 8,
  });

  const evidence: QuranReference[] = [
    ...comparison.sharedVerses.slice(0, 4),
    ...comparison.onlyA.slice(0, 3),
    ...comparison.onlyB.slice(0, 3),
  ];

  const supporting = [...comparison.distributionalVerdict.supportsDistinction];
  const weakening = [...comparison.distributionalVerdict.weakensDistinction];

  weakening.push(
    'مبدأ عدم الترادف نفسه ليس معطى نصيًا، بل افتراض منهجي. ' +
      'إثباته في لفظين لا ينقله إلى قاعدة عامة، ونفيه في لفظين لا يبطله في غيرهما.'
  );

  const confidence: ConfidenceLevel =
    comparison.termA.occurrenceCount === 0 || comparison.termB.occurrenceCount === 0
      ? 'undetermined'
      : comparison.distributionalVerdict.confidence;

  return {
    id: `nonsyn-${(counter++).toString(36)}`,
    terms: [input.termA, input.termB],
    hypothesis:
      `إذا افترضنا عدم الترادف بين «${input.termA}» و«${input.termB}»، ` +
      'فإن الفروق المحتملة التي يمكن رصدها من الاستعمال القرآني هي ما يلي. ' +
      'هذا اختبار للفرضية، لا تقرير لنتيجة.',
    supporting,
    weakening,
    quranEvidence: evidence,
    confidence,
    isHypothesis: true,
  };
}

/**
 * Pick the curated pairs relevant to a set of terms, so that a question about
 * "الكتاب والقرآن" automatically runs the right test.
 */
export function relevantPairs(terms: string[]): typeof CONCEPT_PAIRS {
  const normalizedTerms = terms.map((t) => t.replace(/^ال/, ''));
  return CONCEPT_PAIRS.filter((pair) => {
    const a = pair.termA.replace(/^ال/, '');
    const b = pair.termB.replace(/^ال/, '');
    const hasA = normalizedTerms.some((t) => t.includes(a) || a.includes(t));
    const hasB = normalizedTerms.some((t) => t.includes(b) || b.includes(t));
    return hasA && hasB;
  });
}

/** Run every curated pair implied by the question's terms. */
export function testRelevantPairs(terms: string[], limit = 2): NonSynonymyHypothesis[] {
  return relevantPairs(terms)
    .slice(0, limit)
    .map((pair) =>
      testNonSynonymy({
        termA: pair.termA,
        termB: pair.termB,
        rootA: pair.rootA,
        rootB: pair.rootB,
      })
    );
}
