import type {
  GenerateRequest,
  PrintabilityAssessment,
  ProviderCapabilities,
  ProviderJobStatus,
  ProviderResult,
  ThreeDProvider,
} from './types';

/**
 * MeshyProvider.
 *
 * The first real provider. Nothing outside this file knows Meshy exists — the
 * router picks a provider, the rest of the system talks to the interface. That
 * is what makes "switch to Tripo" a config change rather than a project.
 *
 * Connect this only once the mock path works end to end on a phone. Debugging
 * an upload bug and a model bug at the same time is how a small team loses a
 * week.
 */

/**
 * Overridable so the integration can be exercised end to end against a
 * stand-in server. Everything except the credential and the model itself is
 * then real code on a real socket, which is the only way to know the request
 * shape, the polling loop and the result mapping actually work before a key
 * exists.
 */
const API_BASE = process.env.MESHY_API_BASE ?? 'https://api.meshy.ai';

/**
 * Rough per-generation cost, used for the ledger until we have real invoices to
 * reconcile against. Wrong-but-recorded beats absent: it is the only way to
 * find out what a figurine actually costs us.
 */
const ESTIMATED_COST_USD = 0.35;

interface MeshyTaskResponse {
  result?: string;
  id?: string;
  status?: string;
  progress?: number;
  model_urls?: { glb?: string; obj?: string; usdz?: string; fbx?: string };
  thumbnail_url?: string;
  texture_urls?: { base_color?: string }[];
  task_error?: { message?: string };
}

export class MeshyProvider implements ThreeDProvider {
  readonly key = 'meshy';

  readonly capabilities: ProviderCapabilities = {
    multiView: true,
    facialFidelity: 0.72,
    typicalDurationSeconds: 120,
    approxCostUsd: ESTIMATED_COST_USD,
    formats: ['glb', 'obj'],
    printability: false,
  };

  /** Task ids created through the multi-image endpoint. */
  private readonly multiViewJobs = new Set<string>();

  constructor(private readonly apiKey: string | undefined) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.apiKey) throw new Error('meshy: no API key configured');

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // The message is for our logs. The parent sees a sentence about their
      // photos being safe, never this.
      throw new Error(`meshy ${response.status}: ${detail.slice(0, 400)}`);
    }
    return (await response.json()) as T;
  }

  async generateFromImage(request: GenerateRequest): Promise<ProviderJobStatus> {
    const first = request.images[0];
    if (!first) throw new Error('meshy: no source image');

    const payload = await this.call<MeshyTaskResponse>('/openapi/v1/image-to-3d', {
      method: 'POST',
      body: JSON.stringify({
        image_url: first.url,
        enable_pbr: true,
        should_remesh: true,
        should_texture: true,
        // A figurine is printed, so a watertight, moderate-poly mesh beats a
        // dense one we would have to repair anyway.
        target_polycount: 60_000,
        symmetry_mode: 'auto',
        ...(request.options ?? {}),
      }),
    });

    const providerJobId = payload.result ?? payload.id;
    if (!providerJobId) throw new Error('meshy: no task id returned');
    return { providerJobId, state: 'queued', progress: 0, errorCode: null, result: null };
  }

  async generateFromMultiView(request: GenerateRequest): Promise<ProviderJobStatus> {
    if (request.images.length <= 1) return this.generateFromImage(request);

    // Meshy's multi-image endpoint takes named views. Anything we cannot place
    // is sent as a front view rather than dropped — more angles beats fewer.
    const byView = (view: string) => request.images.find((image) => image.view === view)?.url;

    const payload = await this.call<MeshyTaskResponse>('/openapi/v1/multi-image-to-3d', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: request.images.map((image) => image.url),
        front_image_url: byView('front') ?? request.images[0]?.url,
        back_image_url: byView('back'),
        left_image_url: byView('left'),
        right_image_url: byView('right'),
        should_texture: true,
        target_polycount: 60_000,
        ...(request.options ?? {}),
      }),
    });

    const providerJobId = payload.result ?? payload.id;
    if (!providerJobId) throw new Error('meshy: no task id returned');
    this.multiViewJobs.add(providerJobId);
    return { providerJobId, state: 'queued', progress: 0, errorCode: null, result: null };
  }

  async checkStatus(providerJobId: string): Promise<ProviderJobStatus> {
    // Multi-image tasks are polled on their own endpoint; asking the wrong one
    // returns a 404 that would look like a failed generation.
    const path = this.multiViewJobs.has(providerJobId)
      ? `/openapi/v1/multi-image-to-3d/${providerJobId}`
      : `/openapi/v1/image-to-3d/${providerJobId}`;
    const task = await this.call<MeshyTaskResponse>(path);

    const progress = typeof task.progress === 'number' ? task.progress / 100 : 0;
    const status = (task.status ?? '').toUpperCase();

    if (status === 'FAILED' || status === 'CANCELED' || status === 'EXPIRED') {
      return {
        providerJobId,
        state: 'failed',
        progress,
        errorCode: task.task_error?.message ? 'provider_generation_failed' : 'provider_unavailable',
        result: null,
      };
    }

    if (status !== 'SUCCEEDED') {
      return {
        providerJobId,
        state: status === 'PENDING' ? 'queued' : 'running',
        progress,
        errorCode: null,
        result: null,
      };
    }

    const result: ProviderResult = {
      modelUrl: task.model_urls?.glb ?? task.model_urls?.obj ?? null,
      format: task.model_urls?.glb ? 'glb' : 'obj',
      previewImageUrl: task.thumbnail_url ?? null,
      turntableUrls: [],
      polycount: null,
      creditsUsed: null,
      estimatedCostUsd: ESTIMATED_COST_USD,
    };

    return { providerJobId, state: 'succeeded', progress: 1, errorCode: null, result };
  }

  async downloadModel(providerJobId: string): Promise<string | null> {
    const status = await this.checkStatus(providerJobId);
    return status.result?.modelUrl ?? null;
  }

  async analyzePrintability(modelUrl: string): Promise<PrintabilityAssessment> {
    // Meshy does not assess printability, so this is our own pass to write.
    // Returning a confident-looking report we did not compute would be worse
    // than saying we have not checked.
    void modelUrl;
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
