/**
 * RENDERER ADAPTER — chooses which engine draws the garment.
 *
 * Two doors lead to the 3D path, and they are not the same door:
 *
 *   PROFESSIONAL asset  registered, manifest valid against the full contract,
 *                       visual acceptance gate passed, approved. Nothing has
 *                       come through this door yet.
 *   PROTOTYPE asset     a real mesh registered as TEMPORARY_REAL_3D_PROTOTYPE.
 *                       Renders, and is labelled as a prototype everywhere it
 *                       is reported. This is the door in use today.
 *
 * Either way the device must be able to run WebGL, and any failure — no asset,
 * no WebGL, a low-power device, a GLB that will not load — lands on the V2
 * fallback rather than on a broken screen.
 */
import { hasProfessionalAsset, renderableAsset } from './assetRegistry';
import type { RendererSelection, RendererSelectionReason } from './types';

export type SelectionInput = {
  styleId: string;
  webglAvailable: boolean;
  lowPower?: boolean;
  /** DEV override so the 3D path can be exercised without shipping it. */
  force?: 'real3d' | 'v2fallback' | null;
};

export const selectRenderer = (input: SelectionInput): RendererSelection => {
  const none = (reason: RendererSelectionReason): RendererSelection => ({
    kind: 'v2fallback',
    reason,
    assetUri: null,
    manifest: null,
    assetQuality: null,
  });

  if (input.force === 'v2fallback') return none('forced_by_flag');

  const asset = renderableAsset(input.styleId);

  if (input.force === 'real3d') {
    return {
      kind: 'real3d',
      reason: 'forced_by_flag',
      assetUri: asset?.uri ?? null,
      manifest: asset?.manifest ?? null,
      assetQuality: asset?.quality ?? null,
    };
  }

  if (!input.webglAvailable) return none('webgl_unavailable');
  if (input.lowPower) return none('low_power_device');
  if (!asset) return none('no_professional_asset');

  return {
    kind: 'real3d',
    // The reason names what is actually loaded, so nothing downstream can
    // report a prototype as a professional asset.
    reason: asset.quality === 'PROFESSIONAL' ? 'asset_available' : 'prototype_asset',
    assetUri: asset.uri,
    manifest: asset.manifest,
    assetQuality: asset.quality,
  };
};

/** Applied after a load attempt fails, so a bad asset degrades rather than breaks. */
export const fallbackAfterLoadFailure = (): RendererSelection => ({
  kind: 'v2fallback',
  reason: 'asset_load_failed',
  assetUri: null,
  manifest: null,
  assetQuality: null,
});

export const REASON_LABELS: Record<RendererSelectionReason, string> = {
  asset_available: 'Professional 3D asset loaded',
  prototype_asset: 'Temporary real-3D prototype loaded — not a professional asset',
  no_professional_asset: 'No professional 3D asset registered — using V2 fallback',
  webgl_unavailable: 'WebGL unavailable on this device — using V2 fallback',
  asset_load_failed: 'GLB failed to load — using V2 fallback',
  forced_by_flag: 'Forced by developer flag',
  low_power_device: 'Low-power device — using V2 fallback',
};

export const professionalAssetAvailable = hasProfessionalAsset;
