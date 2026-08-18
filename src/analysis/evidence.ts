/**
 * Evidence Directness grading.
 *
 * The scale measures ONE thing: how many interpretive moves separate a
 * conclusion from the words on the page. It is not a truth scale. A grade of E
 * does not make a claim false, and a grade of A does not make it the only
 * possible reading — A only means the text states it with little mediation.
 */

import type { Argument, EvidenceDirectness, EvidenceGrade, ReasoningStep } from '../types/analysis';

export const EVIDENCE_GRADES: Record<EvidenceDirectness, EvidenceGrade> = {
  A: {
    grade: 'A',
    label: 'نص قرآني مباشر',
    description:
      'النتيجة مذكورة في الآية بصيغتها تقريبًا، دون حاجة إلى خطوة تفسيرية وسيطة.',
  },
  B: {
    grade: 'B',
    label: 'استنتاج سياقي قوي',
    description:
      'النتيجة غير منصوصة حرفيًا، لكن سياق الآية المباشر يقودها بخطوة واحدة واضحة.',
  },
  C: {
    grade: 'C',
    label: 'استنتاج تفسيري',
    description:
      'الوصول إلى النتيجة يتطلب ترجيح معنى من عدة معانٍ محتملة للفظ أو التركيب.',
  },
  D: {
    grade: 'D',
    label: 'استنتاج متعدد الخطوات',
    description:
      'النتيجة تحتاج سلسلة من المقدمات، وكل حلقة فيها تحتمل النقاش على حدة.',
  },
  E: {
    grade: 'E',
    label: 'يعتمد على مقدمة خارجية',
    description:
      'النتيجة تستند إلى مقدمة غير مستخرجة من النص القرآني نفسه. هذا لا يعني بطلانها، ' +
      'بل يعني أن إثباتها لا يتم من داخل القرآن وحده.',
  },
};

export const EVIDENCE_ORDER: EvidenceDirectness[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Derive a grade from the shape of the reasoning chain rather than from a
 * model's self-assessment: external assumptions dominate, then chain length,
 * then whether any verse is cited at all.
 */
export function gradeFromChain(chain: ReasoningStep[], quranEvidenceCount: number): EvidenceDirectness {
  if (quranEvidenceCount === 0) return 'E';
  if (chain.some((s) => s.kind === 'external-assumption')) return 'E';

  const inferenceSteps = chain.filter((s) => s.kind === 'inference').length;
  const assumptions = chain.filter((s) => s.isAssumption).length;

  if (assumptions === 0 && inferenceSteps === 0) return 'A';
  if (assumptions === 0 && inferenceSteps <= 1) return 'B';
  if (assumptions <= 1 && inferenceSteps <= 2) return 'C';
  return 'D';
}

export function gradeArgument(argument: Omit<Argument, 'directness'>): EvidenceDirectness {
  if (argument.quranEvidence.length === 0) return 'E';
  const external = argument.assumptions.length;
  const chainGrade = gradeFromChain(argument.chain, argument.quranEvidence.length);
  if (external >= 2 && chainGrade !== 'E') {
    // Several unstated premises push the claim further from the text.
    const idx = EVIDENCE_ORDER.indexOf(chainGrade);
    return EVIDENCE_ORDER[Math.min(idx + 1, EVIDENCE_ORDER.length - 1)];
  }
  return chainGrade;
}

/** Colour token name, resolved against the active theme by the UI layer. */
export function gradeTone(grade: EvidenceDirectness): 'strong' | 'good' | 'neutral' | 'caution' | 'external' {
  switch (grade) {
    case 'A':
      return 'strong';
    case 'B':
      return 'good';
    case 'C':
      return 'neutral';
    case 'D':
      return 'caution';
    case 'E':
      return 'external';
  }
}
