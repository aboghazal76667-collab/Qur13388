/**
 * GARMENT RENDERER CONTRACT.
 *
 * The application talks to THIS interface and never to a rendering library.
 * That is the whole point of V3: today the garment is drawn by the V2 vector
 * engine, tomorrow by a real 3D mesh, and the studio, cart, review, compare
 * and tailor screens do not change either way.
 *
 * Implementations:
 *   Real3DRenderer      three.js + a real GLB mesh          (PRIMARY)
 *   V2FallbackRenderer  the parametric 2.5D vector engine   (FALLBACK)
 */
import type { DesignConfig, FabricTexture, MeasurementProfile } from '@dd/domain/types';
import type { GarmentSpec } from '@dd/services/ai/photorealistic';
import type { AssetManifest } from './assetManifest';
import type { CameraPresetId } from './cameraPresets';
import type { RenderTier } from './quality3d';

export type RendererKind = 'real3d' | 'v2fallback';

/** Why a renderer was chosen. Surfaced in the dev inspector, never to customers. */
export type RendererSelectionReason =
  | 'asset_available'
  | 'no_professional_asset'
  | 'webgl_unavailable'
  | 'asset_load_failed'
  | 'forced_by_flag'
  | 'low_power_device';

export type RendererCapabilities = {
  /** True only for a real mesh: one geometry seen from many camera angles. */
  trueMesh: boolean;
  continuousRotation: boolean;
  pinchZoom: boolean;
  /** Can produce a raster image of the current view. */
  capturePreview: boolean;
  perMaterialTextures: boolean;
  realLighting: boolean;
};

export type LoadResult =
  | { ok: true; manifest: AssetManifest }
  | { ok: false; reason: string };

export type ViewState = {
  /** Degrees. 0 = front, 90 = side, 180 = back. Continuous. */
  azimuth: number;
  /** Degrees above the horizon. Clamped to a flattering product range. */
  elevation: number;
  /** 1 = default framing. */
  zoom: number;
};

/**
 * The imperative surface every renderer implements.
 *
 * Deliberately imperative rather than declarative: a GL renderer owns a
 * long-lived scene graph, and rebuilding it from props on every colour tap
 * would be both slow and wrong.
 */
export interface GarmentRenderer {
  readonly kind: RendererKind;
  readonly capabilities: RendererCapabilities;

  /** Loads a garment asset. Fallback renderers accept a null asset. */
  loadGarment(assetUri: string | null, manifest: AssetManifest | null): Promise<LoadResult>;

  /**
   * Applies the ONE source of truth. Every other setter below is a fast path
   * for a single change; this is the full, authoritative application.
   */
  applyGarmentSpec(spec: GarmentSpec): void;

  /** `texture` is a FabricTexture id from the catalogue, e.g. 'sateen'. */
  setFabric(texture: FabricTexture): void;
  setFabricColor(hex: string): void;
  setEmbroidery(patternId: string | null): void;
  /**
   * channel is 1-based, matching the embroidery catalogue. `metallic` is part
   * of the thread's identity, not a colour: a gold thread must not render as
   * mustard cotton.
   */
  setEmbroideryThread(channel: 1 | 2 | 3, hex: string, metallic?: boolean): void;
  setFurakha(config: { lengthMm: number; hex: string } | null): void;

  setCamera(preset: CameraPresetId): void;
  rotate(deltaAzimuthDeg: number): void;
  zoom(scale: number): void;
  getViewState(): ViewState;
  setTier(tier: RenderTier): void;

  /** Raster of the current view, for the photorealistic provider's inputs. */
  capturePreview(): Promise<string | null>;

  dispose(): void;
}

/** What the adapter hands to a viewer component. */
export type RendererSelection = {
  kind: RendererKind;
  reason: RendererSelectionReason;
  assetUri: string | null;
  manifest: AssetManifest | null;
};

/** Inputs a viewer needs regardless of which renderer serves it. */
export type GarmentViewInput = {
  config: DesignConfig;
  measurement: MeasurementProfile | null;
  spec: GarmentSpec;
};
