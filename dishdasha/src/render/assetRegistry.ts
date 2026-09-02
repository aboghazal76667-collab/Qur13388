/**
 * GARMENT ASSET REGISTRY.
 *
 * ===================================================================
 * NO PROFESSIONAL 3D GARMENT ASSET EXISTS YET.
 *
 * What IS registered is a TEMPORARY_REAL_3D_PROTOTYPE: a real single-mesh
 * GLB supplied to prove the 3D pipeline end to end. It is not production
 * quality, is not an authenticated Omani garment, and is expected to be
 * thrown away when a garment artist delivers the real asset described in
 * docs/PROFESSIONAL_3D_ASSET_BRIEF.md.
 * ===================================================================
 *
 * `hasProfessionalAsset()` therefore still returns FALSE, and
 * `customerReadyAsset()` still returns null. Those two answers are what the
 * rest of the application — and every honest status report — depends on.
 * The prototype reaches the renderer through `renderableAsset()`, which is a
 * separate, explicitly labelled door.
 *
 * Replacing the prototype with a professional GLB is: drop the file in,
 * register it with quality PROFESSIONAL and a complete manifest, delete the
 * prototype entry. No screen, service or store changes.
 */
import type { AssetManifest, AssetQuality } from './assetManifest';
import { manifestIsUsable } from './assetManifest';
import { PROTOTYPE_MANIFEST } from './prototypeManifest';

export type RegisteredAsset = {
  /**
   * Where the GLB lives. `bundled:<id>` is resolved by assetSource.ts; any
   * other value is treated as a URL.
   */
  uri: string;
  manifest: AssetManifest;
  /** Mirrors manifest.assetQuality, kept here so selection can read it cheaply. */
  quality: AssetQuality;
  /** Only assets that passed the visual gate are served to customers. */
  approvedForCustomers: boolean;
  /** Shown in the developer inspector. Never shown to a customer. */
  label: string;
};

/**
 * Registered garment assets, keyed by Omani style id.
 *
 * Do not add a mesh here to make the 3D path "work" unless you are willing to
 * label its quality accurately. Anything that is not a garment artist's
 * production asset is TEMPORARY_REAL_3D_PROTOTYPE.
 */
export const GARMENT_ASSETS: Record<string, RegisteredAsset> = {
  om_standard: {
    uri: 'bundled:omani_dishdasha_prototype_v1',
    manifest: PROTOTYPE_MANIFEST,
    quality: 'TEMPORARY_REAL_3D_PROTOTYPE',
    // Approved to RENDER, which for a prototype is all this flag can mean.
    // customerReadyAsset() ignores it, because that gate is about professional
    // assets and this asset is not one.
    approvedForCustomers: false,
    label: 'Temporary real-3D prototype (single fused mesh, baked texture)',
  },
};

export const getAssetForStyle = (styleId: string): RegisteredAsset | null =>
  GARMENT_ASSETS[styleId] ?? null;

/**
 * An asset is only "customer ready" when it is a PROFESSIONAL asset, its
 * manifest validates against the full contract, it passed the visual
 * acceptance gate, and it is approved. A prototype never qualifies, whatever
 * flags are set on it.
 */
export const customerReadyAsset = (styleId: string): RegisteredAsset | null => {
  const asset = getAssetForStyle(styleId);
  if (!asset) return null;
  if (asset.quality !== 'PROFESSIONAL') return null;
  if (!asset.approvedForCustomers) return null;
  if (!asset.manifest.visuallyAccepted) return null;
  if (!manifestIsUsable(asset.manifest)) return null;
  return asset;
};

/**
 * The asset the renderer should actually load: a professional one when it
 * exists, otherwise a prototype whose manifest at least loads.
 *
 * This is deliberately a different function from `customerReadyAsset` rather
 * than a relaxation of it. Anything that reports on product readiness must
 * keep asking the strict question.
 */
export const renderableAsset = (styleId: string): RegisteredAsset | null => {
  const professional = customerReadyAsset(styleId);
  if (professional) return professional;

  const asset = getAssetForStyle(styleId);
  if (!asset) return null;
  if (asset.quality !== 'TEMPORARY_REAL_3D_PROTOTYPE') return null;
  if (!manifestIsUsable(asset.manifest)) return null;
  return asset;
};

/**
 * FALSE until a garment artist delivers. A prototype does not move this.
 */
export const hasProfessionalAsset = (): boolean =>
  Object.values(GARMENT_ASSETS).some((a) => a.quality === 'PROFESSIONAL');

export const hasPrototypeAsset = (): boolean =>
  Object.values(GARMENT_ASSETS).some((a) => a.quality === 'TEMPORARY_REAL_3D_PROTOTYPE');
