import type { PhotoQualityReport, QualityDimensionKey, QualityVerdict } from '@/domain';

export interface PhotoInput {
  /** Local file URI or remote URL. */
  uri: string;
  width?: number | null;
  height?: number | null;
  byteSize?: number | null;
  /** File name, when the picker supplied one. */
  fileName?: string | null;
}

/**
 * The seam that lets real computer vision replace the heuristic scorer.
 *
 * A future implementation runs a face/pose model on device or on our server
 * and fills in exactly the same shape, so nothing in the UI changes when it
 * lands. That is the whole reason this interface exists.
 */
export interface PhotoQualityAnalyzer {
  readonly id: string;
  readonly version: string;
  /** True when the analyzer inspects pixels rather than metadata. */
  readonly inspectsPixels: boolean;
  analyze(input: PhotoInput, assetId: string): Promise<PhotoQualityReport>;
}

export function verdictFor(score: number): QualityVerdict {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/** Dimensions rendered in the parent-facing panel, in display order. */
export const displayedDimensions: readonly QualityDimensionKey[] = [
  'face',
  'body',
  'lighting',
  'sharpness',
  'background',
  'framing',
];
