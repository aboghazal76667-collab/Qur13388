import { defaultComponentOptions, getGarmentType } from '@dd/domain/garments';
import { getPattern } from '@dd/data/embroidery';
import { getFabric } from '@dd/data/fabrics';
import type { DesignConfig, GarmentTypeId } from '@dd/domain/types';

/**
 * DESIGN SERIALISATION.
 *
 * The structured config is the source of truth for a garment — never a
 * screenshot. It must round-trip losslessly through JSON so it can live in a
 * database column, a deep link, a cart item and an order line unchanged.
 */
export const SCHEMA_VERSION = 1;

export type SerializedDesign = {
  v: number;
  config: DesignConfig;
};

export const serializeDesign = (config: DesignConfig): string =>
  JSON.stringify({ v: SCHEMA_VERSION, config: normalizeConfig(config) });

export const deserializeDesign = (raw: string): DesignConfig | null => {
  try {
    const parsed = JSON.parse(raw) as SerializedDesign;
    if (!parsed || typeof parsed !== 'object' || !parsed.config) return null;
    // Future versions migrate here rather than breaking older saved designs.
    return normalizeConfig(parsed.config);
  } catch {
    return null;
  }
};

/**
 * Canonical form: keys ordered, thread list trimmed/padded to the pattern's
 * channel count. Two configs that render identically must normalise
 * identically, otherwise preview caching silently misses.
 */
export const normalizeConfig = (config: DesignConfig): DesignConfig => {
  const pattern = getPattern(config.embroideryPatternId);
  const channelCount = pattern ? pattern.channelCount : 0;
  const threads = (config.threadColorIds ?? []).slice(0, channelCount);
  while (threads.length < channelCount) {
    const fallback = pattern?.channels[threads.length]?.defaultThreadColorId;
    threads.push(fallback ?? threads[0] ?? 'th_white');
  }

  const componentOptions: Record<string, string> = {};
  for (const key of Object.keys(config.componentOptions ?? {}).sort()) {
    componentOptions[key] = config.componentOptions[key];
  }

  return {
    garmentTypeId: config.garmentTypeId,
    fabricId: config.fabricId,
    baseColorId: config.baseColorId,
    embroideryPatternId: config.embroideryPatternId,
    threadColorIds: threads,
    furakhaColorId: config.furakhaColorId,
    componentOptions,
  };
};

/**
 * Stable non-cryptographic hash (FNV-1a) of the canonical config.
 * Used for preview caching, duplicate detection and repeat-order matching —
 * never for security.
 */
export const hashConfig = (config: DesignConfig): string => {
  const input = serializeDesign(config);
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Second pass over the reversed string widens the output and cuts collisions.
  let h2 = 0x811c9dc5;
  for (let i = input.length - 1; i >= 0; i--) {
    h2 ^= input.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
};

export const createDefaultConfig = (
  garmentTypeId: GarmentTypeId = 'OMANI_DISHDASHA',
): DesignConfig => {
  const garment = getGarmentType(garmentTypeId);
  const pattern = getPattern('emb_01');
  return normalizeConfig({
    garmentTypeId,
    fabricId: 'fab_nasim_cotton',
    baseColorId: 'col_off_white',
    embroideryPatternId: pattern?.id ?? null,
    threadColorIds: pattern ? pattern.channels.map((c) => c.defaultThreadColorId) : [],
    furakhaColorId: 'th_navy',
    componentOptions: defaultComponentOptions(garment),
  });
};

/** Swapping pattern must keep compatible thread choices, not reset the design. */
export const applyPattern = (
  config: DesignConfig,
  patternId: string | null,
): DesignConfig => {
  const pattern = getPattern(patternId);
  if (!pattern) {
    return normalizeConfig({ ...config, embroideryPatternId: null, threadColorIds: [] });
  }
  const threads = pattern.channels.map(
    (channel, i) => config.threadColorIds[i] ?? channel.defaultThreadColorId,
  );
  return normalizeConfig({ ...config, embroideryPatternId: pattern.id, threadColorIds: threads });
};

/** Changing one thread channel must not touch the others. */
export const applyThreadColor = (
  config: DesignConfig,
  channelIndex: number,
  threadColorId: string,
): DesignConfig => {
  const threads = [...config.threadColorIds];
  if (channelIndex < 0 || channelIndex >= threads.length) return config;
  threads[channelIndex] = threadColorId;
  return normalizeConfig({ ...config, threadColorIds: threads });
};

export type ConfigIssue =
  | { kind: 'fabric_missing' }
  | { kind: 'fabric_unavailable'; fabricId: string }
  | { kind: 'color_unavailable_in_fabric'; colorId: string; fabricId: string }
  | { kind: 'pattern_unavailable'; patternId: string };

/** Validates a config against the live catalogue before checkout. */
export const validateConfig = (config: DesignConfig): ConfigIssue[] => {
  const issues: ConfigIssue[] = [];
  const fabric = getFabric(config.fabricId);
  if (!fabric) {
    issues.push({ kind: 'fabric_missing' });
  } else {
    if (!fabric.active || !fabric.inStock) {
      issues.push({ kind: 'fabric_unavailable', fabricId: fabric.id });
    }
    if (!fabric.colorIds.includes(config.baseColorId)) {
      issues.push({
        kind: 'color_unavailable_in_fabric',
        colorId: config.baseColorId,
        fabricId: fabric.id,
      });
    }
  }
  if (config.embroideryPatternId) {
    const pattern = getPattern(config.embroideryPatternId);
    if (!pattern || !pattern.active) {
      issues.push({ kind: 'pattern_unavailable', patternId: config.embroideryPatternId });
    }
  }
  return issues;
};
