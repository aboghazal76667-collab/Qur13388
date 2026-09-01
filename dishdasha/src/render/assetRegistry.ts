/**
 * PROFESSIONAL GARMENT ASSET REGISTRY.
 *
 * ===================================================================
 * THIS REGISTRY IS EMPTY. NO PROFESSIONAL 3D GARMENT ASSET EXISTS YET.
 * ===================================================================
 *
 * That is a deliberate, honest state, not an oversight. A crude generated
 * mesh would look worse than the V2 vector garment and would misrepresent
 * the Omani dishdasha, so none was made. See
 * docs/PROFESSIONAL_3D_ASSET_BRIEF.md for the specification an artist needs.
 *
 * While this registry is empty the renderer adapter selects V2FallbackRenderer
 * for every customer, so there is zero visual regression. Registering a
 * validated GLB here — and nothing else in the application — switches
 * customers onto the real 3D path.
 */
import type { AssetManifest } from './assetManifest';
import { manifestIsUsable } from './assetManifest';

export type RegisteredAsset = {
  /** Where the GLB lives: a bundled require() id, or a remote URL. */
  uri: string;
  manifest: AssetManifest;
  /** Only assets that passed the visual gate are served to customers. */
  approvedForCustomers: boolean;
};

/**
 * Registered garment assets, keyed by Omani style id.
 *
 * Empty on purpose. Do not add a placeholder mesh to make the 3D path
 * "work" — that is precisely the failure mode this sprint was told to avoid.
 */
export const GARMENT_ASSETS: Record<string, RegisteredAsset> = {};

export const getAssetForStyle = (styleId: string): RegisteredAsset | null =>
  GARMENT_ASSETS[styleId] ?? null;

/**
 * An asset is only served to customers when it is registered, its manifest
 * validates, it passed the visual acceptance gate, and it is approved. Any
 * one of those failing sends the customer to the fallback.
 */
export const customerReadyAsset = (styleId: string): RegisteredAsset | null => {
  const asset = getAssetForStyle(styleId);
  if (!asset) return null;
  if (!asset.approvedForCustomers) return null;
  if (!asset.manifest.visuallyAccepted) return null;
  if (!manifestIsUsable(asset.manifest)) return null;
  return asset;
};

export const hasProfessionalAsset = (): boolean =>
  Object.keys(GARMENT_ASSETS).length > 0;
