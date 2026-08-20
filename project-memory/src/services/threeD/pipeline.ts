import type { ThreeDJobStatus } from '@/domain';

/**
 * The generation pipeline, expressed once.
 *
 * The customer sees five warm sentences; the system tracks fourteen states.
 * Keeping the mapping here means the progress screen never has to know what
 * `printability_check` is, and the admin panel never has to guess which stage
 * a family is looking at.
 */

/** The five stages a parent sees, by index into `strings.threeD.stages`. */
export const parentStageCount = 5;

const statusToStage: Record<ThreeDJobStatus, number> = {
  uploaded: 0,
  image_checked: 1,
  generating: 2,
  raw_model_ready: 3,
  quality_review: 3,
  printability_check: 4,
  approved: 4,
  print_ready: 4,
  ordered: 4,
  printing: 4,
  shipped: 4,
  delivered: 4,
  failed: 0,
};

export function stageIndexFor(status: ThreeDJobStatus): number {
  return statusToStage[status] ?? 0;
}

/** Progress the parent-facing bar should show for a status, before refinement. */
const statusFloorProgress: Record<ThreeDJobStatus, number> = {
  uploaded: 0.04,
  image_checked: 0.16,
  generating: 0.3,
  raw_model_ready: 0.78,
  quality_review: 0.84,
  printability_check: 0.92,
  approved: 0.97,
  print_ready: 1,
  ordered: 1,
  printing: 1,
  shipped: 1,
  delivered: 1,
  failed: 0,
};

export function floorProgressFor(status: ThreeDJobStatus): number {
  return statusFloorProgress[status] ?? 0;
}

/**
 * The happy path through the pipeline up to a previewable model. Anything
 * beyond `approved` is driven by manufacturing, not by generation.
 */
export const generationPath: readonly ThreeDJobStatus[] = [
  'uploaded',
  'image_checked',
  'generating',
  'raw_model_ready',
  'quality_review',
  'printability_check',
  'approved',
];

/**
 * True while a job has not yet reached an outcome the parent can act on.
 *
 * Deliberately keyed on `completedAt` rather than on the status: several
 * intermediate statuses (`raw_model_ready`, `quality_review`,
 * `printability_check`) are past generation but still before there is a model
 * to show, and treating those as "done" leaves the progress screen waiting
 * for a result that never arrives.
 */
export function isAwaitingResult(job: { status: ThreeDJobStatus; completedAt: string | null }): boolean {
  return job.completedAt === null && job.status !== 'failed';
}

export function isFailed(status: ThreeDJobStatus): boolean {
  return status === 'failed';
}
