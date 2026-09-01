/**
 * OMANI DISHDASHA STYLE PROFILES.
 *
 * The renderer must never assume one universal geometry forever: Oman has
 * legitimate regional variation in dishdasha construction. This model exists
 * so a documented regional profile becomes a data record rather than a
 * renderer rewrite.
 *
 * We ship exactly ONE style. We have no verified reference data for regional
 * variants, and inventing them would put a fabricated garment in front of a
 * customer under the word "traditional". Add entries only when a tailor or a
 * documented source supplies the profile.
 *
 * See docs/OMANI_VISUAL_STANDARD.md for the source of every value.
 */
import type { Mm } from '@dd/visual/units';
import type { Localized } from '@dd/i18n';

/** How much of a profile is actually attested. Surfaced in the UI. */
export type ReferenceStatus = 'verified' | 'reference_required' | 'experimental';

export type EmbroideryZoneId =
  | 'NECKLINE'
  | 'SHAQ'
  | 'CHEST'
  | 'CUFF_LEFT'
  | 'CUFF_RIGHT'
  | 'SHOULDER'
  | 'BACK'
  | 'FURAKHA_ACCENT';

export const EMBROIDERY_ZONES: EmbroideryZoneId[] = [
  'NECKLINE',
  'SHAQ',
  'CHEST',
  'CUFF_LEFT',
  'CUFF_RIGHT',
  'SHOULDER',
  'BACK',
  'FURAKHA_ACCENT',
];

export const ZONE_LABELS: Record<EmbroideryZoneId, Localized> = {
  NECKLINE: { ar: 'فتحة الرقبة', en: 'Neckline' },
  SHAQ: { ar: 'الشق', en: 'Shaq (front slit)' },
  CHEST: { ar: 'الصدر', en: 'Chest' },
  CUFF_LEFT: { ar: 'الأسورة اليسرى', en: 'Left cuff' },
  CUFF_RIGHT: { ar: 'الأسورة اليمنى', en: 'Right cuff' },
  SHOULDER: { ar: 'الكتف', en: 'Shoulder' },
  BACK: { ar: 'الظهر', en: 'Back' },
  FURAKHA_ACCENT: { ar: 'لمسة الفراخة', en: 'Furakha accent' },
};

export type SilhouetteProfile = {
  /** Extra circumference over the body measurement. Keeps the garment loose. */
  chestEase: Mm;
  /** How much wider the hem is than the chest, as a ratio. */
  aLineRatio: number;
  /** Cross-section depth as a fraction of width, per landmark. Drives rotation. */
  depthRatio: { shoulder: number; chest: number; waist: number; hem: number };
};

export type NecklineProfile = {
  /** Collarless is the defining Omani characteristic — see standard §1. */
  collarless: true;
  openingHalfWidth: Mm;
  frontDrop: Mm;
  backDrop: Mm;
  boundEdgeWidth: Mm;
  embroideryBandWidth: Mm;
};

export type ShaqProfile = {
  length: Mm;
  /** Embroidery band width PER SIDE of the slit. */
  bandWidth: Mm;
  openingWidth: Mm;
};

export type SleeveProfile = {
  /** Degrees from vertical at rest. */
  dropAngle: number;
  upperWidth: Mm;
  taper: number;
};

export type CuffProfile = {
  openingCircumference: Mm;
  finishDepth: Mm;
  embroideryBandWidth: Mm;
};

export type BackProfile = {
  /** Back neckline is shallower than the front on almost every garment. */
  yokeDepth: Mm;
  /** Uncommon on the Omani dishdasha; off unless a tailor enables it. */
  embroideryDefault: boolean;
};

export type FurakhaProfile = {
  cordLengths: { short: Mm; medium: Mm; long: Mm };
  cordThickness: Mm;
  tasselHeadRadius: Mm;
  skirtLength: Mm;
  /** Where the cord leaves the neckline, as a fraction of the front drop. */
  attachmentDrop: number;
};

export type OmaniDishdashaStyle = {
  id: string;
  nameAr: string;
  nameEn: string;
  region: string | null;
  silhouetteProfile: SilhouetteProfile;
  necklineProfile: NecklineProfile;
  shaqProfile: ShaqProfile;
  sleeveProfile: SleeveProfile;
  cuffProfile: CuffProfile;
  backProfile: BackProfile;
  embroideryZones: EmbroideryZoneId[];
  furakhaProfile: FurakhaProfile;
  referenceStatus: ReferenceStatus;
  verified: boolean;
  references: string[];
};

/**
 * The one style we are prepared to render as "Omani".
 *
 * `verified: true` covers the characteristics in standard §1 — collarless
 * neckline, shaq, furakha, loose ankle-length A-line — which are the
 * documented, defining features. The millimetre values are
 * REFERENCE_REQUIRED placeholders drawn from the platform's own measurement
 * template, and are configurable per tailor.
 */
export const OM_STANDARD: OmaniDishdashaStyle = {
  id: 'om_standard',
  nameAr: 'الدشداشة العُمانية',
  nameEn: 'Omani dishdasha',
  region: null,
  silhouetteProfile: {
    chestEase: 100,
    aLineRatio: 1.14,
    // A loose robe is shallow at the shoulders and nearly circular at the hem.
    // These ratios are what make rotation read as a real garment turning.
    depthRatio: { shoulder: 0.38, chest: 0.58, waist: 0.72, hem: 0.92 },
  },
  necklineProfile: {
    collarless: true,
    openingHalfWidth: 78,
    frontDrop: 72,
    backDrop: 26,
    boundEdgeWidth: 6,
    embroideryBandWidth: 12,
  },
  shaqProfile: {
    length: 230,
    // 18 mm per side. V1 used 130 mm. This single number is the largest
    // visual correction in V2.
    bandWidth: 18,
    openingWidth: 5,
  },
  sleeveProfile: { dropAngle: 16, upperWidth: 230, taper: 0.52 },
  cuffProfile: { openingCircumference: 240, finishDepth: 22, embroideryBandWidth: 14 },
  backProfile: { yokeDepth: 26, embroideryDefault: false },
  embroideryZones: ['NECKLINE', 'SHAQ', 'CHEST', 'CUFF_LEFT', 'CUFF_RIGHT', 'FURAKHA_ACCENT'],
  furakhaProfile: {
    cordLengths: { short: 90, medium: 150, long: 210 },
    cordThickness: 3.5,
    tasselHeadRadius: 11,
    skirtLength: 34,
    attachmentDrop: 0.92,
  },
  referenceStatus: 'reference_required',
  verified: true,
  references: [
    'docs/OMANI_VISUAL_STANDARD.md',
    'REFERENCE_REQUIRED: millimetre values need confirmation from a partner tailor',
  ],
};

/** Only styles we are willing to render. Regional variants are NOT invented. */
export const OMANI_DISHDASHA_STYLES: OmaniDishdashaStyle[] = [OM_STANDARD];

export const getOmaniStyle = (id: string | null | undefined): OmaniDishdashaStyle =>
  OMANI_DISHDASHA_STYLES.find((s) => s.id === id) ?? OM_STANDARD;

/** Styles the customer UI may offer today. */
export const selectableOmaniStyles = () =>
  OMANI_DISHDASHA_STYLES.filter((s) => s.verified);
