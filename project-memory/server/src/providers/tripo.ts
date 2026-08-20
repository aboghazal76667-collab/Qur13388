import type {
  GenerateRequest,
  PrintabilityAssessment,
  ProviderCapabilities,
  ProviderJobStatus,
  ProviderResult,
  ThreeDProvider,
} from './types';

/**
 * TripoProvider.
 *
 * The second provider exists mostly to prove the first one is replaceable. If
 * adding this file had required changes anywhere else, the abstraction would
 * have been wrong.
 */

const API_BASE = 'https://api.tripo3d.ai/v2/openapi';
const ESTIMATED_COST_USD = 0.28;

interface TripoResponse {
  code?: number;
  data?: {
    task_id?: string;
    status?: string;
    progress?: number;
    output?: { pbr_model?: string; model?: string; rendered_image?: string };
  };
  message?: string;
}

export class TripoProvider implements ThreeDProvider {
  readonly key = 'tripo';

  readonly capabilities: ProviderCapabilities = {
    multiView: true,
    facialFidelity: 0.68,
    typicalDurationSeconds: 90,
    approxCostUsd: ESTIMATED_COST_USD,
    formats: ['glb'],
    printability: false,
  };

  constructor(private readonly apiKey: string | undefined) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  private async call(path: string, init: RequestInit = {}): Promise<TripoResponse> {
    if (!this.apiKey) throw new Error('tripo: no API key configured');

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
      throw new Error(`tripo ${response.status}: ${detail.slice(0, 400)}`);
    }

    const payload = (await response.json()) as TripoResponse;
    if (typeof payload.code === 'number' && payload.code !== 0) {
      throw new Error(`tripo error ${payload.code}: ${payload.message ?? ''}`);
    }
    return payload;
  }

  async generateFromImage(request: GenerateRequest): Promise<ProviderJobStatus> {
    const first = request.images[0];
    if (!first) throw new Error('tripo: no source image');

    const payload = await this.call('/task', {
      method: 'POST',
      body: JSON.stringify({
        type: 'image_to_model',
        file: { type: 'jpeg', url: first.url },
        ...(request.options ?? {}),
      }),
    });

    const providerJobId = payload.data?.task_id;
    if (!providerJobId) throw new Error('tripo: no task id returned');
    return { providerJobId, state: 'queued', progress: 0, errorCode: null, result: null };
  }

  async generateFromMultiView(request: GenerateRequest): Promise<ProviderJobStatus> {
    if (request.images.length <= 1) return this.generateFromImage(request);

    // Tripo's multiview endpoint expects a fixed [front, left, back, right]
    // slot order, with nulls for the angles we do not have.
    const slot = (view: string) => {
      const found = request.images.find((image) => image.view === view);
      return found ? { type: 'jpeg', url: found.url } : null;
    };

    const payload = await this.call('/task', {
      method: 'POST',
      body: JSON.stringify({
        type: 'multiview_to_model',
        files: [
          slot('front') ?? { type: 'jpeg', url: request.images[0]!.url },
          slot('left'),
          slot('back'),
          slot('right'),
        ],
        ...(request.options ?? {}),
      }),
    });

    const providerJobId = payload.data?.task_id;
    if (!providerJobId) throw new Error('tripo: no task id returned');
    return { providerJobId, state: 'queued', progress: 0, errorCode: null, result: null };
  }

  async checkStatus(providerJobId: string): Promise<ProviderJobStatus> {
    const payload = await this.call(`/task/${providerJobId}`);
    const data = payload.data ?? {};
    const progress = typeof data.progress === 'number' ? data.progress / 100 : 0;
    const status = (data.status ?? '').toLowerCase();

    if (status === 'failed' || status === 'cancelled' || status === 'banned') {
      return {
        providerJobId,
        state: 'failed',
        progress,
        errorCode: status === 'banned' ? 'provider_rejected_input' : 'provider_generation_failed',
        result: null,
      };
    }

    if (status !== 'success') {
      return {
        providerJobId,
        state: status === 'queued' ? 'queued' : 'running',
        progress,
        errorCode: null,
        result: null,
      };
    }

    const result: ProviderResult = {
      modelUrl: data.output?.pbr_model ?? data.output?.model ?? null,
      format: 'glb',
      previewImageUrl: data.output?.rendered_image ?? null,
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

  async analyzePrintability(): Promise<PrintabilityAssessment> {
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
