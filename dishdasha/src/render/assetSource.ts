/**
 * ASSET SOURCE RESOLUTION.
 *
 * The registry names an asset with a stable id; this module turns that id into
 * something GLTFLoader can fetch. Kept separate for two reasons:
 *
 *   1. `require()` of a .glb only works inside a Metro bundle. The registry is
 *      imported by the test harness, which runs under plain Node — so the
 *      binary must never be reached at module scope.
 *   2. Swapping the prototype for a professional GLB, or moving it to a CDN,
 *      is a change here and nowhere else.
 *
 * Platform behaviour:
 *   web     the bundler hands back a URL (a data: URI in the standalone build)
 *   native  expo-asset downloads the file and gives us a local file:// URI
 */

/** Stable ids the registry may point at. */
export type AssetSourceId = 'omani_dishdasha_prototype_v1';

/**
 * Guarded module lookup. A bare `require` of a binary throws outside Metro,
 * and that must degrade to the fallback rather than crash the screen.
 */
const bundledModule = (id: AssetSourceId): number | string | null => {
  try {
    switch (id) {
      case 'omani_dishdasha_prototype_v1':
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('../../assets/models/omani-dishdasha-prototype-v1.glb');
      default:
        return null;
    }
  } catch {
    return null;
  }
};

const expoAsset = (): typeof import('expo-asset') | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-asset') as typeof import('expo-asset');
  } catch {
    return null;
  }
};

/**
 * Resolves a registry uri to a loadable address, or null when it cannot be
 * reached. Null is a normal outcome — the caller falls back to V2.
 */
export const resolveAssetUri = async (uri: string): Promise<string | null> => {
  if (!uri.startsWith('bundled:')) return uri;

  const id = uri.slice('bundled:'.length) as AssetSourceId;
  const module = bundledModule(id);
  if (module === null) return null;

  // Web: the bundler already resolved it to a URL string.
  if (typeof module === 'string') return module;

  const assets = expoAsset();
  if (!assets) return null;

  const asset = assets.Asset.fromModule(module);
  if (!asset.localUri && !asset.uri) return null;
  if (!asset.downloaded) {
    try {
      await asset.downloadAsync();
    } catch {
      // Fall through to whatever uri we already have.
    }
  }
  return asset.localUri ?? asset.uri ?? null;
};
