import { PixelReadinessAnalyzer } from './analyzer';
import type { ReadinessAnalyzer } from './types';

export * from './types';
export * from './collection';
export { PixelReadinessAnalyzer } from './analyzer';
export type { PhotoSignals } from './signals';

/**
 * The active analyser.
 *
 * Swapping in a server-side vision model is a new class and one line here. It
 * reports more capabilities as true, and the UI — which reads the flags rather
 * than assuming — starts showing face and body coverage without any screen
 * changing.
 */
let analyzer: ReadinessAnalyzer = new PixelReadinessAnalyzer();

export function setReadinessAnalyzer(next: ReadinessAnalyzer): void {
  analyzer = next;
}

export function readinessAnalyzer(): ReadinessAnalyzer {
  return analyzer;
}

/**
 * Below this we interrupt before spending a generation. It is a warning with a
 * "continue anyway" beside it, never a block: it is the parent's photograph and
 * their child, and there are reasons to proceed a score cannot see.
 */
export const readinessWarningThreshold = 55;
