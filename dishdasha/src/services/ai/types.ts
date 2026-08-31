/**
 * AI SERVICE BOUNDARIES.
 *
 * UI components never call an AI provider. They call these interfaces, which
 * are implemented either by a mock (default) or by a server-backed adapter.
 * That keeps API keys off the device, makes every AI feature testable
 * offline, and lets providers be swapped without touching a screen.
 */
import type {
  AiGenerationLog,
  DesignConfig,
  Occasion,
  PaletteSuggestion,
  PreviewAsset,
  Season,
  StyleMemory,
} from '@dd/domain/types';

export type ProviderInfo = {
  name: string;
  model: string;
  /** False whenever results are simulated. Surfaced in dev docs and admin. */
  isLive: boolean;
};

export type ColorRecommendationRequest = {
  baseColorId?: string | null;
  occasion: Occasion;
  season: Season;
  timeOfDay: 'day' | 'evening';
  channelCount: 1 | 2 | 3;
  memory: StyleMemory | null;
  ageRange?: string | null;
  inspirationHexes?: string[];
  count?: number;
};

export interface ColorRecommendationService {
  readonly info: ProviderInfo;
  recommend(req: ColorRecommendationRequest): Promise<PaletteSuggestion[]>;
}

export type ImageGenerationRequest = {
  config: DesignConfig;
  configHash: string;
  quality: 'low' | 'high';
  /** Only ever set when the customer explicitly opted into a try-on photo. */
  customerPhotoUri?: string | null;
};

export interface ImageGenerationService {
  readonly info: ProviderInfo;
  generate(req: ImageGenerationRequest): Promise<PreviewAsset>;
}

export type ExtractedPalette = {
  hexes: string[];
  dominant: string;
  /** Simulated extraction is flagged so the UI never overstates it. */
  isSimulated: boolean;
};

export interface ColorExtractionService {
  readonly info: ProviderInfo;
  extract(imageUri: string): Promise<ExtractedPalette>;
}

export type TryOnRequest = {
  config: DesignConfig;
  configHash: string;
  customerPhotoUri: string;
  consentAt: string;
};

export interface VirtualTryOnService {
  readonly info: ProviderInfo;
  /** Rejects when consent is missing — enforced at the service boundary. */
  render(req: TryOnRequest): Promise<PreviewAsset>;
}

export type MeasurementEstimate = {
  values: Record<string, number>;
  unit: 'cm' | 'in';
  confidence: number;
  /** Always true today: no production-ready camera measurement exists here. */
  requiresTailorVerification: boolean;
};

export interface MeasurementEstimationService {
  readonly info: ProviderInfo;
  readonly available: boolean;
  estimate(photoUris: string[], heightCm: number): Promise<MeasurementEstimate>;
}

/** Structured telemetry for every AI call. Never logs customer imagery. */
export interface AiTelemetrySink {
  record(log: AiGenerationLog): void;
  all(): AiGenerationLog[];
}
