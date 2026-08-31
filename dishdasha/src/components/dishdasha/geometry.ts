/**
 * Dishdasha figure geometry, in the shared 300×470 design space.
 *
 * Kept apart from the renderer so the zoom regions, the embroidery bands and
 * the silhouette can never drift out of alignment, and so a future garment
 * (a kandura, a thobe) is a second geometry record rather than a second
 * renderer.
 */
export const VIEW = { width: 300, height: 470 };

export const GEO = {
  /** Main body: shoulders, neckline curve, armpits, hem. */
  body:
    'M106 72 L128 70 C134 94 166 94 172 70 L194 72 L198 160 L224 432 L76 432 L102 160 Z',
  leftSleeve: 'M106 72 L60 96 L46 250 L80 258 L102 160 Z',
  rightSleeve: 'M194 72 L240 96 L254 250 L220 258 L198 160 Z',
  leftCuff: 'M46 250 L80 258 L83 232 L49 224 Z',
  rightCuff: 'M254 250 L220 258 L217 232 L251 224 Z',
  /** Neckline curve — the collar band is stroked along it. */
  neckline: 'M128 70 C134 94 166 94 172 70',
  /** Filled version, used for the shadow inside the neck opening. */
  neckOpening: 'M128 70 C134 94 166 94 172 70 Z',
  /** Front placket: the panel that carries the main embroidery. */
  placket: { x: 134, y: 92, width: 32, height: 148 },
  /** Narrow chest bands, used only by three-thread patterns. */
  chestLeft: { x: 116, y: 104, width: 12, height: 118 },
  chestRight: { x: 172, y: 104, width: 12, height: 118 },
  cuffBandLeft: { x: 47, y: 228, width: 35, height: 22 },
  cuffBandRight: { x: 218, y: 228, width: 35, height: 22 },
  pocket: { x: 186, y: 150, width: 30, height: 34 },
  /** Where the furakha cord leaves the collar. */
  furakhaAnchor: { x: 150, y: 92 },
  hemLine: 'M76 432 L224 432',
  folds: [
    'M120 180 C116 260 118 340 112 430',
    'M150 168 C152 250 148 340 150 430',
    'M182 180 C188 262 186 344 190 430',
    'M96 200 C90 280 86 356 84 430',
    'M204 200 C212 280 214 356 216 430',
  ],
} as const;

export type ZoomTarget = 'full' | 'neck' | 'chest' | 'sleeve' | 'furakha';

export const ZOOM_REGIONS: Record<ZoomTarget, { x: number; y: number; w: number; h: number }> = {
  full: { x: 0, y: 0, w: VIEW.width, h: VIEW.height },
  neck: { x: 98, y: 46, w: 104, h: 96 },
  chest: { x: 108, y: 84, w: 84, h: 168 },
  sleeve: { x: 34, y: 206, w: 76, h: 66 },
  furakha: { x: 116, y: 78, w: 68, h: 116 },
};

export const viewBoxFor = (zoom: ZoomTarget): string => {
  const r = ZOOM_REGIONS[zoom];
  return `${r.x} ${r.y} ${r.w} ${r.h}`;
};

/** Stroke weights scale up when zoomed so embroidery keeps its density. */
export const detailScaleFor = (zoom: ZoomTarget): number =>
  zoom === 'full' ? 1 : VIEW.width / ZOOM_REGIONS[zoom].w;

export const FURAKHA_LENGTHS: Record<string, number> = {
  furakha_short: 38,
  furakha_medium: 62,
  furakha_long: 88,
  furakha_none: 0,
};
