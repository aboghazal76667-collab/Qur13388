import { ENV } from '@dd/config/env';
import { LocalColorExtractionService } from './colorExtraction';
import { LocalHarmonyStylist } from './mockColorRecommendation';
import { SimulatedPreviewProvider, SimulatedTryOnProvider } from './mockImageGeneration';
import { RemoteImageGenerationService, RemoteStylist } from './remote';
import {
  MockPhotorealisticProvider,
  RemotePhotorealisticProvider,
  type PhotorealisticDishdashaProvider,
} from './photorealistic';
import {
  MockVirtualTryOnProvider,
  RemoteVirtualTryOnProvider,
  type VirtualTryOnProvider,
} from './virtualTryOn';
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

// ── V2 services ─────────────────────────────────────────────────────────────
export const photorealisticProvider: PhotorealisticDishdashaProvider =
  ENV.MOCK_AI_MODE || !ENV.API_BASE_URL
    ? new MockPhotorealisticProvider()
    : new RemotePhotorealisticProvider(ENV.API_BASE_URL);

export const virtualTryOnProviderV2: VirtualTryOnProvider =
  ENV.MOCK_AI_MODE || !ENV.API_BASE_URL
    ? new MockVirtualTryOnProvider()
    : new RemoteVirtualTryOnProvider(ENV.API_BASE_URL);

export { stylistV2 } from './stylistV2';
export type { CompleteDesign, MatchLabel } from './stylistV2';
export { buildGarmentSpec, isSimulatedV2, clearPhotorealisticCache } from './photorealistic';
export type { GarmentSpec } from './photorealistic';
export { validateAgainstSpec, evidenceFromOwnRenderer } from './consistencyValidator';
export type { ConsistencyResult } from './consistencyValidator';
export { assessPhoto, isSimulatedTryOn } from './virtualTryOn';
export type { PhotoQuality, TryOnResult } from './virtualTryOn';

export * from './types';
export { aiTelemetry } from './telemetry';
export { isSimulatedUri, SIMULATED_URI_PREFIX, getCachedPreview } from './mockImageGeneration';
