/**
 * MANIFEST FOR THE TEMPORARY REAL-3D PROTOTYPE.
 *
 * Every field here was read out of the GLB itself, not assumed:
 *
 *   generator     trimesh (a multi-view reconstruction, not a modelled garment)
 *   scene         2 nodes — "world" → "geometry_0"
 *   geometry      ONE primitive, 17,512 triangles, 11,291 vertices
 *   attributes    POSITION + TEXCOORD_0 only — NO NORMAL, no tangents
 *   material      ONE, unnamed, with a single baked 1024² baseColour texture
 *   bounds        0.455 × 1.000 × 0.296 units, centred on the origin
 *
 * Two consequences the renderer has to handle, both recorded here rather than
 * discovered at runtime:
 *
 *   - The mesh is normalised to 1.0 unit tall and centred on its bounding box,
 *     so it needs scaling to the canonical 1.46 m garment and lifting so the
 *     hem sits at y = 0. Hence scaleToMetres 1.46 and originPolicy
 *     'bounds_centre'.
 *   - It has no separated parts, so `nodes` binds the whole garment as `body`
 *     and nothing else. The validator turns every other contract requirement
 *     into a recorded limitation instead of an error, and
 *     `supportsDesignDrivenMaterials()` returns false for it.
 *
 * When the professional GLB arrives this file is deleted, not edited.
 */
import { ASSET_CONTRACT_VERSION, type AssetManifest } from './assetManifest';

/** Canonical garment height in metres — CANONICAL.totalLength / 1000. */
const CANONICAL_HEIGHT_M = 1.46;

export const PROTOTYPE_MANIFEST: AssetManifest = {
  contractVersion: ASSET_CONTRACT_VERSION,
  assetId: 'omani_dishdasha_prototype_v1',
  assetQuality: 'TEMPORARY_REAL_3D_PROTOTYPE',
  garmentStyle: 'om_standard',
  assetVersion: 'prototype-v1',
  // Authored in normalised units: the mesh is exactly 1.0 tall, so one unit
  // is one garment height and the multiplier to metres is the garment height.
  units: 'm',
  scaleToMetres: CANONICAL_HEIGHT_M,
  // Verified by rendering the six canonical azimuths: the neckline, shaq and
  // furakha face +Z at azimuth 0, and the back is at 180.
  orientation: { up: 'y', front: '+z' },
  originPolicy: 'bounds_centre',

  // The whole garment is one node. Binding it as `body` is accurate, not a
  // shortcut: there is genuinely nothing else in the file.
  nodes: {
    body: { node: 'geometry_0' },
  },

  // Empty on purpose. The garment's neckline trim, cuff trim and furakha are
  // painted into the baked texture, so there is no surface to drive.
  embroiderySurfaces: {},
  furakhaNodes: {},

  // No named material slots: the single material is unnamed in the GLB, and
  // the renderer keeps the authored material rather than replacing it.
  materialSlots: { fabric: '', embroidery: [], furakha: '' },
  uvSets: { fabric: 'uv', embroidery: 'uv' },
  morphTargets: {},
  triangleCount: 17512,

  // The visual acceptance gate is about professional assets. A prototype has
  // not passed it and must never be recorded as having done so.
  visuallyAccepted: false,

  notes:
    'Temporary technical prototype generated from multi-view references. Not production-ready, ' +
    'not an authenticated Omani garment, no separated semantic parts. Exists to validate the ' +
    'real 3D pipeline. Replace per docs/PROFESSIONAL_3D_ASSET_BRIEF.md.',
};

/**
 * Source-file defects the renderer repairs at load time.
 *
 * These are facts about this specific GLB, listed so the repair in
 * Real3DRenderer reads as a deliberate correction rather than a magic constant.
 */
export const PROTOTYPE_SOURCE_REPAIRS = {
  /** No NORMAL attribute: without computed normals the mesh renders unlit. */
  computeVertexNormals: true,
  /**
   * The material omits metallicFactor. glTF's default is 1.0, so the cloth
   * renders as dark grey metal with no environment map. Real cotton is 0.
   */
  forceNonMetallic: true,
  /**
   * A reconstruction has inconsistent winding in places; single-sided
   * rendering punches holes through the garment at some angles.
   */
  renderDoubleSided: true,
  /** Cotton roughness, matching docs/OMANI_MASTER_VISUAL_REFERENCE.md §4. */
  roughness: 0.82,
  sheen: 0.3,
  sheenRoughness: 0.7,
} as const;
