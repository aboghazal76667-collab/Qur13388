/**
 * V2FallbackRenderer.
 *
 * Wraps the V2 parametric 2.5D vector engine behind the V3 GarmentRenderer
 * contract. The V2 engine is NOT deleted or degraded — it is a working,
 * tested, shipping renderer and it stays the customer-facing path until a
 * professional 3D asset is accepted.
 *
 * It serves four cases: no professional asset registered (today's state),
 * WebGL unavailable, GLB load failure, and low-power devices.
 *
 * Being a React component tree rather than an imperative GL scene, this class
 * holds the state the viewer component reads. Its `capabilities` report
 * `trueMesh: false` so nothing in the app can mistake it for real 3D.
 */
import type { FabricTexture } from '@dd/domain/types';
import type { GarmentSpec } from '@dd/services/ai/photorealistic';
import { CAMERA_PRESETS, clampZoom, type CameraPresetId } from '../cameraPresets';
import type { RenderTier } from '../quality3d';
import type {
  GarmentRenderer,
  LoadResult,
  RendererCapabilities,
  ViewState,
} from '../types';

/** State the viewer component reads to drive DishdashaVisualEngineV2. */
export type FallbackState = {
  spec: GarmentSpec | null;
  view: ViewState;
  tier: RenderTier;
};

export class V2FallbackRenderer implements GarmentRenderer {
  readonly kind = 'v2fallback' as const;

  readonly capabilities: RendererCapabilities = {
    // Honest: this is a parametric projection, not a mesh.
    trueMesh: false,
    continuousRotation: true,
    pinchZoom: false,
    capturePreview: false,
    perMaterialTextures: false,
    realLighting: false,
  };

  private state: FallbackState = {
    spec: null,
    view: { azimuth: 0, elevation: 0, zoom: 1 },
    tier: 'BALANCED',
  };

  private listeners = new Set<(state: FallbackState) => void>();

  subscribe(listener: (state: FallbackState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): FallbackState {
    return this.state;
  }

  private emit() {
    this.state = { ...this.state };
    for (const listener of this.listeners) listener(this.state);
  }

  async loadGarment(): Promise<LoadResult> {
    // The vector engine needs no asset: its geometry is code.
    return { ok: true, manifest: null as never };
  }

  applyGarmentSpec(spec: GarmentSpec): void {
    this.state.spec = spec;
    this.emit();
  }

  // The vector engine derives everything from the spec, so the fast-path
  // setters exist to satisfy the contract and simply re-emit. The studio
  // always re-applies a full spec, so nothing is lost.
  setFabric(_texture: FabricTexture): void {
    this.emit();
  }
  setFabricColor(_hex: string): void {
    this.emit();
  }
  setEmbroidery(_patternId: string | null): void {
    this.emit();
  }
  setEmbroideryThread(_channel: 1 | 2 | 3, _hex: string, _metallic?: boolean): void {
    this.emit();
  }
  setFurakha(_config: { lengthMm: number; hex: string } | null): void {
    this.emit();
  }

  setCamera(preset: CameraPresetId): void {
    const p = CAMERA_PRESETS[preset];
    this.state.view = { azimuth: p.azimuth, elevation: 0, zoom: p.zoom };
    this.emit();
  }

  rotate(deltaAzimuthDeg: number): void {
    this.state.view.azimuth = ((this.state.view.azimuth + deltaAzimuthDeg) % 360 + 360) % 360;
    this.emit();
  }

  zoom(scale: number): void {
    this.state.view.zoom = clampZoom(this.state.view.zoom * scale);
    this.emit();
  }

  getViewState(): ViewState {
    return { ...this.state.view };
  }

  setTier(tier: RenderTier): void {
    this.state.tier = tier;
    this.emit();
  }

  async capturePreview(): Promise<string | null> {
    // The vector engine draws through react-native-svg; there is no raster
    // buffer to read back. Reported honestly rather than returning a blank.
    return null;
  }

  dispose(): void {
    this.listeners.clear();
  }
}
