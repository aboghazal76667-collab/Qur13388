/**
 * STUDIO LIGHTING RIG.
 *
 * Described as data, not as three.js objects, so the same rig can be built by
 * any renderer and is unit-testable.
 *
 * The brief from the master reference: soft key from the front-left, a gentle
 * fill to keep the shadow side readable, a subtle rim to separate the garment
 * from the background, and a soft contact shadow on the ground.
 *
 * The hard constraint is dynamic range. White cloth must keep its folds
 * instead of blowing out, and navy must keep them instead of crushing to
 * black — so key intensity is modest and fill is comparatively strong, which
 * is how garments are actually lit in a catalogue studio.
 */
export type LightSpec = {
  id: 'key' | 'fill' | 'rim' | 'ambient';
  kind: 'directional' | 'ambient';
  /** Position in metres relative to the garment centre, +Z toward the camera. */
  position?: { x: number; y: number; z: number };
  intensity: number;
  /** Slightly warm key, slightly cool fill — the standard studio pairing. */
  color: string;
  castShadow: boolean;
};

export const STUDIO_RIG: LightSpec[] = [
  {
    id: 'key',
    kind: 'directional',
    position: { x: -1.6, y: 2.4, z: 2.2 },
    // Deliberately not 1.0: white cloth clips before it shows a fold.
    intensity: 2.1,
    color: '#FFF6EA',
    castShadow: true,
  },
  {
    id: 'fill',
    kind: 'directional',
    position: { x: 2.2, y: 1.0, z: 1.4 },
    // Strong fill is what keeps navy from crushing on the shadow side.
    intensity: 1.15,
    color: '#EAF0F6',
    castShadow: false,
  },
  {
    id: 'rim',
    kind: 'directional',
    position: { x: 0.4, y: 1.8, z: -2.6 },
    intensity: 0.85,
    color: '#FFFFFF',
    castShadow: false,
  },
  {
    id: 'ambient',
    kind: 'ambient',
    intensity: 0.55,
    color: '#F3EEE6',
    castShadow: false,
  },
];

/** Warm neutral studio ground, matching the app's sand palette. */
export const STUDIO_BACKGROUND = {
  top: '#F4EFE6',
  bottom: '#E4DCCE',
  groundShadowOpacity: 0.26,
  groundShadowRadius: 0.55,
} as const;

/**
 * Exposure compensation per fabric lightness.
 *
 * A single exposure cannot serve both a white and a near-black garment. Pale
 * cloth is pulled down a little so highlights hold detail; dark cloth is
 * lifted so folds stay visible. This is the lighting-side counterpart to the
 * V2 shading ramp.
 */
export const exposureFor = (lightness: number): number => {
  if (lightness > 82) return 0.86;
  if (lightness > 60) return 0.95;
  if (lightness < 22) return 1.28;
  if (lightness < 40) return 1.14;
  return 1;
};

export const TONE_MAPPING = { kind: 'ACESFilmic' as const, baseExposure: 1.05 };
