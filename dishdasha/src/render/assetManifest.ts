/**
 * OMANI DISHDASHA 3D ASSET CONTRACT.
 *
 * A professional garment asset arrives as GLB from a Blender / CLO3D /
 * Marvelous Designer artist. Their node and material names are theirs; the
 * application's zones are ours. This manifest is the translation layer, so
 * external mesh names never leak into screens, services or state.
 *
 * Swapping Master Garment V1 for V2, or adding a verified regional variant,
 * is a new manifest plus a new GLB — not an application change.
 *
 * See docs/PROFESSIONAL_3D_ASSET_BRIEF.md for what an artist must deliver.
 */
import type { EmbroideryZoneId } from '@dd/domain/omaniStyles';

export const ASSET_CONTRACT_VERSION = 1;

/**
 * How good the asset behind a manifest actually is.
 *
 * PROFESSIONAL              a garment artist's production asset: separated
 *                           semantic parts, clean topology, real material
 *                           slots. Everything the app can do, it can do.
 * TEMPORARY_REAL_3D_PROTOTYPE
 *                           a real mesh, but a technical stand-in — typically
 *                           a single fused geometry with one baked texture.
 *                           It proves the 3D pipeline end to end. It is NOT
 *                           production-ready, NOT authenticated as an accurate
 *                           Omani garment, and cannot be recoloured per zone.
 *
 * The distinction is enforced, not documentary: `hasProfessionalAsset()` only
 * counts PROFESSIONAL, and validation applies the full contract only to those.
 */
export type AssetQuality = 'PROFESSIONAL' | 'TEMPORARY_REAL_3D_PROTOTYPE';

/** Semantic garment parts. The app reasons in these, never in mesh names. */
export type GarmentZoneId =
  | 'body'
  | 'leftSleeve'
  | 'rightSleeve'
  | 'neckline'
  | 'shaq'
  | 'leftCuff'
  | 'rightCuff'
  // Optional, present only when the asset models them.
  | 'pocket'
  | 'shoulderDetail'
  | 'backDetail';

export const REQUIRED_GARMENT_ZONES: GarmentZoneId[] = [
  'body',
  'leftSleeve',
  'rightSleeve',
  'neckline',
  'shaq',
  'leftCuff',
  'rightCuff',
];

/** Embroidery surfaces the asset exposes, mapped to catalogue zones. */
export type EmbroiderySurfaceId =
  | 'necklineEmbroidery'
  | 'shaqLeftEmbroidery'
  | 'shaqRightEmbroidery'
  | 'leftCuffEmbroidery'
  | 'rightCuffEmbroidery'
  | 'optionalBackEmbroidery';

export const EMBROIDERY_SURFACE_TO_ZONE: Record<EmbroiderySurfaceId, EmbroideryZoneId> = {
  necklineEmbroidery: 'NECKLINE',
  shaqLeftEmbroidery: 'SHAQ',
  shaqRightEmbroidery: 'SHAQ',
  leftCuffEmbroidery: 'CUFF_LEFT',
  rightCuffEmbroidery: 'CUFF_RIGHT',
  optionalBackEmbroidery: 'BACK',
};

/** The furakha is a separate component, never baked into the body texture. */
export type FurakhaZoneId = 'cord' | 'head' | 'tassel';
export const REQUIRED_FURAKHA_ZONES: FurakhaZoneId[] = ['cord', 'head', 'tassel'];

/** Maps one application zone to what the artist actually named it. */
export type NodeBinding = {
  /** Node name in the GLB scene graph. */
  node: string;
  /** Material slot to drive, when the zone is textured separately. */
  materialSlot?: string;
};

/**
 * Morph targets for measurement-driven proportions.
 *
 * Deliberately optional: a garment that lacks them still renders correctly at
 * canonical size. We do NOT deform geometry procedurally — that destroys
 * embroidery UVs and cloth quality, which is exactly what the brief forbids.
 */
export type MorphTargetId =
  | 'garmentLength'
  | 'shoulderWidth'
  | 'chestEase'
  | 'sleeveLength'
  | 'sleeveOpening'
  | 'bodyWidth'
  | 'hemWidth'
  | 'neckOpening';

export type AssetManifest = {
  contractVersion: number;
  assetId: string;
  /** PROFESSIONAL or a labelled prototype. Drives which rules apply below. */
  assetQuality: AssetQuality;
  /** Which Omani style this asset represents. Must exist in OMANI_DISHDASHA_STYLES. */
  garmentStyle: string;
  /** Human version of the garment itself, e.g. "master-v1". */
  assetVersion: string;
  /** Real-world units the mesh was authored in. */
  units: 'm' | 'cm' | 'mm';
  /** Multiplier to reach metres, so the app can reason in millimetres. */
  scaleToMetres: number;
  /** Y-up and facing +Z is the contract; anything else must be corrected here. */
  orientation: { up: 'y' | 'z'; front: '+z' | '-z' | '+x' | '-x' };
  /**
   * Where the artist put the origin. The contract asks for 'hem' (hem plane,
   * X/Z centred) so the renderer can frame and orbit without guessing; a
   * 'bounds_centre' asset is recentred at load time instead of being rejected.
   */
  originPolicy: 'hem' | 'bounds_centre';
  nodes: Partial<Record<GarmentZoneId, NodeBinding>>;
  embroiderySurfaces: Partial<Record<EmbroiderySurfaceId, NodeBinding>>;
  furakhaNodes: Partial<Record<FurakhaZoneId, NodeBinding>>;
  /** Material slots the app is allowed to drive. */
  materialSlots: { fabric: string; embroidery: string[]; furakha: string };
  uvSets: { fabric: string; embroidery: string };
  morphTargets: Partial<Record<MorphTargetId, string>>;
  /** Triangle count, for the device tier decision. */
  triangleCount: number;
  /** Author-supplied camera framing, optional; the app has its own presets. */
  cameraPresets?: Record<string, { azimuth: number; elevation: number; zoom: number }>;
  /** Whether this asset passed the visual acceptance gate. */
  visuallyAccepted: boolean;
  notes?: string;
};

export type ManifestIssue = {
  field: string;
  message: string;
  /**
   * 'error'   blocks loading entirely
   * 'warning' loads, but something is off
   * 'info'    a known, accepted limitation of a prototype asset — recorded so
   *           the gap between this asset and a professional one stays visible
   */
  severity: 'error' | 'warning' | 'info';
};

/**
 * Validates a manifest before the renderer trusts it.
 *
 * A malformed manifest must fail loudly here rather than produce a garment
 * with, say, no shaq — which the customer would read as a product defect.
 */
export const validateManifest = (manifest: AssetManifest): ManifestIssue[] => {
  const issues: ManifestIssue[] = [];

  // A prototype cannot meet the separated-geometry contract by definition:
  // it is one fused mesh. Its shortfalls are recorded as 'info' so it can
  // load, while the professional contract below stays exactly as strict.
  const prototype = manifest.assetQuality === 'TEMPORARY_REAL_3D_PROTOTYPE';
  const structural: ManifestIssue['severity'] = prototype ? 'info' : 'error';

  if (manifest.contractVersion !== ASSET_CONTRACT_VERSION) {
    issues.push({
      field: 'contractVersion',
      message: `expected ${ASSET_CONTRACT_VERSION}, received ${manifest.contractVersion}`,
      severity: 'error',
    });
  }

  for (const zone of REQUIRED_GARMENT_ZONES) {
    if (!manifest.nodes[zone]?.node) {
      issues.push({
        field: `nodes.${zone}`,
        message: prototype
          ? 'not separately bound — the prototype is one fused mesh'
          : 'required garment zone is not bound',
        severity: structural,
      });
    }
  }

  // Whatever its quality, an asset with no geometry at all is unrenderable.
  if (Object.values(manifest.nodes).every((b) => !b?.node)) {
    issues.push({ field: 'nodes', message: 'no garment geometry is bound at all', severity: 'error' });
  }

  // The furakha must be its own geometry. If it is baked into the body the app
  // cannot recolour it or change its length, so this is an error, not a nit.
  for (const zone of REQUIRED_FURAKHA_ZONES) {
    if (!manifest.furakhaNodes[zone]?.node) {
      issues.push({
        field: `furakhaNodes.${zone}`,
        message: prototype
          ? 'furakha is baked into the prototype mesh — it cannot be recoloured or resized'
          : 'furakha must be separate geometry, not baked into the body',
        severity: structural,
      });
    }
  }

  // The shaq carries the principal Omani embroidery; without a surface for it
  // the garment cannot show what the customer configured.
  const hasShaqSurface =
    Boolean(manifest.embroiderySurfaces.shaqLeftEmbroidery?.node) ||
    Boolean(manifest.embroiderySurfaces.shaqRightEmbroidery?.node);
  if (!hasShaqSurface) {
    issues.push({
      field: 'embroiderySurfaces',
      message: prototype
        ? 'no shaq embroidery surface — the prototype cannot show configured embroidery'
        : 'no shaq embroidery surface bound',
      severity: structural,
    });
  }

  if (!manifest.materialSlots.fabric) {
    issues.push({
      field: 'materialSlots.fabric',
      message: prototype
        ? 'no fabric material slot — the prototype renders its own baked texture'
        : 'fabric material slot is required',
      severity: structural,
    });
  }
  if (manifest.materialSlots.embroidery.length === 0) {
    issues.push({
      field: 'materialSlots.embroidery',
      message: prototype
        ? 'no embroidery material slots — thread channels cannot be driven'
        : 'at least one embroidery material slot is required',
      severity: structural,
    });
  }

  if (manifest.scaleToMetres <= 0) {
    issues.push({ field: 'scaleToMetres', message: 'must be positive', severity: 'error' });
  }
  if (manifest.orientation.up !== 'y') {
    issues.push({ field: 'orientation.up', message: 'the contract is Y-up; correct the export', severity: 'warning' });
  }

  // Mobile budget from the asset brief.
  if (manifest.triangleCount > 150000) {
    issues.push({ field: 'triangleCount', message: `${manifest.triangleCount} exceeds the 150k mobile budget`, severity: 'warning' });
  }

  return issues;
};

export const manifestIsUsable = (manifest: AssetManifest): boolean =>
  validateManifest(manifest).every((i) => i.severity !== 'error');

/**
 * What this asset cannot do, in plain language.
 *
 * For a professional asset this is empty. For a prototype it is the running
 * list of everything a real garment asset would unlock — the honest gap, kept
 * visible in the dev inspector instead of buried in a comment.
 */
export const prototypeLimitations = (manifest: AssetManifest): string[] => {
  if (manifest.assetQuality !== 'TEMPORARY_REAL_3D_PROTOTYPE') return [];
  return validateManifest(manifest)
    .filter((i) => i.severity === 'info')
    .map((i) => `${i.field}: ${i.message}`);
};

/**
 * Whether the app may drive this asset's materials from the customer's design.
 *
 * False for a prototype with one fused mesh and one baked texture: recolouring
 * it would tint the whole garment — furakha, cuff trim and all — to the fabric
 * dye, which is worse than leaving the asset as its author made it.
 */
export const supportsDesignDrivenMaterials = (manifest: AssetManifest): boolean =>
  manifest.assetQuality === 'PROFESSIONAL' &&
  Boolean(manifest.materialSlots.fabric) &&
  manifest.materialSlots.embroidery.length > 0;

/**
 * Reference manifest, documenting exactly what the app expects.
 *
 * This is a SPECIFICATION, not a registered asset — there is no GLB behind it.
 * It exists so an artist can see the contract concretely, and so the validator
 * has something to prove itself against in tests.
 */
export const REFERENCE_MANIFEST: AssetManifest = {
  contractVersion: ASSET_CONTRACT_VERSION,
  assetId: 'reference_spec_only',
  assetQuality: 'PROFESSIONAL',
  garmentStyle: 'om_standard',
  assetVersion: 'spec',
  units: 'm',
  scaleToMetres: 1,
  orientation: { up: 'y', front: '+z' },
  originPolicy: 'hem',
  nodes: {
    body: { node: 'Dishdasha_Body', materialSlot: 'MAT_Fabric' },
    leftSleeve: { node: 'Dishdasha_Sleeve_L', materialSlot: 'MAT_Fabric' },
    rightSleeve: { node: 'Dishdasha_Sleeve_R', materialSlot: 'MAT_Fabric' },
    neckline: { node: 'Dishdasha_Neckline', materialSlot: 'MAT_Fabric' },
    shaq: { node: 'Dishdasha_Shaq', materialSlot: 'MAT_Fabric' },
    leftCuff: { node: 'Dishdasha_Cuff_L', materialSlot: 'MAT_Fabric' },
    rightCuff: { node: 'Dishdasha_Cuff_R', materialSlot: 'MAT_Fabric' },
  },
  embroiderySurfaces: {
    necklineEmbroidery: { node: 'Emb_Neckline', materialSlot: 'MAT_Emb_Ch1' },
    shaqLeftEmbroidery: { node: 'Emb_Shaq_L', materialSlot: 'MAT_Emb_Ch1' },
    shaqRightEmbroidery: { node: 'Emb_Shaq_R', materialSlot: 'MAT_Emb_Ch2' },
    leftCuffEmbroidery: { node: 'Emb_Cuff_L', materialSlot: 'MAT_Emb_Ch1' },
    rightCuffEmbroidery: { node: 'Emb_Cuff_R', materialSlot: 'MAT_Emb_Ch1' },
  },
  furakhaNodes: {
    cord: { node: 'Furakha_Cord', materialSlot: 'MAT_Furakha' },
    head: { node: 'Furakha_Head', materialSlot: 'MAT_Furakha' },
    tassel: { node: 'Furakha_Tassel', materialSlot: 'MAT_Furakha' },
  },
  materialSlots: {
    fabric: 'MAT_Fabric',
    embroidery: ['MAT_Emb_Ch1', 'MAT_Emb_Ch2', 'MAT_Emb_Ch3'],
    furakha: 'MAT_Furakha',
  },
  uvSets: { fabric: 'UVMap', embroidery: 'UVEmbroidery' },
  morphTargets: {},
  triangleCount: 0,
  visuallyAccepted: false,
  notes: 'Specification only. No GLB is bound to this manifest.',
};
