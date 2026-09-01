/**
 * EMBROIDERY PHYSICAL SCALE.
 *
 * The V1 regression this file exists to make impossible: embroidery was sized
 * relative to the drawing, so the front band rendered 130 mm wide. Every
 * dimension here is millimetres in the same space the garment is drawn in, and
 * every value is range-checked against what a real embroidery head produces.
 */
import type { EmbroideryZoneId } from '@dd/domain/omaniStyles';
import type { Mm } from './units';

/** What a pattern physically is, independent of where it is placed. */
export type EmbroideryPhysical = {
  /** Band width across the stitching. */
  width: Mm;
  /** One repeat of the motif along the band. */
  repeat: Mm;
  /** Stitches per centimetre — heavier density reads denser and costs more. */
  density: number;
  /** Stitch line weight. */
  stitchWeight: Mm;
  /** How far the pattern may be scaled for a zone, so it never balloons. */
  scaleConstraints: { min: number; max: number };
};

/**
 * Plausible manufacturing limits, from docs/OMANI_VISUAL_STANDARD.md §8.
 * Anything outside these is a data-entry error, not a style choice.
 */
export const PHYSICAL_LIMITS = {
  width: { min: 6, max: 40 },
  repeat: { min: 8, max: 46 },
  density: { min: 4, max: 18 },
  stitchWeight: { min: 0.35, max: 1.6 },
} as const;

export type ScaleIssue = { field: keyof typeof PHYSICAL_LIMITS; value: number; message: string };

/** Rejects physically impossible embroidery. Used by tests and by the importer. */
export const validatePhysical = (p: EmbroideryPhysical): ScaleIssue[] => {
  const issues: ScaleIssue[] = [];
  const check = (field: keyof typeof PHYSICAL_LIMITS, value: number) => {
    const { min, max } = PHYSICAL_LIMITS[field];
    if (!(value >= min && value <= max)) {
      issues.push({ field, value, message: `${field} must be between ${min} and ${max}` });
    }
  };
  check('width', p.width);
  check('repeat', p.repeat);
  check('density', p.density);
  check('stitchWeight', p.stitchWeight);
  return issues;
};

/**
 * Zone band widths in millimetres. A pattern is fitted INTO its zone's band
 * rather than the band being sized to the pattern — which is the inversion
 * that let V1 run away.
 */
export const ZONE_BAND_WIDTH: Record<EmbroideryZoneId, Mm> = {
  NECKLINE: 12,
  SHAQ: 18,
  CHEST: 10,
  CUFF_LEFT: 14,
  CUFF_RIGHT: 14,
  SHOULDER: 10,
  BACK: 16,
  FURAKHA_ACCENT: 6,
};

/**
 * Resolves the scale factor for placing a pattern in a zone.
 *
 * Clamped to the pattern's own constraints, so a design meant for a 24 mm
 * shaq band is not stretched onto a 12 mm neckline and vice versa — it is
 * scaled within what the pattern tolerates, or refused.
 */
export const scaleForZone = (
  physical: EmbroideryPhysical,
  zone: EmbroideryZoneId,
): { scale: number; bandWidth: Mm; repeat: Mm; fits: boolean } => {
  const bandWidth = ZONE_BAND_WIDTH[zone];
  const raw = bandWidth / physical.width;
  const scale = Math.min(
    physical.scaleConstraints.max,
    Math.max(physical.scaleConstraints.min, raw),
  );
  return {
    scale,
    bandWidth,
    repeat: physical.repeat * scale,
    // If clamping moved the scale materially, the pattern does not belong here.
    fits: Math.abs(scale - raw) / raw < 0.35,
  };
};

/** How many repeats fit along a run of band, and the leftover. */
export const repeatsAlong = (lengthMm: Mm, repeatMm: Mm): number =>
  Math.max(1, Math.ceil(lengthMm / Math.max(0.1, repeatMm)));

/**
 * Default physical profile for a pattern that has not been measured yet.
 * Derived from its channel count and price tier — richer patterns are
 * physically denser — and deliberately conservative.
 */
export const defaultPhysical = (
  channelCount: 1 | 2 | 3,
  surcharge: number,
): EmbroideryPhysical => ({
  width: 14 + channelCount * 3,
  repeat: 16 + channelCount * 3.5,
  density: 6 + Math.min(6, surcharge),
  stitchWeight: 0.55 + channelCount * 0.08,
  scaleConstraints: { min: 0.55, max: 1.7 },
});
