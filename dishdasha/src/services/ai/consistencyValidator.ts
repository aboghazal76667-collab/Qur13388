/**
 * DESIGN CONSISTENCY VALIDATOR.
 *
 * Image models hallucinate. A generated preview that quietly shows a different
 * colour, the wrong embroidery or no furakha is worse than no preview at all,
 * because the customer orders against it.
 *
 * This compares what came back with what was asked for and reports a
 * confidence. When confidence is poor the UI must say "المعاينة تحتاج إعادة
 * إنشاء" and offer a retry — never present the result as accurate.
 *
 * STATUS: the checks are implemented against an ImageEvidence structure. In
 * MOCK_AI_MODE the evidence comes from our own renderer, so it agrees by
 * construction. A real vision-based extractor is future work; until one
 * exists, `evidence: null` yields `unknown`, which the UI must not treat as a
 * pass.
 */
import { contrastRatio, hexToHsl } from '@dd/engine/color';
import type { GarmentSpec } from './photorealistic';

/** What an inspector observed in a generated image. */
export type ImageEvidence = {
  /** Dominant garment colour, sampled away from embroidery. */
  dominantHex: string;
  /** Colours found in the embroidery regions, most-covering first. */
  embroideryHexes: string[];
  /** Whether a tassel was detected hanging from the neckline. */
  furakhaDetected: boolean;
  /** Rough silhouette signature: height/width ratio of the garment mask. */
  aspectRatio: number;
  /** Whether a collar was detected — an automatic failure for this garment. */
  collarDetected: boolean;
};

export type ConsistencyCheck = {
  key: 'base_colour' | 'thread_colours' | 'furakha' | 'silhouette' | 'collarless';
  passed: boolean;
  detail: string;
  weight: number;
};

export type ConsistencyResult = {
  verdict: 'ok' | 'poor' | 'unknown';
  /** 0..1 — how well the image matches the specification. */
  confidence: number;
  checks: ConsistencyCheck[];
  /** True when the UI must offer regeneration rather than presenting it. */
  requiresRegeneration: boolean;
};

/** Perceptual closeness of two hexes, 0..1. */
const colourCloseness = (a: string, b: string): number => {
  const ha = hexToHsl(a);
  const hb = hexToHsl(b);
  const hueDelta = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h)) / 180;
  const satDelta = Math.abs(ha.s - hb.s) / 100;
  const lightDelta = Math.abs(ha.l - hb.l) / 100;
  // Lightness dominates how "wrong" a garment colour looks at a glance.
  return Math.max(0, 1 - (lightDelta * 0.55 + satDelta * 0.25 + hueDelta * 0.20));
};

export const validateAgainstSpec = (
  spec: GarmentSpec,
  evidence: ImageEvidence | null,
): ConsistencyResult => {
  if (!evidence) {
    // No inspector available. NOT a pass — the UI must label it unverified.
    return { verdict: 'unknown', confidence: 0, checks: [], requiresRegeneration: false };
  }

  const checks: ConsistencyCheck[] = [];

  const baseCloseness = colourCloseness(spec.colour.hex, evidence.dominantHex);
  checks.push({
    key: 'base_colour',
    passed: baseCloseness >= 0.82,
    detail: `expected ${spec.colour.hex}, observed ${evidence.dominantHex}`,
    weight: 0.34,
  });

  if (spec.embroidery) {
    const wanted = spec.embroidery.channels.map((c) => c.hex);
    const matched = wanted.filter((w) =>
      evidence.embroideryHexes.some((o) => colourCloseness(w, o) >= 0.75),
    ).length;
    checks.push({
      key: 'thread_colours',
      passed: matched >= Math.ceil(wanted.length * 0.6),
      detail: `${matched}/${wanted.length} thread colours present`,
      weight: 0.26,
    });
  }

  checks.push({
    key: 'furakha',
    passed: evidence.furakhaDetected === Boolean(spec.furakha),
    detail: spec.furakha ? 'furakha expected' : 'no furakha expected',
    weight: 0.16,
  });

  // A dishdasha is far taller than it is wide; anything squarer is a different
  // garment.
  const silhouetteOk = evidence.aspectRatio >= 1.45 && evidence.aspectRatio <= 2.6;
  checks.push({
    key: 'silhouette',
    passed: silhouetteOk,
    detail: `aspect ${evidence.aspectRatio.toFixed(2)}`,
    weight: 0.14,
  });

  // Collarless is THE defining characteristic. A detected collar means the
  // model produced a different regional garment.
  checks.push({
    key: 'collarless',
    passed: !evidence.collarDetected,
    detail: evidence.collarDetected ? 'collar detected — not an Omani dishdasha' : 'collarless',
    weight: 0.10,
  });

  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  const confidence = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0) / (total || 1);
  const collarFailed = checks.find((c) => c.key === 'collarless')?.passed === false;

  return {
    verdict: confidence >= 0.75 && !collarFailed ? 'ok' : 'poor',
    confidence,
    checks,
    requiresRegeneration: confidence < 0.75 || collarFailed,
  };
};

/**
 * Evidence derived from our own renderer, for MOCK_AI_MODE. Honest about what
 * it is: the vector engine draws exactly the spec, so this agrees by
 * construction and proves the wiring, not the model.
 */
export const evidenceFromOwnRenderer = (spec: GarmentSpec): ImageEvidence => ({
  dominantHex: spec.colour.hex,
  embroideryHexes: spec.embroidery?.channels.map((c) => c.hex) ?? [],
  furakhaDetected: Boolean(spec.furakha),
  aspectRatio: 1.9,
  collarDetected: false,
});
