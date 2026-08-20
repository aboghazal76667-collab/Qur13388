import type { PrintabilityReport, ThreeDJob, ThreeDJobStatus } from '@/domain';

import { generationPath } from './pipeline';

/**
 * Mock3DProvider — the in-app simulator.
 *
 * The point of the mock is separation of concerns: the founder can prove the
 * whole product path (create child → add photos → request a figurine → see a
 * result on the timeline) without a single AI credential. Only once that path
 * is solid do we connect Meshy, so that app bugs and model bugs never get
 * diagnosed at the same time.
 *
 * It is deliberately *time-driven and pure*: given a job's start time and the
 * current clock, it computes the state the job should be in. No timers to
 * leak, and the state survives the app being backgrounded or restarted.
 */

export const MOCK_PROVIDER_KEY = 'mock';

/** How long the simulated generation takes, end to end. */
export const MOCK_DURATION_MS = 22_000;

/** Fraction of the run each stage occupies. Sums to 1. */
const stageWeights: Record<string, number> = {
  uploaded: 0.08,
  image_checked: 0.12,
  generating: 0.5,
  raw_model_ready: 0.12,
  quality_review: 0.08,
  printability_check: 0.1,
};

export interface SimulatedState {
  status: ThreeDJobStatus;
  progress: number;
  done: boolean;
}

/**
 * Deterministic 0–1 from a job id, used to vary the simulation slightly per
 * job so consecutive demos do not look identical.
 */
export function seedUnit(seed: string, salt = ''): number {
  let hash = 2166136261;
  const input = `${seed}:${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

/**
 * Roughly 1 in 12 simulated jobs fails, on purpose.
 *
 * A demo where nothing ever fails teaches the team nothing about the failure
 * experience, and the retry path is one of the things we most need to get
 * right — a parent must never feel their photos were lost.
 */
export function willFail(jobId: string, attempt: number): boolean {
  // Retries always succeed, so a parent is never stuck in a loop.
  if (attempt > 1) return false;
  return seedUnit(jobId, 'fail') < 0.08;
}

export function simulate(job: Pick<ThreeDJob, 'id' | 'createdAt' | 'attempt'>, now: number): SimulatedState {
  const started = new Date(job.createdAt).getTime();
  const jitter = 0.85 + seedUnit(job.id, 'speed') * 0.4;
  const duration = MOCK_DURATION_MS * jitter;
  const elapsed = Math.max(0, now - started);
  const fraction = Math.min(1, elapsed / duration);

  if (willFail(job.id, job.attempt)) {
    // Fail partway through generation, where a real provider usually does.
    const failAt = 0.45;
    if (fraction >= failAt) {
      return { status: 'failed', progress: failAt, done: true };
    }
  }

  if (fraction >= 1) {
    return { status: 'approved', progress: 1, done: true };
  }

  let cumulative = 0;
  for (const status of generationPath) {
    const weight = stageWeights[status];
    if (weight === undefined) continue;
    if (fraction < cumulative + weight) {
      return { status, progress: fraction, done: false };
    }
    cumulative += weight;
  }

  return { status: 'approved', progress: 1, done: true };
}

/** A plausible printability report, derived from the job id so it is stable. */
export function mockPrintability(jobId: string): PrintabilityReport {
  const thin = seedUnit(jobId, 'thin') < 0.3;
  const height = 90 + Math.round(seedUnit(jobId, 'height') * 40);
  const warnings: string[] = [];
  if (thin) warnings.push('thin_features_at_wrists');

  return {
    isWatertight: true,
    hasThinFeatures: thin,
    estimatedHeightMm: height,
    wallThicknessMm: thin ? 1.1 : 2.4,
    warnings,
    score: thin ? 72 : 91,
  };
}

export function mockPolycount(jobId: string): number {
  return 40_000 + Math.round(seedUnit(jobId, 'poly') * 60_000);
}

/** What the simulated generation "cost", so the cost ledger has real shape. */
export function mockCostUsd(jobId: string): number {
  return Number((0.18 + seedUnit(jobId, 'cost') * 0.22).toFixed(3));
}
