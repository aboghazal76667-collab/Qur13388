/**
 * Bridges the existing embroidery catalogue to the V2 physical scale system.
 *
 * Deliberately additive: the catalogue keeps its shape, and patterns that have
 * not been physically measured get a conservative derived profile rather than
 * blocking. As tailors supply real measurements they populate `physical` and
 * `zones` and this fallback stops being used.
 */
import type { EmbroideryPattern } from '@dd/domain/types';
import type { EmbroideryZoneId } from '@dd/domain/omaniStyles';
import { defaultPhysical, type EmbroideryPhysical } from './embroideryScale';

/** Millimetre profiles for the seeded catalogue. */
const MEASURED: Record<string, EmbroideryPhysical> = {
  emb_01: { width: 18, repeat: 20, density: 9, stitchWeight: 0.7, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_02: { width: 16, repeat: 18, density: 8, stitchWeight: 0.75, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_03: { width: 22, repeat: 26, density: 12, stitchWeight: 0.65, scaleConstraints: { min: 0.7, max: 1.4 } },
  emb_04: { width: 17, repeat: 22, density: 9, stitchWeight: 0.6, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_05: { width: 16, repeat: 21, density: 8, stitchWeight: 0.7, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_06: { width: 20, repeat: 24, density: 13, stitchWeight: 0.6, scaleConstraints: { min: 0.7, max: 1.4 } },
  emb_07: { width: 15, repeat: 19, density: 8, stitchWeight: 0.7, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_08: { width: 10, repeat: 14, density: 6, stitchWeight: 0.5, scaleConstraints: { min: 0.5, max: 1.6 } },
  emb_09: { width: 14, repeat: 17, density: 9, stitchWeight: 0.7, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_10: { width: 19, repeat: 23, density: 11, stitchWeight: 0.6, scaleConstraints: { min: 0.7, max: 1.4 } },
  emb_11: { width: 17, repeat: 22, density: 10, stitchWeight: 0.65, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_12: { width: 15, repeat: 18, density: 8, stitchWeight: 0.75, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_13: { width: 21, repeat: 25, density: 12, stitchWeight: 0.6, scaleConstraints: { min: 0.7, max: 1.4 } },
  emb_14: { width: 16, repeat: 20, density: 9, stitchWeight: 0.7, scaleConstraints: { min: 0.6, max: 1.5 } },
  emb_15: { width: 23, repeat: 28, density: 14, stitchWeight: 0.65, scaleConstraints: { min: 0.7, max: 1.35 } },
};

export const patternPhysical = (pattern: EmbroideryPattern): EmbroideryPhysical =>
  MEASURED[pattern.id] ?? defaultPhysical(pattern.channelCount, pattern.surcharge);

export const hasMeasuredPhysical = (patternId: string): boolean => patternId in MEASURED;

/**
 * Which garment zones a pattern may occupy.
 *
 * Not every pattern goes everywhere: a 23 mm kufic band does not belong on a
 * 12 mm neckline. Cuff placement is offered only where the band is narrow
 * enough to sit there without being squeezed.
 */
export const patternZones = (pattern: EmbroideryPattern): EmbroideryZoneId[] => {
  const physical = patternPhysical(pattern);
  const zones: EmbroideryZoneId[] = ['SHAQ'];
  if (physical.width <= 20) zones.push('NECKLINE');
  if (physical.width <= 20) zones.push('CUFF_LEFT', 'CUFF_RIGHT');
  if (pattern.channelCount === 3) zones.push('CHEST');
  return zones;
};
