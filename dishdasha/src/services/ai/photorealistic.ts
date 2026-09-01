/**
 * PHOTOREALISTIC DISHDASHA SERVICE.
 *
 * The rule this file exists to enforce: a generation request carries the
 * COMPLETE STRUCTURED DESIGN, never a loose text prompt. "White Omani
 * dishdasha with blue embroidery" throws away the pattern identity, the
 * millimetre scale, which thread is in which channel, the furakha and the
 * garment's proportions — which is exactly how a model ends up inventing a
 * different garment from the one the customer configured.
 *
 * Vendor-neutral by construction: the app depends on the interface, and the
 * server holds whichever provider's key.
 */
import type { DesignConfig, MeasurementProfile, PreviewAsset } from '@dd/domain/types';
import { getColor, getThreadColor } from '@dd/data/colors';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import { getOmaniStyle } from '@dd/domain/omaniStyles';
import { patternPhysical, patternZones } from '@dd/visual/patternPhysical';
import { materialFor } from '@dd/visual/materials';
import { hashConfig } from '@dd/engine/design';
import { measurementsFromProfile } from '@dd/visual/garmentGeometry';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import { withTelemetry } from './telemetry';
import type { ProviderInfo } from './types';

/**
 * The full specification handed to a generator. Every field the renderer uses
 * to draw the garment is here, so a provider has no reason to guess.
 */
export type GarmentSpec = {
  schemaVersion: 2;
  garmentType: 'OMANI_DISHDASHA';
  styleId: string;
  /** Defining characteristics a generator must not violate. */
  invariants: {
    collarless: true;
    ankleLength: true;
    loose: true;
    hasShaq: true;
    hasFurakha: boolean;
  };
  fabric: {
    id: string;
    name: string;
    composition: string | null;
    weave: string;
    sheen: number;
    roughness: number;
    drape: number;
    opacity: number;
  };
  colour: { id: string; name: string; hex: string };
  embroidery: {
    id: string;
    code: string;
    name: string;
    motif: string;
    zones: string[];
    /** Millimetres — the scale that must be preserved. */
    bandWidthMm: number;
    repeatMm: number;
    density: number;
    channels: { index: number; hex: string; name: string; metallic: boolean }[];
  } | null;
  furakha: { lengthMm: number; hex: string; name: string } | null;
  proportionsMm: Record<string, number>;
  viewAngle: number;
  /** Stable identity of the configuration; also the cache key. */
  configHash: string;
};

/** Builds the structured spec. This is the only accepted generator input. */
export const buildGarmentSpec = (
  config: DesignConfig,
  measurement: MeasurementProfile | null = null,
  viewAngle = 0,
): GarmentSpec => {
  const style = getOmaniStyle('om_standard');
  const fabric = getFabric(config.fabricId);
  const pattern = getPattern(config.embroideryPatternId);
  const colour = getColor(config.baseColorId);
  const material = materialFor(fabric?.texture);
  const furakhaKey = (config.componentOptions.furakha_length ?? 'furakha_medium').replace('furakha_', '');
  const furakhaThread = getThreadColor(config.furakhaColorId);
  const measurements = measurementsFromProfile(measurement);

  return {
    schemaVersion: 2,
    garmentType: 'OMANI_DISHDASHA',
    styleId: style.id,
    invariants: {
      collarless: true,
      ankleLength: true,
      loose: true,
      hasShaq: true,
      hasFurakha: furakhaKey !== 'none',
    },
    fabric: {
      id: fabric?.id ?? 'unknown',
      name: fabric?.name.en ?? 'unknown',
      composition: fabric?.composition ?? null,
      weave: material.weave,
      sheen: material.sheen,
      roughness: material.roughness,
      drape: material.drape,
      opacity: material.opacity,
    },
    colour: {
      id: config.baseColorId,
      name: colour?.name.en ?? config.baseColorId,
      hex: colour?.hex ?? '#FFFFFF',
    },
    embroidery: pattern
      ? {
          id: pattern.id,
          code: pattern.code,
          name: pattern.name.en,
          motif: pattern.motif,
          zones: patternZones(pattern),
          bandWidthMm: patternPhysical(pattern).width,
          repeatMm: patternPhysical(pattern).repeat,
          density: patternPhysical(pattern).density,
          channels: pattern.channels.map((ch, i) => {
            const th = getThreadColor(config.threadColorIds[i] ?? ch.defaultThreadColorId);
            return {
              index: ch.index,
              hex: th?.hex ?? '#000000',
              name: th?.name.en ?? '',
              metallic: th?.metallic ?? false,
            };
          }),
        }
      : null,
    furakha:
      furakhaKey === 'none'
        ? null
        : {
            lengthMm:
              style.furakhaProfile.cordLengths[furakhaKey as 'short' | 'medium' | 'long'] ?? 150,
            hex: furakhaThread?.hex ?? '#000000',
            name: furakhaThread?.name.en ?? '',
          },
    proportionsMm: { ...measurements },
    viewAngle,
    configHash: hashConfig(config),
  };
};

export type PhotorealisticRequest = {
  spec: GarmentSpec;
  quality: 'low' | 'high';
  /** Only ever set for try-on, and only after verified consent. */
  customerPhotoUri?: string | null;
};

export interface PhotorealisticDishdashaProvider {
  readonly info: ProviderInfo;
  generateProductPreview(req: PhotorealisticRequest): Promise<PreviewAsset>;
}

/**
 * MOCK provider — the default while MOCK_AI_MODE is on.
 *
 * It does not call a model and never claims to. It returns a `simulated:` URI
 * which the preview screen renders with the V2 vector engine at HIGH quality,
 * and every asset carries `isSimulated: true` so the UI can say so.
 */
export const SIMULATED_V2_PREFIX = 'simulated:v2:';

const cache = new Map<string, PreviewAsset>();

export class MockPhotorealisticProvider implements PhotorealisticDishdashaProvider {
  readonly info: ProviderInfo = {
    name: 'mock-photorealistic',
    model: 'vector-studio-v2',
    isLive: false,
  };

  async generateProductPreview(req: PhotorealisticRequest): Promise<PreviewAsset> {
    const key = `${req.spec.configHash}:${req.quality}:${req.spec.viewAngle}`;
    const hit = cache.get(key);
    if (hit) return hit;

    return withTelemetry(
      {
        kind: 'preview',
        provider: this.info.name,
        model: this.info.model,
        // The design hash only — never the photo URI.
        inputHash: req.spec.configHash,
        estimatedCost: 0,
      },
      async () => {
        await new Promise((r) => setTimeout(r, req.quality === 'high' ? 1500 : 650));
        const asset: PreviewAsset = {
          id: uuid(),
          designHash: req.spec.configHash,
          uri: `${SIMULATED_V2_PREFIX}${key}`,
          quality: req.quality,
          isSimulated: true,
          createdAt: nowIso(),
        };
        cache.set(key, asset);
        return asset;
      },
    );
  }
}

/**
 * Server-backed adapter. Posts the structured spec to OUR backend, which holds
 * the vendor key, builds the provider-specific request and enforces spend
 * limits. Compiles and typechecks; NOT verified against a live endpoint.
 */
export class RemotePhotorealisticProvider implements PhotorealisticDishdashaProvider {
  readonly info: ProviderInfo = { name: 'remote-photorealistic', model: 'server-configured', isLive: true };

  constructor(private readonly baseUrl: string) {}

  async generateProductPreview(req: PhotorealisticRequest): Promise<PreviewAsset> {
    return withTelemetry(
      {
        kind: 'preview',
        provider: this.info.name,
        model: this.info.model,
        inputHash: req.spec.configHash,
        estimatedCost: req.quality === 'high' ? 0.04 : 0.01,
      },
      async () => {
        const response = await fetch(`${this.baseUrl}/ai/product-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The whole spec, never a prose prompt.
          body: JSON.stringify({ spec: req.spec, quality: req.quality }),
        });
        if (!response.ok) throw new Error(`preview failed (${response.status})`);
        const data = (await response.json()) as { url: string };
        return {
          id: uuid(),
          designHash: req.spec.configHash,
          uri: data.url,
          quality: req.quality,
          isSimulated: false,
          createdAt: nowIso(),
        };
      },
    );
  }
}

export const clearPhotorealisticCache = () => cache.clear();
export const isSimulatedV2 = (uri: string) => uri.startsWith(SIMULATED_V2_PREFIX);
