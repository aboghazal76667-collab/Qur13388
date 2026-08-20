import { HeuristicPhotoQualityAnalyzer } from './heuristic';
import type { PhotoQualityAnalyzer } from './types';

export * from './types';
export { HeuristicPhotoQualityAnalyzer } from './heuristic';

/**
 * The active analyzer. Swapping in a real vision model is a one-line change
 * here plus a new class — no screen is aware of which one is running.
 */
let analyzer: PhotoQualityAnalyzer = new HeuristicPhotoQualityAnalyzer();

export function setPhotoQualityAnalyzer(next: PhotoQualityAnalyzer): void {
  analyzer = next;
}

export function photoQualityAnalyzer(): PhotoQualityAnalyzer {
  return analyzer;
}

/**
 * Below this, we interrupt the parent before spending a generation on a photo
 * that is unlikely to produce something they will like. They can always
 * continue anyway — it is a suggestion, not a gate.
 */
export const qualityWarningThreshold = 60;
