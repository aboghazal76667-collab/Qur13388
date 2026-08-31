import type { PreviewAsset } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import type {
  ImageGenerationRequest,
  ImageGenerationService,
  ProviderInfo,
  TryOnRequest,
  VirtualTryOnService,
} from './types';
import { withTelemetry } from './telemetry';

/**
 * SIMULATED PREVIEW PROVIDER (MOCK_AI_MODE).
 *
 * It does NOT produce an AI image and never pretends to. It returns a
 * `simulated:` URI that the preview component renders with the high-fidelity
 * vector renderer — deeper shading, folds and studio lighting than the live
 * configurator — and every asset carries `isSimulated: true`, which the UI
 * shows as an explicit badge.
 *
 * The real provider adapter implements the identical interface, so switching
 * to a hosted image model changes one line in the registry.
 */
export const SIMULATED_URI_PREFIX = 'simulated:v1:';

export const isSimulatedUri = (uri: string): boolean => uri.startsWith(SIMULATED_URI_PREFIX);

/** Cache keyed by design hash + quality: identical configs never re-render. */
const previewCache = new Map<string, PreviewAsset>();

export const cacheKey = (hash: string, quality: 'low' | 'high') => `${hash}:${quality}`;

export const getCachedPreview = (hash: string, quality: 'low' | 'high') =>
  previewCache.get(cacheKey(hash, quality));

export const clearPreviewCache = () => previewCache.clear();

export class SimulatedPreviewProvider implements ImageGenerationService {
  readonly info: ProviderInfo = {
    name: 'simulated-preview',
    model: 'vector-studio-v1',
    isLive: false,
  };

  async generate(req: ImageGenerationRequest): Promise<PreviewAsset> {
    const cached = getCachedPreview(req.configHash, req.quality);
    if (cached) return cached;

    return withTelemetry(
      {
        kind: 'preview',
        provider: this.info.name,
        model: this.info.model,
        // Only the design hash is logged, never the customer photo URI.
        inputHash: req.configHash,
        estimatedCost: 0,
      },
      async () => {
        // A short deliberate delay so the loading, retry and failure states of
        // the real provider are actually exercised in the demo.
        await new Promise((resolve) => setTimeout(resolve, req.quality === 'high' ? 1400 : 600));
        const asset: PreviewAsset = {
          id: uuid(),
          designHash: req.configHash,
          uri: `${SIMULATED_URI_PREFIX}${req.configHash}:${req.quality}`,
          quality: req.quality,
          isSimulated: true,
          createdAt: nowIso(),
        };
        previewCache.set(cacheKey(req.configHash, req.quality), asset);
        return asset;
      },
    );
  }
}

export class SimulatedTryOnProvider implements VirtualTryOnService {
  readonly info: ProviderInfo = {
    name: 'simulated-try-on',
    model: 'vector-studio-v1',
    isLive: false,
  };

  async render(req: TryOnRequest): Promise<PreviewAsset> {
    // Consent is enforced at the service boundary, not in the UI, so no screen
    // can accidentally skip it.
    if (!req.consentAt) throw new Error('try-on requires explicit consent');
    if (!req.customerPhotoUri) throw new Error('try-on requires a customer photo');

    return withTelemetry(
      {
        kind: 'try_on',
        provider: this.info.name,
        model: this.info.model,
        inputHash: req.configHash,
        estimatedCost: 0,
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return {
          id: uuid(),
          designHash: req.configHash,
          uri: `${SIMULATED_URI_PREFIX}${req.configHash}:tryon`,
          quality: 'high' as const,
          isSimulated: true,
          createdAt: nowIso(),
        };
      },
    );
  }
}
