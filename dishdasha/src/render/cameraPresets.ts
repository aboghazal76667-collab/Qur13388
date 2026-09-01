/**
 * CAMERA PRESETS — product photography, not a 3D inspector.
 *
 * Framing follows docs/OMANI_MASTER_VISUAL_REFERENCE.md: a long lens, the
 * garment filling most of the frame, a slight downward tilt on the full-length
 * views. A wide-angle lens would bow the hem outward and make the garment read
 * as a game asset rather than a catalogue photograph.
 */
export type CameraPresetId =
  | 'FRONT'
  | 'FRONT_45'
  | 'SIDE'
  | 'BACK'
  | 'DETAIL_NECK'
  | 'DETAIL_SHAQ'
  | 'DETAIL_CUFF'
  | 'DETAIL_FURAKHA';

export type CameraPreset = {
  id: CameraPresetId;
  azimuth: number;
  elevation: number;
  zoom: number;
  /**
   * Vertical framing target as a fraction of garment height from the hem:
   * 0.5 centres the whole garment, 0.9 frames the chest and neck.
   */
  targetHeight: number;
  /** Field of view in degrees. Long lens for full length, tighter for detail. */
  fov: number;
  isDetail: boolean;
};

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPreset> = {
  FRONT:     { id: 'FRONT',     azimuth: 0,   elevation: 4,  zoom: 1,    targetHeight: 0.52, fov: 26, isDetail: false },
  FRONT_45:  { id: 'FRONT_45',  azimuth: 45,  elevation: 4,  zoom: 1,    targetHeight: 0.52, fov: 26, isDetail: false },
  SIDE:      { id: 'SIDE',      azimuth: 90,  elevation: 4,  zoom: 1,    targetHeight: 0.52, fov: 26, isDetail: false },
  BACK:      { id: 'BACK',      azimuth: 180, elevation: 4,  zoom: 1,    targetHeight: 0.52, fov: 26, isDetail: false },
  DETAIL_NECK:    { id: 'DETAIL_NECK',    azimuth: 0,  elevation: 8,  zoom: 4.2, targetHeight: 0.93, fov: 30, isDetail: true },
  DETAIL_SHAQ:    { id: 'DETAIL_SHAQ',    azimuth: 0,  elevation: 2,  zoom: 3.6, targetHeight: 0.86, fov: 30, isDetail: true },
  DETAIL_CUFF:    { id: 'DETAIL_CUFF',    azimuth: 22, elevation: -2, zoom: 4.6, targetHeight: 0.55, fov: 30, isDetail: true },
  DETAIL_FURAKHA: { id: 'DETAIL_FURAKHA', azimuth: 0,  elevation: 2,  zoom: 4.8, targetHeight: 0.88, fov: 30, isDetail: true },
};

/** Presets a customer sees as buttons. Detail views come from the detail tab. */
export const CUSTOMER_PRESETS: CameraPresetId[] = ['FRONT', 'FRONT_45', 'SIDE', 'BACK'];

/** Canonical views handed to the photorealistic provider to anchor generation. */
export const CANONICAL_PREVIEW_VIEWS: CameraPresetId[] = [
  'FRONT',
  'FRONT_45',
  'SIDE',
  'BACK',
  'DETAIL_SHAQ',
];

export const ZOOM_LIMITS = { min: 0.75, max: 6 } as const;

/** Elevation is clamped: looking up a garment's hem is never flattering. */
export const ELEVATION_LIMITS = { min: -8, max: 22 } as const;

export const clampZoom = (z: number) =>
  Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, z));

export const clampElevation = (e: number) =>
  Math.min(ELEVATION_LIMITS.max, Math.max(ELEVATION_LIMITS.min, e));

export const presetForAzimuth = (azimuth: number): CameraPresetId => {
  const a = ((azimuth % 360) + 360) % 360;
  const distance = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180);
  let best: CameraPresetId = 'FRONT';
  for (const id of CUSTOMER_PRESETS) {
    if (distance(a, CAMERA_PRESETS[id].azimuth) < distance(a, CAMERA_PRESETS[best].azimuth)) best = id;
  }
  return best;
};
