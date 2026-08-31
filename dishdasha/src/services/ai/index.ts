import { ENV } from '@dd/config/env';
import { LocalColorExtractionService } from './colorExtraction';
import { LocalHarmonyStylist } from './mockColorRecommendation';
import { SimulatedPreviewProvider, SimulatedTryOnProvider } from './mockImageGeneration';
import { RemoteImageGenerationService, RemoteStylist } from './remote';
import type {
  ColorExtractionService,
  ColorRecommendationService,
  ImageGenerationService,
  VirtualTryOnService,
} from './types';

/**
 * AI PROVIDER REGISTRY.
 *
 * The single place a provider is chosen. Screens import these constants and
 * never construct a provider themselves, so swapping a vendor is a change
 * here and nowhere else.
 *
 * With MOCK_AI_MODE on (the default) everything runs locally and free.
 * With it off, the remote adapters call OUR backend, which holds the vendor
 * keys — the mobile client never sees a secret.
 */
export const colorRecommendationService: ColorRecommendationService =
  // The harmony engine is genuinely the intended production candidate
  // generator; the remote adapter adds LLM ranking and explanations on top.
  ENV.MOCK_AI_MODE || !ENV.API_BASE_URL
    ? new LocalHarmonyStylist()
    : new RemoteStylist(ENV.API_BASE_URL);

export const imageGenerationService: ImageGenerationService =
  ENV.MOCK_AI_MODE || !ENV.API_BASE_URL
    ? new SimulatedPreviewProvider()
    : new RemoteImageGenerationService(ENV.API_BASE_URL);

export const virtualTryOnService: VirtualTryOnService = new SimulatedTryOnProvider();

export const colorExtractionService: ColorExtractionService =
  new LocalColorExtractionService();

export * from './types';
export { aiTelemetry } from './telemetry';
export { isSimulatedUri, SIMULATED_URI_PREFIX, getCachedPreview } from './mockImageGeneration';
