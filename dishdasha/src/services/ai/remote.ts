import type { PaletteSuggestion, PreviewAsset } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import type {
  ColorRecommendationRequest,
  ColorRecommendationService,
  ImageGenerationRequest,
  ImageGenerationService,
  ProviderInfo,
} from './types';
import { withTelemetry } from './telemetry';

/**
 * REMOTE ADAPTERS — production shape, not yet pointed at a live backend.
 *
 * They talk to OUR server (Supabase Edge Function or Node API), never to a
 * vendor directly: the vendor key stays server-side, the server does the
 * rate limiting and cost accounting, and the client only ever sends a design
 * configuration.
 *
 * These are compiled and typechecked but inactive while MOCK_AI_MODE is on.
 * They are NOT verified against a live endpoint yet — see README.
 */
const postJson = async <T>(url: string, body: unknown, timeoutMs = 30000): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`upstream responded ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
};

export class RemoteStylist implements ColorRecommendationService {
  readonly info: ProviderInfo = {
    name: 'remote-stylist',
    model: 'server-configured',
    isLive: true,
  };

  constructor(private readonly baseUrl: string) {}

  async recommend(req: ColorRecommendationRequest): Promise<PaletteSuggestion[]> {
    return withTelemetry(
      {
        kind: 'palette',
        provider: this.info.name,
        model: this.info.model,
        inputHash: `${req.occasion}:${req.season}:${req.baseColorId ?? 'any'}`,
        // Real cost accounting is reported by the server; this is the client
        // estimate used for local budget warnings.
        estimatedCost: 0.002,
      },
      async () => {
        const data = await postJson<{ suggestions: PaletteSuggestion[] }>(
          `${this.baseUrl}/ai/stylist`,
          {
            occasion: req.occasion,
            season: req.season,
            timeOfDay: req.timeOfDay,
            baseColorId: req.baseColorId ?? null,
            channelCount: req.channelCount,
            // Aggregated preferences only — no identifiers, no photos.
            preferences: req.memory
              ? {
                  colors: req.memory.favoriteColorIds,
                  threads: req.memory.favoriteThreadColorIds,
                  intensity: req.memory.embroideryIntensity,
                }
              : null,
            inspirationHexes: req.inspirationHexes ?? [],
            count: req.count ?? 5,
          },
        );
        return data.suggestions.map((s) => ({ ...s, id: s.id || uuid(), source: 'llm' as const }));
      },
    );
  }
}

export class RemoteImageGenerationService implements ImageGenerationService {
  readonly info: ProviderInfo = {
    name: 'remote-image',
    model: 'server-configured',
    isLive: true,
  };

  constructor(private readonly baseUrl: string) {}

  async generate(req: ImageGenerationRequest): Promise<PreviewAsset> {
    return withTelemetry(
      {
        kind: 'preview',
        provider: this.info.name,
        model: this.info.model,
        inputHash: req.configHash,
        estimatedCost: req.quality === 'high' ? 0.04 : 0.01,
      },
      async () => {
        const data = await postJson<{ url: string }>(`${this.baseUrl}/ai/preview`, {
          config: req.config,
          configHash: req.configHash,
          quality: req.quality,
          // The server decides whether a try-on photo may be used, and only
          // after verifying stored consent.
          hasCustomerPhoto: Boolean(req.customerPhotoUri),
        });
        return {
          id: uuid(),
          designHash: req.configHash,
          uri: data.url,
          quality: req.quality,
          isSimulated: false,
          createdAt: nowIso(),
        };
      },
    );
  }
}
