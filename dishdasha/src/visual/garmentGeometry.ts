/**
 * PARAMETRIC GARMENT GEOMETRY — millimetre space.
 *
 * The garment is described once, from measurements and a style profile, and
 * evaluated at a camera angle. It is NOT a stretched SVG and NOT a 3D mesh.
 *
 * How rotation works, honestly: the garment is treated as a stack of
 * elliptical cross-sections — wide and shallow at the shoulders, nearly
 * circular at the hem. A point on a cross-section at angle phi (0 = centre
 * front) projects to screen x as
 *
 *     x = W·sin(phi)·cos(theta) + D·cos(phi)·sin(theta)
 *
 * for semi-width W and semi-depth D. That single formula gives the silhouette
 * edge, the travel of the centre-front line as the garment turns, and which
 * features face the camera. It is a real projection of a real solid of
 * revolution — which is why the shaq slides round the body and the back
 * appears — but it is 2.5D, not a mesh. See docs/VISUAL_ENGINE_V2.md.
 */
import { getMeasurementTemplate } from '@dd/domain/measurementTemplates';
import type { MeasurementProfile } from '@dd/domain/types';
import { OM_STANDARD, type OmaniDishdashaStyle } from '@dd/domain/omaniStyles';
import { CANVAS, type Mm } from './units';

export type ViewAngle = number; // degrees; 0 = front, 90 = right side, 180 = back

/** Body dimensions the garment is cut from, in millimetres. */
export type GarmentMeasurements = {
  totalLength: Mm;
  shoulderWidth: Mm;
  chestCircumference: Mm;
  waistCircumference: Mm;
  hemSweep: Mm;
  sleeveLength: Mm;
  neckCircumference: Mm;
  cuffCircumference: Mm;
};

export const CANONICAL: GarmentMeasurements = {
  totalLength: 1460,
  shoulderWidth: 470,
  chestCircumference: 1040,
  waistCircumference: 980,
  hemSweep: 1300,
  sleeveLength: 620,
  neckCircumference: 410,
  cuffCircumference: 240,
};

/**
 * Reads a customer's saved profile into garment dimensions.
 *
 * Ranges are clamped to keep the garment recognisably an Omani dishdasha: a
 * measurement changes tailoring proportions, it never turns the robe into a
 * fitted shirt. Missing fields fall back to canonical rather than to zero.
 */
export const measurementsFromProfile = (
  profile: MeasurementProfile | null | undefined,
): GarmentMeasurements => {
  if (!profile) return CANONICAL;
  const template = getMeasurementTemplate(profile.templateId);
  const known = new Set(template.fields.map((f) => f.key));
  const toMm = (key: string, fallback: Mm): Mm => {
    if (!known.has(key)) return fallback;
    const raw = profile.values[key];
    if (raw === undefined || !Number.isFinite(raw)) return fallback;
    return profile.unit === 'cm' ? raw * 10 : raw * 25.4;
  };

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  return {
    totalLength: clamp(toMm('total_length', CANONICAL.totalLength), 1100, 1750),
    shoulderWidth: clamp(toMm('shoulder', CANONICAL.shoulderWidth), 360, 600),
    chestCircumference: clamp(toMm('chest', CANONICAL.chestCircumference), 760, 1500),
    waistCircumference: clamp(toMm('waist', CANONICAL.waistCircumference), 660, 1500),
    hemSweep: clamp(toMm('bottom_width', CANONICAL.hemSweep), 900, 1900),
    sleeveLength: clamp(toMm('sleeve_length', CANONICAL.sleeveLength), 450, 780),
    neckCircumference: clamp(toMm('neck', CANONICAL.neckCircumference), 320, 520),
    cuffCircumference: clamp(toMm('cuff_width', CANONICAL.cuffCircumference), 160, 340),
  };
};

/** A horizontal slice of the garment: how wide and how deep it is. */
export type Section = { y: Mm; halfWidth: Mm; halfDepth: Mm };

export type GarmentFrame = {
  style: OmaniDishdashaStyle;
  measurements: GarmentMeasurements;
  shoulder: Section;
  chest: Section;
  waist: Section;
  hem: Section;
  neck: { halfWidth: Mm; frontDrop: Mm; backDrop: Mm; y: Mm };
  shaq: { top: Mm; bottom: Mm; bandWidth: Mm; openingWidth: Mm };
  sleeve: { rootY: Mm; hemY: Mm; upperHalf: Mm; cuffHalf: Mm; dropAngle: number };
  armholeY: Mm;
  hemY: Mm;
};

/**
 * Builds the garment's dimensions. Independent of camera angle — the frame is
 * computed once and projected many times, which is what keeps the garment from
 * morphing as it rotates.
 */
export const buildFrame = (
  measurements: GarmentMeasurements = CANONICAL,
  style: OmaniDishdashaStyle = OM_STANDARD,
): GarmentFrame => {
  const { silhouetteProfile: sil, necklineProfile: neck, shaqProfile, sleeveProfile } = style;

  // Flat half-width = (circumference + ease) / 4, because a circumference wraps
  // both the front and the back panel.
  const halfFromCircumference = (circumference: Mm, ease: Mm): Mm =>
    (circumference + ease) / 4;

  const shoulderHalf = measurements.shoulderWidth / 2;
  const chestHalf = halfFromCircumference(measurements.chestCircumference, sil.chestEase);
  const waistHalf = halfFromCircumference(measurements.waistCircumference, sil.chestEase);
  // The hem is never narrower than the chest: an Omani dishdasha falls A-line.
  const hemHalf = Math.max(
    halfFromCircumference(measurements.hemSweep, 0),
    chestHalf * sil.aLineRatio,
  );

  const top = CANVAS.shoulderY;
  const hemY = top + measurements.totalLength;
  const chestY = top + measurements.totalLength * 0.22;
  const waistY = top + measurements.totalLength * 0.42;
  const armholeY = top + measurements.totalLength * 0.20;

  const necklineHalf = Math.max(
    neck.openingHalfWidth,
    // Scale the opening with the neck, so a larger customer gets a larger one.
    (measurements.neckCircumference / CANONICAL.neckCircumference) * neck.openingHalfWidth,
  );
  const frontDrop = neck.frontDrop * (necklineHalf / neck.openingHalfWidth);

  return {
    style,
    measurements,
    shoulder: { y: top, halfWidth: shoulderHalf, halfDepth: shoulderHalf * sil.depthRatio.shoulder },
    chest: { y: chestY, halfWidth: chestHalf, halfDepth: chestHalf * sil.depthRatio.chest },
    waist: { y: waistY, halfWidth: waistHalf, halfDepth: waistHalf * sil.depthRatio.waist },
    hem: { y: hemY, halfWidth: hemHalf, halfDepth: hemHalf * sil.depthRatio.hem },
    neck: { halfWidth: necklineHalf, frontDrop, backDrop: neck.backDrop, y: top },
    shaq: {
      top: top + frontDrop,
      bottom: top + frontDrop + shaqProfile.length,
      bandWidth: shaqProfile.bandWidth,
      openingWidth: shaqProfile.openingWidth,
    },
    sleeve: {
      rootY: top + 8,
      hemY: top + measurements.sleeveLength,
      upperHalf: sleeveProfile.upperWidth / 2,
      cuffHalf: measurements.cuffCircumference / 4 + 12,
      dropAngle: sleeveProfile.dropAngle,
    },
    armholeY,
    hemY,
  };
};

// ── projection ──────────────────────────────────────────────────────────────
const RAD = Math.PI / 180;

/** Screen x of a point at cross-section angle phi, for a section and camera. */
export const projectX = (section: Section, phiDeg: number, theta: ViewAngle): Mm => {
  const phi = phiDeg * RAD;
  const t = theta * RAD;
  return section.halfWidth * Math.sin(phi) * Math.cos(t)
    + section.halfDepth * Math.cos(phi) * Math.sin(t);
};

/** Silhouette half-width at this camera angle: the ellipse's projected radius. */
export const projectedHalfWidth = (section: Section, theta: ViewAngle): Mm => {
  const t = theta * RAD;
  return Math.hypot(section.halfWidth * Math.cos(t), section.halfDepth * Math.sin(t));
};

/**
 * How much a feature at phi faces the camera: 1 = square on, 0 = edge on,
 * negative = round the far side. Drives both visibility and foreshortening, so
 * embroidery compresses realistically as it turns away instead of vanishing.
 */
export const facing = (section: Section, phiDeg: number, theta: ViewAngle): number => {
  const phi = phiDeg * RAD;
  const t = theta * RAD;
  const nx = section.halfDepth * Math.sin(phi);
  const nz = section.halfWidth * Math.cos(phi);
  const len = Math.hypot(nx, nz) || 1;
  // Rotate the normal by theta and take its component toward the viewer.
  return (nz * Math.cos(t) - nx * Math.sin(t)) / len;
};

export const isVisible = (section: Section, phiDeg: number, theta: ViewAngle): boolean =>
  facing(section, phiDeg, theta) > 0.06;

/** Centre-front line at this camera angle. */
export const centreFrontX = (section: Section, theta: ViewAngle): Mm =>
  projectX(section, 0, theta);

export const centreBackX = (section: Section, theta: ViewAngle): Mm =>
  projectX(section, 180, theta);

export const normalizeAngle = (theta: number): number => ((theta % 360) + 360) % 360;

/** Front, side and back, for snapping and for the review screen. */
export const SNAP_ANGLES = [0, 90, 180, 270] as const;

/** Shortest signed angular distance between two headings, 0..180. */
export const angularDistance = (a: number, b: number): number =>
  Math.abs(((normalizeAngle(a) - normalizeAngle(b) + 540) % 360) - 180);

export const nearestSnap = (theta: number): number => {
  const a = normalizeAngle(theta);
  let best = SNAP_ANGLES[0] as number;
  for (const s of SNAP_ANGLES) {
    // The CLOSEST snap. Picking the furthest sent a release near the front
    // spinning round to the back.
    if (angularDistance(a, s) < angularDistance(a, best)) best = s;
  }
  return best;
};

/** Interpolates the body outline for the current camera angle. */
/** Shoulders slope away from the neck; a horizontal line reads as a coat hanger. */
export const SHOULDER_SLOPE: Mm = 26;

export const bodyOutlinePath = (frame: GarmentFrame, theta: ViewAngle): string => {
  const cx = CANVAS.centreX;
  const s = projectedHalfWidth(frame.shoulder, theta);
  const c = projectedHalfWidth(frame.chest, theta);
  const w = projectedHalfWidth(frame.waist, theta);
  const h = projectedHalfWidth(frame.hem, theta);
  const { shoulder, chest, waist, hem } = frame;

  // Right edge down, hem across, left edge up. Gentle curves: a woven robe
  // does not fall in straight lines.
  // Neck end of the shoulder seam sits higher than the sleeve end. It must
  // match the neckline opening exactly, or the opening pokes out above the
  // seam and reads as a collar — the one thing an Omani dishdasha has not got.
  const neckX = frame.neck.halfWidth;
  const sy = shoulder.y;
  const tipY = sy + SHOULDER_SLOPE;

  return [
    `M ${cx - neckX} ${sy}`,
    `L ${cx - s} ${tipY}`,
    `L ${cx + s} ${tipY}`,
    `L ${cx + neckX} ${sy}`,
    `L ${cx - neckX} ${sy}`,
    `M ${cx - s} ${tipY}`,
    `L ${cx + s} ${tipY}`,
    `C ${cx + c} ${chest.y * 0.98} ${cx + c} ${chest.y} ${cx + c} ${chest.y}`,
    `C ${cx + w} ${waist.y} ${cx + h * 0.82} ${(waist.y + hem.y) / 2} ${cx + h} ${hem.y}`,
    `Q ${cx} ${hem.y + 26} ${cx - h} ${hem.y}`,
    `C ${cx - h * 0.82} ${(waist.y + hem.y) / 2} ${cx - w} ${waist.y} ${cx - c} ${chest.y}`,
    `C ${cx - c} ${chest.y} ${cx - c} ${chest.y * 0.98} ${cx - s} ${tipY}`,
    'Z',
  ].join(' ');
};

/**
 * Neckline opening. Collarless: a plain rounded opening, deeper at the front
 * than the back, and it foreshortens into a narrow ellipse from the side.
 */
export const necklinePath = (frame: GarmentFrame, theta: ViewAngle): string => {
  const cx = CANVAS.centreX;
  const { neck, shoulder } = frame;
  const section: Section = {
    y: shoulder.y,
    halfWidth: neck.halfWidth,
    halfDepth: neck.halfWidth * 0.78,
  };
  const half = projectedHalfWidth(section, theta);
  const front = facing(section, 0, theta);
  // Between the front drop and the back drop according to which we are seeing.
  const drop = neck.backDrop + (neck.frontDrop - neck.backDrop) * (front * 0.5 + 0.5);
  const shift = centreFrontX(section, theta) * 0.35;
  const y = shoulder.y;
  // The opening is a hole in the cloth: it sits at and below the shoulder
  // line and never rises above it. The upper edge follows the shoulder seam,
  // the lower edge is the scooped front (or the shallow back).
  return [
    `M ${cx - half + shift} ${y}`,
    `C ${cx - half * 0.5 + shift} ${y + drop * 1.55} ${cx + half * 0.5 + shift} ${y + drop * 1.55} ${cx + half + shift} ${y}`,
    `C ${cx + half * 0.45 + shift} ${y + neck.backDrop * 0.75} ${cx - half * 0.45 + shift} ${y + neck.backDrop * 0.75} ${cx - half + shift} ${y}`,
    'Z',
  ].join(' ');
};

/** Sleeve outline. The far sleeve is drawn first so depth ordering is right. */
export const sleevePath = (
  frame: GarmentFrame,
  side: 'left' | 'right',
  theta: ViewAngle,
): string => {
  const cx = CANVAS.centreX;
  const dir = side === 'right' ? 1 : -1;
  // The sleeve hangs from the shoulder point, which itself swings with rotation.
  const rootX = cx + dir * projectedHalfWidth(frame.shoulder, theta) * 0.94;
  const drop = frame.sleeve.dropAngle * RAD;
  const len = frame.sleeve.hemY - frame.sleeve.rootY;
  const rootY = frame.sleeve.rootY + SHOULDER_SLOPE;
  const tipX = rootX + dir * Math.sin(drop) * len;
  const tipY = rootY + Math.cos(drop) * len;

  // Sleeves foreshorten as the garment turns, but never collapse to nothing.
  const foreshorten = 0.42 + 0.58 * Math.abs(Math.cos(theta * RAD));
  const upper = frame.sleeve.upperHalf * foreshorten;
  const cuff = frame.sleeve.cuffHalf * foreshorten;

  return [
    `M ${rootX} ${rootY}`,
    `C ${rootX + dir * upper * 0.9} ${rootY + 40} ${tipX + dir * cuff * 1.2} ${tipY - 120} ${tipX + dir * cuff} ${tipY}`,
    `L ${tipX - dir * cuff} ${tipY + 14}`,
    `C ${tipX - dir * cuff * 0.6} ${tipY - 150} ${rootX - dir * upper * 0.1} ${frame.armholeY + 40} ${rootX - dir * upper * 0.05} ${frame.armholeY}`,
    'Z',
  ].join(' ');
};

/** Cuff band rectangle, in millimetres, at the sleeve opening. */
export const cuffBand = (
  frame: GarmentFrame,
  side: 'left' | 'right',
  theta: ViewAngle,
): { x: Mm; y: Mm; w: Mm; h: Mm } => {
  const cx = CANVAS.centreX;
  const dir = side === 'right' ? 1 : -1;
  const rootX = cx + dir * projectedHalfWidth(frame.shoulder, theta) * 0.94;
  const drop = frame.sleeve.dropAngle * RAD;
  const len = frame.sleeve.hemY - frame.sleeve.rootY;
  const tipX = rootX + dir * Math.sin(drop) * len;
  const tipY = frame.sleeve.rootY + SHOULDER_SLOPE + Math.cos(drop) * len;
  const foreshorten = 0.42 + 0.58 * Math.abs(Math.cos(theta * RAD));
  const cuff = frame.sleeve.cuffHalf * foreshorten;
  const depth = frame.style.cuffProfile.finishDepth;
  return { x: tipX - cuff, y: tipY - depth, w: cuff * 2, h: depth };
};
