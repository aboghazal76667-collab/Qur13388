/**
 * MILLIMETRE SPACE — the foundation of DishdashaVisualEngineV2.
 *
 * V1's root visual failure was that embroidery was sized in screen units. The
 * front band ended up 130 mm wide against a 1460 mm garment — five times life
 * size — which is exactly why it read as a graphic ornament laid over the
 * garment instead of thread sewn into it.
 *
 * V2 fixes that structurally rather than by convention: the renderer's own
 * coordinate system IS millimetres. An 18 mm embroidery band is the number 18.
 * A 22 mm motif repeat is the number 22. There is no scale factor to get
 * wrong, and a wrong value is visible as a wrong number in the source.
 *
 * Screen scaling happens once, at the SVG viewBox, and nowhere else.
 */

/** Millimetres. A branded alias — documentation that survives refactoring. */
export type Mm = number;

export const cm = (value: number): Mm => value * 10;
export const mm = (value: number): Mm => value;

/**
 * Canonical garment envelope in millimetres, from
 * docs/OMANI_VISUAL_STANDARD.md §2. The drawing surface is a little larger
 * than the garment so sleeves, the furakha and a ground shadow have room.
 */
/**
 * Sized to the garment plus a small margin, so the drawing fills its frame
 * rather than floating in empty space: sleeve tips reach about ±465 mm from
 * centre, and the hem plus its ground shadow ends around 1610 mm down.
 */
export const CANVAS = {
  width: 1120 as Mm,
  height: 1700 as Mm,
  /** Centre-front vertical axis. The garment is described symmetrically. */
  centreX: 560 as Mm,
  /** Shoulder line: everything hangs from here. */
  shoulderY: 120 as Mm,
} as const;

export const viewBox = (): string => `0 0 ${CANVAS.width} ${CANVAS.height}`;

/**
 * A crop of millimetre space, used by the detail viewer. Expressed in mm so a
 * "50 mm wide view of the neckline" means exactly that.
 */
export type MmRegion = { x: Mm; y: Mm; w: Mm; h: Mm };

export const regionToViewBox = (r: MmRegion): string => `${r.x} ${r.y} ${r.w} ${r.h}`;

/**
 * Stroke weights must also be physical: a stitch line is ~0.7 mm of thread,
 * not "1 pixel". Kept as named constants so no component invents its own.
 */
export const STITCH = {
  hairline: 0.45 as Mm,
  fine: 0.7 as Mm,
  regular: 0.9 as Mm,
  heavy: 1.3 as Mm,
  /** Seam and edge lines, which are construction rather than embroidery. */
  seam: 1.1 as Mm,
  outline: 1.8 as Mm,
} as const;

/**
 * How many millimetres one on-screen point represents, for a given rendered
 * width. Used to decide whether fine detail is worth drawing at all: below
 * roughly 0.35 mm per point a stitch is thinner than a pixel and only costs
 * render time.
 */
export const mmPerPoint = (renderedWidthPt: number, viewWidthMm: Mm): number =>
  viewWidthMm / Math.max(1, renderedWidthPt);

export const isDetailWorthDrawing = (
  renderedWidthPt: number,
  viewWidthMm: Mm,
  featureSizeMm: Mm,
): boolean => featureSizeMm / mmPerPoint(renderedWidthPt, viewWidthMm) >= 0.75;
