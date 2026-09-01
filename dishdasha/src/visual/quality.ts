/**
 * RENDERING QUALITY MODES.
 *
 * Visual realism must not cost interaction smoothness. Quality controls how
 * much micro-detail is drawn; it never changes the garment's geometry, colour
 * or embroidery placement, so a LIGHT render is the same garment, plainer.
 *
 * Deliberately free of react-native imports: this is decision logic, it is
 * covered by tests that run under plain Node, and the platform lookup belongs
 * to the caller. Components pass `PixelRatio.get()` as the device hint.
 */
export type RenderQuality = 'AUTO' | 'HIGH' | 'BALANCED' | 'LIGHT';
export type ResolvedQuality = Exclude<RenderQuality, 'AUTO'>;

/**
 * AUTO picks from the rendered size and the screen's pixel density: a 90 pt
 * thumbnail cannot show a 0.4 mm yarn however powerful the phone is, so the
 * cheapest correct answer is usually the smallest one.
 */
export const resolveQuality = (
  requested: RenderQuality,
  renderedWidthPt: number,
  isDetailView: boolean,
  pixelRatio = 3,
): ResolvedQuality => {
  if (requested !== 'AUTO') return requested;
  if (isDetailView) return 'HIGH';
  if (renderedWidthPt < 120) return 'LIGHT';
  if (renderedWidthPt < 260) return 'BALANCED';
  // A low-density screen gains nothing from the finest pass.
  if (pixelRatio < 2) return 'BALANCED';
  return 'HIGH';
};

export const QUALITY_LABELS: Record<RenderQuality, { ar: string; en: string }> = {
  AUTO: { ar: 'تلقائي', en: 'Auto' },
  HIGH: { ar: 'عالية', en: 'High' },
  BALANCED: { ar: 'متوازنة', en: 'Balanced' },
  LIGHT: { ar: 'خفيفة', en: 'Light' },
};
