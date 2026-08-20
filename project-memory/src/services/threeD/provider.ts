/**
 * The 3D provider contract.
 *
 * Project Memory must never be structurally dependent on one AI vendor. Every
 * provider — Meshy, Tripo, a self-hosted Hunyuan3D, whatever comes next —
 * implements this interface, and the router picks between them. Swapping
 * providers is a configuration change; it must never be a UI change.
 *
 * This file is shared, by intent, between the mobile app and the server. The
 * app uses the *types*; only the server ever holds an API key or implements a
 * real provider.
 */

export type ProviderKey = 'mock' | 'meshy' | 'tripo' | string;

export interface SourceImage {
  /** A URL the provider can fetch, or a data URI. */
  url: string;
  /** Tells multi-view-capable providers how to interpret each image. */
  view: 'front' | 'back' | 'left' | 'right' | 'three_quarter' | 'full_body' | 'unspecified';
}

export interface GenerateRequest {
  /** Our job id, echoed back for correlation. */
  jobId: string;
  images: SourceImage[];
  /** Figurine style. Providers map this onto their own vocabulary. */
  style?: 'realistic' | 'stylised' | 'sculpture';
  /** Target print height, used later by the printability check. */
  targetHeightMm?: number;
  /** Provider-specific escape hatch; never required. */
  options?: Record<string, unknown>;
}

export type ProviderJobState = 'queued' | 'running' | 'succeeded' | 'failed';

export interface ProviderJobStatus {
  providerJobId: string;
  state: ProviderJobState;
  /** 0–1. Providers that do not report progress return a coarse estimate. */
  progress: number;
  /** Machine-readable; the app maps it to friendly copy. */
  errorCode: string | null;
  /** Set once `state` is `succeeded`. */
  result: ProviderResult | null;
}

export interface ProviderResult {
  /** Preferred interactive format. */
  modelUrl: string | null;
  format: 'glb' | 'obj' | 'stl' | '3mf';
  /** A still render the phone can show cheaply. */
  previewImageUrl: string | null;
  /** Optional turntable frames for a drag-to-rotate preview. */
  turntableUrls: string[];
  polycount: number | null;
  /** What this call cost us, for the cost ledger. */
  creditsUsed: number | null;
  estimatedCostUsd: number | null;
}

export interface PrintabilityAssessment {
  isWatertight: boolean;
  hasThinFeatures: boolean;
  estimatedHeightMm: number | null;
  wallThicknessMm: number | null;
  warnings: string[];
  score: number;
}

export interface ProviderCapabilities {
  /** Can it use several photos of the same child in one reconstruction? */
  multiView: boolean;
  /** Rough facial likeness quality, 0–1. Feeds future router scoring. */
  facialFidelity: number;
  /** Typical wall-clock seconds for one generation. */
  typicalDurationSeconds: number;
  /** Rough cost per generation in USD. */
  approxCostUsd: number;
  formats: ProviderResult['format'][];
  /** Can it assess printability itself, or do we need our own pass? */
  printability: boolean;
}

export interface ThreeDProvider {
  readonly key: ProviderKey;
  readonly capabilities: ProviderCapabilities;
  /** False when credentials are missing, so the router can skip it. */
  isConfigured(): boolean;

  generateFromImage(request: GenerateRequest): Promise<ProviderJobStatus>;
  generateFromMultiView(request: GenerateRequest): Promise<ProviderJobStatus>;
  checkStatus(providerJobId: string): Promise<ProviderJobStatus>;
  /** Returns a URL our storage layer can copy from. */
  downloadModel(providerJobId: string, format?: ProviderResult['format']): Promise<string | null>;
  analyzePrintability(modelUrl: string): Promise<PrintabilityAssessment>;
}
