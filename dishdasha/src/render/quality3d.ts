/**
 * RENDER TIERS for the 3D path.
 *
 * iPhone performance is a requirement, not an optimisation. Tiers change how
 * much the GPU is asked to do; they never change the garment, its colour or
 * its embroidery placement.
 *
 * Pure — no react-native import — so the tests run under plain Node and the
 * platform lookup stays with the caller.
 */
export type RenderTier = 'HIGH' | 'BALANCED' | 'LOW';

export type TierSettings = {
  /** Device pixel ratio cap. Retina at 3x on a full-screen canvas is wasteful. */
  maxPixelRatio: number;
  textureSize: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  environmentResolution: number;
  /** Anisotropic filtering, which matters for fabric seen at a glancing angle. */
  anisotropy: number;
};

export const TIER_SETTINGS: Record<RenderTier, TierSettings> = {
  HIGH:     { maxPixelRatio: 2.5, textureSize: 2048, shadows: true,  shadowMapSize: 1024, antialias: true,  environmentResolution: 256, anisotropy: 8 },
  BALANCED: { maxPixelRatio: 2,   textureSize: 1024, shadows: true,  shadowMapSize: 512,  antialias: true,  environmentResolution: 128, anisotropy: 4 },
  LOW:      { maxPixelRatio: 1.5, textureSize: 512,  shadows: false, shadowMapSize: 0,    antialias: false, environmentResolution: 64,  anisotropy: 1 },
};

/**
 * Picks a tier from what we can actually observe. Triangle count matters as
 * much as pixel ratio: a heavy mesh on a dense screen is the combination that
 * drops frames.
 */
export const resolveTier = (input: {
  pixelRatio: number;
  triangleCount: number;
  isDetailView: boolean;
  /** Set when the device reports limited memory or the user chose low power. */
  lowPower?: boolean;
}): RenderTier => {
  if (input.lowPower) return 'LOW';
  if (input.triangleCount > 120000) return input.isDetailView ? 'BALANCED' : 'LOW';
  if (input.pixelRatio >= 3 && input.triangleCount > 60000) return 'BALANCED';
  if (input.isDetailView) return 'HIGH';
  return input.pixelRatio > 2 ? 'BALANCED' : 'HIGH';
};

export const TIER_LABELS: Record<RenderTier, { ar: string; en: string }> = {
  HIGH: { ar: 'عالية', en: 'High' },
  BALANCED: { ar: 'متوازنة', en: 'Balanced' },
  LOW: { ar: 'خفيفة', en: 'Low' },
};
