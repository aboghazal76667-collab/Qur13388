/**
 * MATERIAL SYSTEM — fabric is not a hex colour.
 *
 * V1 filled the garment with a hex value, so an ivory sateen and an ivory
 * cotton were the same rectangle. V2 separates the two concerns completely:
 *
 *     FabricMaterial  — how the cloth behaves under light (weave, drape, sheen)
 *     Colour          — what shade it was dyed
 *
 * The renderer combines them. "Nasim Lightweight Cotton" + "Ivory 04" is one
 * garment; the same ivory in "Majan Sateen" is visibly a different one.
 *
 * HONESTY: this is an EXPERIMENTAL approximation of textile response — chosen
 * constants that read convincingly, not measured material data. Real fabric
 * photography replaces it through FabricScannerPipeline.
 */
import type { FabricTexture } from '@dd/domain/types';
import { darken, hexToHsl, lighten, mix } from '@dd/engine/color';
import type { Mm } from './units';

export type WeaveKind = 'plain' | 'twill' | 'sateen' | 'slub' | 'crepe' | 'wool';

export type FabricMaterial = {
  weave: WeaveKind;
  /** Yarn spacing in millimetres — a real weave is 0.3–1.2 mm. */
  weavePitch: Mm;
  /** 0 = chalk matte, 1 = high lustre. Drives the specular sweep. */
  sheen: number;
  /** 0 = smooth, 1 = heavily textured. Drives micro-contrast. */
  roughness: number;
  /** 0 = stiff and boardy, 1 = liquid. Drives fold count and softness. */
  drape: number;
  /** Cloth thickness — how heavy the edge and the shadow read. */
  thickness: Mm;
  /** 0 = sheer, 1 = fully opaque. */
  opacity: number;
};

/** Maps the existing catalogue's texture tag onto a full material. */
export const MATERIAL_BY_TEXTURE: Record<FabricTexture, FabricMaterial> = {
  poplin:      { weave: 'plain',  weavePitch: 0.42, sheen: 0.16, roughness: 0.22, drape: 0.62, thickness: 0.30, opacity: 0.94 },
  plain_weave: { weave: 'plain',  weavePitch: 0.55, sheen: 0.12, roughness: 0.30, drape: 0.54, thickness: 0.36, opacity: 0.96 },
  fine_twill:  { weave: 'twill',  weavePitch: 0.48, sheen: 0.26, roughness: 0.28, drape: 0.58, thickness: 0.40, opacity: 0.97 },
  sateen:      { weave: 'sateen', weavePitch: 0.34, sheen: 0.62, roughness: 0.10, drape: 0.78, thickness: 0.34, opacity: 0.97 },
  linen_slub:  { weave: 'slub',   weavePitch: 0.85, sheen: 0.08, roughness: 0.62, drape: 0.44, thickness: 0.46, opacity: 0.90 },
  crepe:       { weave: 'crepe',  weavePitch: 0.30, sheen: 0.20, roughness: 0.44, drape: 0.86, thickness: 0.32, opacity: 0.96 },
  wool_blend:  { weave: 'wool',   weavePitch: 0.95, sheen: 0.10, roughness: 0.70, drape: 0.50, thickness: 0.72, opacity: 0.99 },
};

export const materialFor = (texture: FabricTexture | undefined): FabricMaterial =>
  MATERIAL_BY_TEXTURE[texture ?? 'plain_weave'];

/**
 * Shading ramp for a dyed cloth.
 *
 * Dark dyes and pale dyes do not behave the same: a navy shows its folds
 * mostly as highlights, an ivory mostly as shadow. Scaling the ramp by
 * lightness is what stops dark fabrics turning into flat black shapes and pale
 * ones into blown-out white ones.
 */
export type ShadingRamp = {
  deepShadow: string;
  shadow: string;
  base: string;
  light: string;
  specular: string;
  /** Opacity of the specular sweep. */
  specularStrength: number;
};

export const shadingRamp = (baseHex: string, material: FabricMaterial): ShadingRamp => {
  const { l } = hexToHsl(baseHex);
  // Pale cloth has little headroom above, dark cloth little below.
  const upRoom = (100 - l) / 100;
  const downRoom = l / 100;
  const contrast = 0.55 + material.roughness * 0.5;

  return {
    deepShadow: darken(baseHex, 16 * downRoom * contrast + 3),
    shadow: darken(baseHex, 9 * downRoom * contrast + 2),
    base: baseHex,
    light: lighten(baseHex, 8 * upRoom * contrast + 1.5),
    // Sheen tends toward white but keeps a little of the dye, so a navy sateen
    // highlights blue-white rather than pure white.
    specular: mix(baseHex, '#FFFFFF', 0.35 + material.sheen * 0.45),
    specularStrength: 0.06 + material.sheen * 0.30,
  };
};

/** Fold count and softness follow drape: a crepe ripples, a wool blend folds. */
export const drapeProfile = (material: FabricMaterial) => ({
  foldCount: Math.round(3 + material.drape * 5),
  foldSoftness: 0.35 + material.drape * 0.55,
  foldContrast: 0.10 + (1 - material.drape) * 0.16 + material.thickness * 0.10,
});

// ── thread ──────────────────────────────────────────────────────────────────

export type ThreadKind = 'cotton' | 'silk' | 'matte' | 'metallic';

export type ThreadMaterial = {
  kind: ThreadKind;
  baseColour: string;
  sheen: number;
  roughness: number;
  metallic: boolean;
  /** Thread diameter in millimetres — a real embroidery thread is ~0.4–1.0 mm. */
  thickness: Mm;
  highlightResponse: number;
};

/**
 * Builds a thread material. `metallic` comes from the catalogue, so we never
 * advertise a lustre a tailor does not stock.
 */
export const threadMaterial = (
  hex: string,
  metallic: boolean,
  kind: ThreadKind = metallic ? 'metallic' : 'cotton',
): ThreadMaterial => ({
  kind,
  baseColour: hex,
  sheen: metallic ? 0.78 : kind === 'silk' ? 0.46 : kind === 'matte' ? 0.06 : 0.18,
  roughness: metallic ? 0.14 : kind === 'matte' ? 0.62 : 0.34,
  metallic,
  thickness: metallic ? 0.6 : 0.75,
  highlightResponse: metallic ? 0.9 : kind === 'silk' ? 0.5 : 0.2,
});

/** Highlight along the top of a stitch, giving thread a rounded body. */
export const threadHighlight = (thread: ThreadMaterial): string =>
  mix(thread.baseColour, '#FFFFFF', 0.20 + thread.sheen * 0.42);

export const threadShade = (thread: ThreadMaterial): string =>
  darken(thread.baseColour, 10 + thread.roughness * 8);
