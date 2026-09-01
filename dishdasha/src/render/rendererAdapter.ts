/**
 * RENDERER ADAPTER — chooses which engine draws the garment.
 *
 * The decision is deliberately conservative. A customer only reaches the 3D
 * path when EVERY condition holds:
 *
 *   1. a professional asset is registered for the style,
 *   2. its manifest validates,
 *   3. it passed the visual acceptance gate,
 *   4. it is approved for customers,
 *   5. the device can actually run WebGL.
 *
 * The registry is empty today, so condition 1 fails and every customer gets
 * the V2 fallback. That is the intended state: no visual regression, and the
 * 3D path proves itself before anyone sees it.
 */
import { customerReadyAsset, hasProfessionalAsset } from './assetRegistry';
import type { RendererSelection, RendererSelectionReason } from './types';

export type SelectionInput = {
  styleId: string;
  webglAvailable: boolean;
  lowPower?: boolean;
  /** DEV override so the 3D path can be exercised without shipping it. */
  force?: 'real3d' | 'v2fallback' | null;
};

export const selectRenderer = (input: SelectionInput): RendererSelection => {
  if (input.force === 'v2fallback') {
    return { kind: 'v2fallback', reason: 'forced_by_flag', assetUri: null, manifest: null };
  }

  const asset = customerReadyAsset(input.styleId);

  if (input.force === 'real3d') {
    return {
      kind: 'real3d',
      reason: 'forced_by_flag',
      assetUri: asset?.uri ?? null,
      manifest: asset?.manifest ?? null,
    };
  }

  if (!input.webglAvailable) {
    return { kind: 'v2fallback', reason: 'webgl_unavailable', assetUri: null, manifest: null };
  }
  if (input.lowPower) {
    return { kind: 'v2fallback', reason: 'low_power_device', assetUri: null, manifest: null };
  }
  if (!asset) {
    return {
      kind: 'v2fallback',
      reason: 'no_professional_asset',
      assetUri: null,
      manifest: null,
    };
  }

  return { kind: 'real3d', reason: 'asset_available', assetUri: asset.uri, manifest: asset.manifest };
};

/** Applied after a load attempt fails, so a bad asset degrades rather than breaks. */
export const fallbackAfterLoadFailure = (): RendererSelection => ({
  kind: 'v2fallback',
  reason: 'asset_load_failed',
  assetUri: null,
  manifest: null,
});

export const REASON_LABELS: Record<RendererSelectionReason, string> = {
  asset_available: 'Professional 3D asset loaded',
  no_professional_asset: 'No professional 3D asset registered — using V2 fallback',
  webgl_unavailable: 'WebGL unavailable on this device — using V2 fallback',
  asset_load_failed: 'GLB failed to load — using V2 fallback',
  forced_by_flag: 'Forced by developer flag',
  low_power_device: 'Low-power device — using V2 fallback',
};

export const professionalAssetAvailable = hasProfessionalAsset;
