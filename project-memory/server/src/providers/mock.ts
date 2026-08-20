import type {
  GenerateRequest,
  PrintabilityAssessment,
  ProviderCapabilities,
  ProviderJobStatus,
  ThreeDProvider,
} from './types';

/**
 * Mock3DProvider.
 *
 * The provider we run until the whole product path works on a phone. It exists
 * so that app problems and AI problems are never diagnosed at the same time:
 * if a memory fails to reach the timeline while this provider is active, the
 * bug is ours, not a model's.
 *
 * It is time-driven and stateless — given when a job started and the current
 * clock, it computes where that job should be. No queue, no timers, nothing to
 * leak, and a server restart does not lose a job.
 */

const DURATION_MS = 22_000;

interface MockJob {
  startedAt: number;
  attempt: number;
}

function seedUnit(seed: string, salt = ''): number {
  let hash = 2166136261;
  const input = `${seed}:${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

export class Mock3DProvider implements ThreeDProvider {
  readonly key = 'mock';

  readonly capabilities: ProviderCapabilities = {
    multiView: true,
    facialFidelity: 0.5,
    typicalDurationSeconds: DURATION_MS / 1000,
    approxCostUsd: 0,
    formats: ['glb'],
    printability: false,
  };

  private jobs = new Map<string, MockJob>();

  isConfigured(): boolean {
    // Always available. That is the point: the product must never be blocked
    // on a credential.
    return true;
  }

  private start(request: GenerateRequest): ProviderJobStatus {
    const providerJobId = `mock_${request.jobId}`;
    this.jobs.set(providerJobId, { startedAt: Date.now(), attempt: 1 });
    return { providerJobId, state: 'queued', progress: 0, errorCode: null, result: null };
  }

  async generateFromImage(request: GenerateRequest): Promise<ProviderJobStatus> {
    return this.start(request);
  }

  async generateFromMultiView(request: GenerateRequest): Promise<ProviderJobStatus> {
    return this.start(request);
  }

  async checkStatus(providerJobId: string): Promise<ProviderJobStatus> {
    const job = this.jobs.get(providerJobId);
    if (!job) {
      // A restart loses the map. Rather than reporting a failure the parent
      // did not cause, treat an unknown job as freshly started.
      this.jobs.set(providerJobId, { startedAt: Date.now(), attempt: 1 });
      return { providerJobId, state: 'queued', progress: 0, errorCode: null, result: null };
    }

    const jitter = 0.85 + seedUnit(providerJobId, 'speed') * 0.4;
    const fraction = Math.min(1, (Date.now() - job.startedAt) / (DURATION_MS * jitter));

    // Roughly one first attempt in twelve fails on purpose. A demo where
    // nothing ever fails teaches us nothing about the recovery path, and the
    // recovery path is what stops a parent thinking their photos were lost.
    const shouldFail = job.attempt === 1 && seedUnit(providerJobId, 'fail') < 0.08;
    if (shouldFail && fraction >= 0.45) {
      return {
        providerJobId,
        state: 'failed',
        progress: 0.45,
        errorCode: 'provider_generation_failed',
        result: null,
      };
    }

    if (fraction < 1) {
      return {
        providerJobId,
        state: fraction < 0.1 ? 'queued' : 'running',
        progress: fraction,
        errorCode: null,
        result: null,
      };
    }

    return {
      providerJobId,
      state: 'succeeded',
      progress: 1,
      errorCode: null,
      result: {
        // No file is produced. The app draws its demo preview from the seed,
        // which is more honest than serving a stock render as if it were a
        // likeness of somebody's child.
        modelUrl: null,
        format: 'glb',
        previewImageUrl: null,
        turntableUrls: [],
        polycount: 40_000 + Math.round(seedUnit(providerJobId, 'poly') * 60_000),
        creditsUsed: 0,
        estimatedCostUsd: 0,
      },
    };
  }

  async downloadModel(): Promise<string | null> {
    return null;
  }

  async analyzePrintability(): Promise<PrintabilityAssessment> {
    // Even the mock refuses to claim a model is printable. Fabricating a green
    // tick here would put a fake check in front of a physical product, which
    // is the one place a mock must not pretend.
    return {
      isWatertight: false,
      hasThinFeatures: false,
      estimatedHeightMm: null,
      wallThicknessMm: null,
      warnings: ['printability_not_assessed'],
      score: 0,
    };
  }
}
