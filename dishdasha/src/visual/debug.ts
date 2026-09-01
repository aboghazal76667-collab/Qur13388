/**
 * Development-only visual debugging.
 *
 * SHOW_PHYSICAL_EMBROIDERY_SCALE overlays a millimetre ruler on every
 * embroidery band so oversizing is caught by looking, not by arguing. It is
 * the direct countermeasure to the V1 regression and is compiled out of
 * production builds.
 */
import { ENV } from '@dd/config/env';

export const SHOW_PHYSICAL_EMBROIDERY_SCALE =
  __DEV__ && process.env.EXPO_PUBLIC_DEBUG_EMBROIDERY_SCALE === '1';

/** Draws garment landmark guides (shoulder line, centre front, hem). */
export const SHOW_GEOMETRY_GUIDES =
  __DEV__ && process.env.EXPO_PUBLIC_DEBUG_GEOMETRY === '1';

export const debugEnabled = (): boolean =>
  SHOW_PHYSICAL_EMBROIDERY_SCALE || SHOW_GEOMETRY_GUIDES;

/** Reported in the admin screen so the flags are discoverable. */
export const debugFlagSummary = () => ({
  embroideryScale: SHOW_PHYSICAL_EMBROIDERY_SCALE,
  geometryGuides: SHOW_GEOMETRY_GUIDES,
  demoMode: ENV.DEMO_MODE,
});
