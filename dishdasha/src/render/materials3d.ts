/**
 * PBR MATERIAL MAPPING.
 *
 * V2 already separated MATERIAL from COLOUR, which was the right call; this
 * extends that model to physically-based rendering without changing it.
 *
 * The rule V3 must not break: changing white to navy alters ONE parameter —
 * base colour. Weave, roughness, sheen, normal strength and the lighting
 * response all stay, because they belong to the cloth, not to the dye.
 */
import type { FabricMaterial, ThreadMaterial } from '@dd/visual/materials';
import type { Mm } from '@dd/visual/units';

/** A three.js MeshPhysicalMaterial's worth of parameters, library-agnostic. */
export type Pbr = {
  color: string;
  roughness: number;
  metalness: number;
  /** Cloth sheen — the retroreflective glow at grazing angles. */
  sheen: number;
  sheenRoughness: number;
  sheenColor: string;
  /** Tiling of the weave normal map, derived from real yarn pitch. */
  normalScale: number;
  weaveRepeat: number;
  opacity: number;
  transmission: number;
  /** Texture keys the asset pipeline supplies; null until a real asset exists. */
  baseColorTexture: string | null;
  normalTexture: string | null;
  roughnessTexture: string | null;
};

/**
 * Fabric → PBR.
 *
 * `weaveRepeat` converts yarn pitch in millimetres into UV tiling for a one
 * square metre UV island: a 0.42 mm poplin yarn tiles ~2380 times per metre.
 * Deriving it keeps the physical scale honest instead of eyeballing a number.
 */
export const fabricToPbr = (
  material: FabricMaterial,
  colorHex: string,
  uvIslandSizeMm: Mm = 1000,
): Pbr => ({
  color: colorHex,
  // Cloth is never glossy; the spread is what separates sateen from linen.
  roughness: 0.52 + material.roughness * 0.42 - material.sheen * 0.14,
  metalness: 0,
  sheen: 0.25 + material.sheen * 0.65,
  sheenRoughness: 0.35 + material.roughness * 0.4,
  // Sheen tints toward the dye, so a navy sateen glows blue-white not white.
  sheenColor: colorHex,
  normalScale: 0.35 + material.roughness * 0.85,
  weaveRepeat: Math.max(1, Math.round(uvIslandSizeMm / material.weavePitch)),
  opacity: material.opacity,
  transmission: material.opacity > 0.95 ? 0 : (1 - material.opacity) * 0.35,
  baseColorTexture: null,
  normalTexture: null,
  roughnessTexture: null,
});

/**
 * Thread → PBR.
 *
 * Metallic threads are the only place `metalness` is non-zero. Cotton and silk
 * stay dielectric with a sheen, which is what stops embroidery reading as
 * plastic piping.
 */
export const threadToPbr = (thread: ThreadMaterial): Pbr => ({
  color: thread.baseColour,
  roughness: thread.metallic ? 0.24 + thread.roughness * 0.2 : 0.48 + thread.roughness * 0.36,
  metalness: thread.metallic ? 0.72 : 0,
  sheen: thread.metallic ? 0.2 : 0.35 + thread.sheen * 0.5,
  sheenRoughness: 0.3,
  sheenColor: thread.baseColour,
  // Thread sits proud of the cloth; the normal map is what sells that.
  normalScale: 0.9 + thread.highlightResponse * 0.6,
  weaveRepeat: 1,
  opacity: 1,
  transmission: 0,
  baseColorTexture: null,
  normalTexture: null,
  roughnessTexture: null,
});

/**
 * Only the base colour changes when a customer picks a different dye.
 *
 * Exists as a named function so the "changing colour must not reset the
 * material" rule is a single testable call rather than a convention.
 */
export const recolour = (pbr: Pbr, hex: string): Pbr => ({
  ...pbr,
  color: hex,
  sheenColor: hex,
});
