/**
 * EMBROIDERY PLACEMENT SYSTEM — renderer independent.
 *
 * Embroidery must belong to the cloth, not float above it as UI graphics.
 * This module answers "what goes where, at what physical size, in which
 * thread" WITHOUT knowing whether the answer will be realised as a texture
 * decal, a UV atlas, displaced geometry or SVG paths.
 *
 * That separation is the point: V2 draws the result as vectors, Real3D will
 * draw it on a mesh surface, and neither owns the placement rules.
 */
import type { EmbroideryZoneId } from '@dd/domain/omaniStyles';
import type { EmbroideryPattern } from '@dd/domain/types';
import { ZONE_BAND_WIDTH, repeatsAlong, scaleForZone, type EmbroideryPhysical } from '@dd/visual/embroideryScale';
import { patternPhysical, patternZones } from '@dd/visual/patternPhysical';
import type { Mm } from '@dd/visual/units';
import type { EmbroiderySurfaceId } from './assetManifest';
import { EMBROIDERY_SURFACE_TO_ZONE } from './assetManifest';

/** How a renderer is expected to realise a placement. Advisory, not binding. */
export type PlacementTechnique = 'decal' | 'uv_atlas' | 'displacement' | 'geometry' | 'vector';

export type EmbroideryPlacement = {
  zone: EmbroideryZoneId;
  /** Set when a 3D asset exposes a dedicated surface for this zone. */
  surface: EmbroiderySurfaceId | null;
  motif: EmbroideryPattern['motif'];
  /** Physical band width in millimetres — the scale contract from V2. */
  bandWidthMm: Mm;
  repeatMm: Mm;
  stitchWeightMm: Mm;
  density: number;
  /** How many repeats fit the run, once the renderer knows its length. */
  repeatsFor: (runLengthMm: Mm) => number;
  /** Thread channel indices this placement consumes, 1-based. */
  channels: (1 | 2 | 3)[];
  technique: PlacementTechnique;
};

export type PlacementRequest = {
  pattern: EmbroideryPattern | null;
  /** Surfaces the loaded asset actually exposes. Empty for the vector fallback. */
  availableSurfaces: EmbroiderySurfaceId[];
  /** Whether the tailor enabled cuff embroidery for this design. */
  includeCuffs: boolean;
  /** Back embroidery is uncommon on this garment; off unless enabled. */
  includeBack: boolean;
  preferredTechnique?: PlacementTechnique;
};

/**
 * Computes every placement for a design.
 *
 * Zones come from the pattern's own constraints (a 23 mm kufic band is not
 * offered for a 12 mm neckline), so a renderer cannot place a pattern
 * somewhere it physically does not fit.
 */
export const computePlacements = (req: PlacementRequest): EmbroideryPlacement[] => {
  const { pattern } = req;
  if (!pattern || pattern.motif === 'none') return [];

  const physical: EmbroideryPhysical = patternPhysical(pattern);
  const allowed = new Set(patternZones(pattern));
  const technique = req.preferredTechnique ?? (req.availableSurfaces.length > 0 ? 'decal' : 'vector');

  const surfaceForZone = (zone: EmbroideryZoneId): EmbroiderySurfaceId | null =>
    req.availableSurfaces.find((s) => EMBROIDERY_SURFACE_TO_ZONE[s] === zone) ?? null;

  const wanted: EmbroideryZoneId[] = ['SHAQ'];
  if (allowed.has('NECKLINE')) wanted.push('NECKLINE');
  if (req.includeCuffs && allowed.has('CUFF_LEFT')) wanted.push('CUFF_LEFT', 'CUFF_RIGHT');
  if (req.includeBack && allowed.has('BACK')) wanted.push('BACK');

  return wanted
    .filter((zone) => allowed.has(zone))
    .map((zone) => {
      const fitted = scaleForZone(physical, zone);
      return {
        zone,
        surface: surfaceForZone(zone),
        motif: pattern.motif,
        bandWidthMm: ZONE_BAND_WIDTH[zone],
        repeatMm: fitted.repeat,
        stitchWeightMm: physical.stitchWeight,
        density: physical.density,
        repeatsFor: (runLengthMm: Mm) => repeatsAlong(runLengthMm, fitted.repeat),
        channels: Array.from({ length: pattern.channelCount }, (_, i) => (i + 1) as 1 | 2 | 3),
        technique,
      };
    });
};

/**
 * Which thread channel drives a given embroidery material slot.
 *
 * Independence is the requirement: changing thread 2 must repaint only the
 * slot bound to channel 2. Returning an explicit mapping — rather than letting
 * a renderer guess — is what makes that testable.
 */
export const channelForMaterialSlot = (
  slot: string,
  slots: string[],
): 1 | 2 | 3 | null => {
  const index = slots.indexOf(slot);
  if (index < 0 || index > 2) return null;
  return (index + 1) as 1 | 2 | 3;
};

export const placementsUseChannel = (
  placements: EmbroideryPlacement[],
  channel: 1 | 2 | 3,
): boolean => placements.some((p) => p.channels.includes(channel));
