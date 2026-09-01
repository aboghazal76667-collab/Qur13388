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

export type ManifestIssue = { field: string; message: string; severity: 'error' | 'warning' };

/**
 * Validates a manifest before the renderer trusts it.
 *
 * A malformed manifest must fail loudly here rather than produce a garment
 * with, say, no shaq — which the customer would read as a product defect.
 */
export const validateManifest = (manifest: AssetManifest): ManifestIssue[] => {
  const issues: ManifestIssue[] = [];

  if (manifest.contractVersion !== ASSET_CONTRACT_VERSION) {
    issues.push({
      field: 'contractVersion',
      message: `expected ${ASSET_CONTRACT_VERSION}, received ${manifest.contractVersion}`,
      severity: 'error',
    });
  }

  for (const zone of REQUIRED_GARMENT_ZONES) {
    if (!manifest.nodes[zone]?.node) {
      issues.push({ field: `nodes.${zone}`, message: 'required garment zone is not bound', severity: 'error' });
    }
  }

  // The furakha must be its own geometry. If it is baked into the body the app
  // cannot recolour it or change its length, so this is an error, not a nit.
  for (const zone of REQUIRED_FURAKHA_ZONES) {
    if (!manifest.furakhaNodes[zone]?.node) {
      issues.push({ field: `furakhaNodes.${zone}`, message: 'furakha must be separate geometry, not baked into the body', severity: 'error' });
    }
  }

  // The shaq carries the principal Omani embroidery; without a surface for it
  // the garment cannot show what the customer configured.
  const hasShaqSurface =
    Boolean(manifest.embroiderySurfaces.shaqLeftEmbroidery?.node) ||
    Boolean(manifest.embroiderySurfaces.shaqRightEmbroidery?.node);
  if (!hasShaqSurface) {
    issues.push({ field: 'embroiderySurfaces', message: 'no shaq embroidery surface bound', severity: 'error' });
  }

  if (!manifest.materialSlots.fabric) {
    issues.push({ field: 'materialSlots.fabric', message: 'fabric material slot is required', severity: 'error' });
  }
  if (manifest.materialSlots.embroidery.length === 0) {
    issues.push({ field: 'materialSlots.embroidery', message: 'at least one embroidery material slot is required', severity: 'error' });
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
 * Reference manifest, documenting exactly what the app expects.
 *
 * This is a SPECIFICATION, not a registered asset — there is no GLB behind it.
 * It exists so an artist can see the contract concretely, and so the validator
 * has something to prove itself against in tests.
 */
export const REFERENCE_MANIFEST: AssetManifest = {
  contractVersion: ASSET_CONTRACT_VERSION,
  assetId: 'reference_spec_only',
  garmentStyle: 'om_standard',
  assetVersion: 'spec',
  units: 'm',
  scaleToMetres: 1,
  orientation: { up: 'y', front: '+z' },
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
