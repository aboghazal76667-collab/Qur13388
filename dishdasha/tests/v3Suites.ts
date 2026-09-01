import { describe, expect, it } from './harness';

import {
  ASSET_CONTRACT_VERSION,
  EMBROIDERY_SURFACE_TO_ZONE,
  REFERENCE_MANIFEST,
  REQUIRED_FURAKHA_ZONES,
  REQUIRED_GARMENT_ZONES,
  manifestIsUsable,
  validateManifest,
  type AssetManifest,
} from '@dd/render/assetManifest';
import { GARMENT_ASSETS, customerReadyAsset, hasProfessionalAsset } from '@dd/render/assetRegistry';
import {
  fallbackAfterLoadFailure,
  REASON_LABELS,
  selectRenderer,
} from '@dd/render/rendererAdapter';
import {
  CAMERA_PRESETS,
  CANONICAL_PREVIEW_VIEWS,
  CUSTOMER_PRESETS,
  clampElevation,
  clampZoom,
  presetForAzimuth,
} from '@dd/render/cameraPresets';
import { TIER_SETTINGS, resolveTier } from '@dd/render/quality3d';
import { STUDIO_RIG, exposureFor } from '@dd/render/lighting';
import { fabricToPbr, recolour, threadToPbr } from '@dd/render/materials3d';
import { channelForMaterialSlot, computePlacements, placementsUseChannel } from '@dd/render/embroideryPlacement';
import { buildFurakhaSpec, furakhaLengthFromOption } from '@dd/render/furakhaComponent';
import { ACCEPTANCE_CHECKS, evaluateAcceptance } from '@dd/render/visualAcceptance';
import { canPublishTwin, fabricTwinPipeline } from '@dd/render/fabricDigitalTwin';
import { V2FallbackRenderer } from '@dd/render/fallback/V2FallbackRenderer';
import { buildGarmentSpec, buildReferenceConstraints } from '@dd/services/ai/photorealistic';
import { materialFor, threadMaterial } from '@dd/visual/materials';
import { getPattern } from '@dd/data/embroidery';
import { DEMO_MEASUREMENTS, DEMO_USUAL_CONFIG } from '@dd/data/demo';
import { createDefaultConfig } from '@dd/engine/design';

// ── honest state of the 3D path ─────────────────────────────────────────────
describe('professional asset state', () => {
  it('registers no professional 3D asset — the honest current state', () => {
    expect(Object.keys(GARMENT_ASSETS)).toHaveLength(0);
    expect(hasProfessionalAsset()).toBe(false);
    expect(customerReadyAsset('om_standard')).toBe(null);
  });

  it('sends every customer to the V2 fallback while no asset exists', () => {
    const selection = selectRenderer({ styleId: 'om_standard', webglAvailable: true });
    expect(selection.kind).toBe('v2fallback');
    expect(selection.reason).toBe('no_professional_asset');
    expect(selection.assetUri).toBe(null);
  });

  it('reports the V2 fallback as NOT a true mesh', () => {
    expect(new V2FallbackRenderer().capabilities.trueMesh).toBe(false);
  });
});

// ── renderer selection ──────────────────────────────────────────────────────
describe('renderer selection', () => {
  it('falls back when WebGL is unavailable', () => {
    const s = selectRenderer({ styleId: 'om_standard', webglAvailable: false });
    expect(s.kind).toBe('v2fallback');
    expect(s.reason).toBe('webgl_unavailable');
  });

  it('falls back on a low-power device', () => {
    const s = selectRenderer({ styleId: 'om_standard', webglAvailable: true, lowPower: true });
    expect(s.reason).toBe('low_power_device');
  });

  it('falls back after a GLB load failure', () => {
    const s = fallbackAfterLoadFailure();
    expect(s.kind).toBe('v2fallback');
    expect(s.reason).toBe('asset_load_failed');
  });

  it('honours a developer force flag in both directions', () => {
    expect(selectRenderer({ styleId: 'om_standard', webglAvailable: false, force: 'real3d' }).kind).toBe('real3d');
    expect(selectRenderer({ styleId: 'om_standard', webglAvailable: true, force: 'v2fallback' }).kind).toBe('v2fallback');
  });

  it('explains every selection reason in words', () => {
    for (const reason of Object.keys(REASON_LABELS)) {
      expect(REASON_LABELS[reason as keyof typeof REASON_LABELS].length).toBeGreaterThan(8);
    }
  });
});

// ── asset manifest contract ─────────────────────────────────────────────────
describe('asset manifest validation', () => {
  it('accepts the reference manifest', () => {
    expect(validateManifest(REFERENCE_MANIFEST).filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(manifestIsUsable(REFERENCE_MANIFEST)).toBe(true);
  });

  it('rejects a manifest missing a required garment zone', () => {
    const broken: AssetManifest = {
      ...REFERENCE_MANIFEST,
      nodes: { ...REFERENCE_MANIFEST.nodes, shaq: undefined },
    };
    expect(manifestIsUsable(broken)).toBe(false);
    expect(validateManifest(broken).some((i) => i.field === 'nodes.shaq')).toBeTruthy();
  });

  it('rejects a furakha baked into the body instead of separate geometry', () => {
    const broken: AssetManifest = { ...REFERENCE_MANIFEST, furakhaNodes: {} };
    const issues = validateManifest(broken);
    expect(manifestIsUsable(broken)).toBe(false);
    expect(issues.some((i) => i.message.includes('baked into the body'))).toBeTruthy();
  });

  it('rejects an asset with no shaq embroidery surface', () => {
    const broken: AssetManifest = { ...REFERENCE_MANIFEST, embroiderySurfaces: {} };
    expect(manifestIsUsable(broken)).toBe(false);
  });

  it('rejects a mismatched contract version', () => {
    const broken: AssetManifest = { ...REFERENCE_MANIFEST, contractVersion: 99 };
    expect(manifestIsUsable(broken)).toBe(false);
  });

  it('warns when the mesh exceeds the mobile triangle budget', () => {
    const heavy: AssetManifest = { ...REFERENCE_MANIFEST, triangleCount: 400000 };
    const issues = validateManifest(heavy);
    expect(issues.some((i) => i.field === 'triangleCount')).toBeTruthy();
    // A warning must not block loading — it only steers the render tier.
    expect(manifestIsUsable(heavy)).toBe(true);
  });

  it('requires every zone the app depends on', () => {
    expect(REQUIRED_GARMENT_ZONES).toContain('shaq');
    expect(REQUIRED_GARMENT_ZONES).toContain('neckline');
    expect(REQUIRED_FURAKHA_ZONES).toHaveLength(3);
  });

  it('maps every embroidery surface to a catalogue zone', () => {
    for (const surface of Object.keys(EMBROIDERY_SURFACE_TO_ZONE)) {
      expect(EMBROIDERY_SURFACE_TO_ZONE[surface as keyof typeof EMBROIDERY_SURFACE_TO_ZONE].length).toBeGreaterThan(2);
    }
  });

  it('pins the contract version so a stale asset cannot load silently', () => {
    expect(ASSET_CONTRACT_VERSION).toBe(1);
  });
});

// ── camera ──────────────────────────────────────────────────────────────────
describe('camera presets', () => {
  it('offers front, 45, side and back to customers', () => {
    expect(CUSTOMER_PRESETS).toEqual(['FRONT', 'FRONT_45', 'SIDE', 'BACK']);
    expect(CAMERA_PRESETS.FRONT.azimuth).toBe(0);
    expect(CAMERA_PRESETS.SIDE.azimuth).toBe(90);
    expect(CAMERA_PRESETS.BACK.azimuth).toBe(180);
  });

  it('uses a long lens, not a distorting wide angle', () => {
    for (const id of CUSTOMER_PRESETS) {
      expect(CAMERA_PRESETS[id].fov).toBeLessThan(36);
    }
  });

  it('clamps zoom and elevation to a flattering product range', () => {
    expect(clampZoom(100)).toBeLessThan(6.01);
    expect(clampZoom(0.01)).toBeGreaterThan(0.74);
    // Never look up the hem of a garment.
    expect(clampElevation(-90)).toBeGreaterThan(-8.01);
    expect(clampElevation(90)).toBeLessThan(22.01);
  });

  it('resolves the nearest customer preset for an angle', () => {
    expect(presetForAzimuth(6)).toBe('FRONT');
    expect(presetForAzimuth(48)).toBe('FRONT_45');
    expect(presetForAzimuth(178)).toBe('BACK');
  });

  it('names the canonical views handed to the preview provider', () => {
    expect(CANONICAL_PREVIEW_VIEWS).toContain('FRONT');
    expect(CANONICAL_PREVIEW_VIEWS).toContain('DETAIL_SHAQ');
  });
});

// ── performance tiers ───────────────────────────────────────────────────────
describe('render tiers', () => {
  it('drops to LOW for a heavy mesh', () => {
    expect(resolveTier({ pixelRatio: 3, triangleCount: 200000, isDetailView: false })).toBe('LOW');
  });

  it('respects an explicit low-power request', () => {
    expect(resolveTier({ pixelRatio: 2, triangleCount: 1000, isDetailView: true, lowPower: true })).toBe('LOW');
  });

  it('caps pixel ratio so a 3x screen does not shade nine times the pixels', () => {
    expect(TIER_SETTINGS.HIGH.maxPixelRatio).toBeLessThan(3);
    expect(TIER_SETTINGS.LOW.shadows).toBe(false);
  });

  it('gives a light mesh on a modest screen the full treatment', () => {
    expect(resolveTier({ pixelRatio: 2, triangleCount: 20000, isDetailView: false })).toBe('HIGH');
  });
});

// ── lighting ────────────────────────────────────────────────────────────────
describe('studio lighting', () => {
  it('has key, fill, rim and ambient', () => {
    expect(STUDIO_RIG.map((l) => l.id).sort()).toEqual(['ambient', 'fill', 'key', 'rim']);
  });

  it('only the key casts a shadow', () => {
    expect(STUDIO_RIG.filter((l) => l.castShadow)).toHaveLength(1);
  });

  it('pulls exposure down for white cloth and lifts it for dark cloth', () => {
    // Otherwise white blows out and navy crushes — the two failure modes the
    // acceptance gate checks for.
    expect(exposureFor(92)).toBeLessThan(1);
    expect(exposureFor(15)).toBeGreaterThan(1);
    expect(exposureFor(50)).toBe(1);
  });
});

// ── PBR materials ───────────────────────────────────────────────────────────
describe('PBR material mapping', () => {
  it('changing colour changes ONLY the colour', () => {
    const sateen = fabricToPbr(materialFor('sateen'), '#FFFFFF');
    const navy = recolour(sateen, '#25384F');
    expect(navy.color).toBe('#25384F');
    // Everything that belongs to the cloth survives the dye change.
    expect(navy.roughness).toBe(sateen.roughness);
    expect(navy.sheen).toBe(sateen.sheen);
    expect(navy.weaveRepeat).toBe(sateen.weaveRepeat);
    expect(navy.normalScale).toBe(sateen.normalScale);
  });

  it('keeps different fabrics visually distinct in the same colour', () => {
    const sateen = fabricToPbr(materialFor('sateen'), '#EFE7D6');
    const linen = fabricToPbr(materialFor('linen_slub'), '#EFE7D6');
    expect(sateen.sheen).toBeGreaterThan(linen.sheen);
    expect(linen.roughness).toBeGreaterThan(sateen.roughness);
    expect(sateen.weaveRepeat === linen.weaveRepeat).toBeFalsy();
  });

  it('derives weave tiling from real yarn pitch', () => {
    const poplin = fabricToPbr(materialFor('poplin'), '#FFFFFF', 1000);
    // 1000 mm / 0.42 mm yarn ≈ 2380 repeats per metre.
    expect(poplin.weaveRepeat).toBeGreaterThan(2000);
    expect(poplin.weaveRepeat).toBeLessThan(2800);
  });

  it('makes cloth dielectric and only metallic thread metallic', () => {
    expect(fabricToPbr(materialFor('sateen'), '#FFF').metalness).toBe(0);
    expect(threadToPbr(threadMaterial('#C39B4A', true)).metalness).toBeGreaterThan(0.5);
    expect(threadToPbr(threadMaterial('#22354C', false)).metalness).toBe(0);
  });
});

// ── embroidery placement ────────────────────────────────────────────────────
describe('embroidery placement system', () => {
  const pattern = getPattern('emb_06');

  it('places nothing when there is no pattern', () => {
    expect(computePlacements({ pattern: null, availableSurfaces: [], includeCuffs: false, includeBack: false })).toHaveLength(0);
  });

  it('always places the shaq, the principal Omani zone', () => {
    const placements = computePlacements({ pattern: pattern!, availableSurfaces: [], includeCuffs: false, includeBack: false });
    expect(placements.some((p) => p.zone === 'SHAQ')).toBeTruthy();
  });

  it('keeps the physical band width, not a pixel size', () => {
    const shaq = computePlacements({ pattern: pattern!, availableSurfaces: [], includeCuffs: false, includeBack: false })
      .find((p) => p.zone === 'SHAQ')!;
    expect(shaq.bandWidthMm).toBeLessThan(30);
    expect(shaq.repeatMm).toBeLessThan(46);
  });

  it('binds to asset surfaces when a 3D asset provides them', () => {
    const withSurfaces = computePlacements({
      pattern: pattern!,
      availableSurfaces: ['shaqLeftEmbroidery', 'necklineEmbroidery'],
      includeCuffs: false,
      includeBack: false,
    });
    expect(withSurfaces.find((p) => p.zone === 'SHAQ')?.surface).toBe('shaqLeftEmbroidery');
    expect(withSurfaces.find((p) => p.zone === 'SHAQ')?.technique).toBe('decal');
  });

  it('falls back to vector technique with no asset surfaces', () => {
    const placements = computePlacements({ pattern: pattern!, availableSurfaces: [], includeCuffs: false, includeBack: false });
    expect(placements[0].technique).toBe('vector');
    expect(placements[0].surface).toBe(null);
  });

  it('omits cuffs and back unless the design asks for them', () => {
    const off = computePlacements({ pattern: pattern!, availableSurfaces: [], includeCuffs: false, includeBack: false });
    expect(off.some((p) => p.zone === 'CUFF_LEFT')).toBeFalsy();
    expect(off.some((p) => p.zone === 'BACK')).toBeFalsy();
  });

  it('maps material slots to independent thread channels', () => {
    const slots = ['MAT_Emb_Ch1', 'MAT_Emb_Ch2', 'MAT_Emb_Ch3'];
    expect(channelForMaterialSlot('MAT_Emb_Ch1', slots)).toBe(1);
    expect(channelForMaterialSlot('MAT_Emb_Ch2', slots)).toBe(2);
    expect(channelForMaterialSlot('MAT_Fabric', slots)).toBe(null);
  });

  it('reports which channels a design actually uses', () => {
    const placements = computePlacements({ pattern: pattern!, availableSurfaces: [], includeCuffs: false, includeBack: false });
    expect(placementsUseChannel(placements, 1)).toBe(true);
    expect(placementsUseChannel(placements, 3)).toBe(pattern!.channelCount === 3);
  });
});

// ── furakha ─────────────────────────────────────────────────────────────────
describe('furakha component', () => {
  it('is a separate component that hangs under gravity', () => {
    const spec = buildFurakhaSpec('medium', '#C39B4A');
    expect(spec.present).toBe(true);
    expect(spec.gravityAligned).toBe(true);
    expect(spec.cordLengthMm).toBeGreaterThan(50);
  });

  it('resolves length options and absence', () => {
    expect(furakhaLengthFromOption('furakha_long')).toBe('long');
    expect(furakhaLengthFromOption('furakha_none')).toBe('none');
    expect(furakhaLengthFromOption(undefined)).toBe('medium');
    expect(buildFurakhaSpec('none', '#000').present).toBe(false);
  });

  it('carries metallic thread identity', () => {
    expect(buildFurakhaSpec('medium', '#C39B4A', null, true).material).toBe('metallic');
  });
});

// ── visual acceptance gate ──────────────────────────────────────────────────
describe('visual acceptance gate', () => {
  it('treats an unreviewed asset as NOT accepted', () => {
    const verdict = evaluateAcceptance({});
    expect(verdict.accepted).toBe(false);
    expect(verdict.unanswered.length).toBe(verdict.total);
  });

  it('rejects an asset that fails even one blocking check', () => {
    const all: Record<string, boolean> = {};
    for (const c of ACCEPTANCE_CHECKS) all[c.id] = true;
    all.no_saudi_stand_collar = false;
    expect(evaluateAcceptance(all).accepted).toBe(false);
    expect(evaluateAcceptance(all).failing).toContain('no_saudi_stand_collar');
  });

  it('accepts only when every blocking check passes', () => {
    const all: Record<string, boolean> = {};
    for (const c of ACCEPTANCE_CHECKS) all[c.id] = true;
    expect(evaluateAcceptance(all).accepted).toBe(true);
  });

  it('checks the things that distinguish an Omani dishdasha', () => {
    const ids = ACCEPTANCE_CHECKS.map((c) => c.id);
    expect(ids).toContain('no_saudi_stand_collar');
    expect(ids).toContain('no_gulf_collar');
    expect(ids).toContain('same_mesh_all_views');
    expect(ids).toContain('no_fake_perspective');
  });

  it('also gates presentation, not only geometric accuracy', () => {
    // An accurate garment framed like a developer viewport still fails as a
    // product, and the master reference includes detail crops.
    const ids = ACCEPTANCE_CHECKS.map((c) => c.id);
    expect(ids).toContain('studio_presentation');
    expect(ids).toContain('detail_zoom_holds_up');
    expect(ACCEPTANCE_CHECKS.every((c) => c.blocking)).toBeTruthy();
  });
});

// ── GarmentSpec propagation ─────────────────────────────────────────────────
describe('GarmentSpec is the single source of truth', () => {
  const spec = buildGarmentSpec(DEMO_USUAL_CONFIG, DEMO_MEASUREMENTS[0], 0);

  it('carries the catalogue texture, so a sateen never renders as plain weave', () => {
    expect(spec.fabric.texture.length).toBeGreaterThan(3);
    expect(materialFor(spec.fabric.texture).weave.length).toBeGreaterThan(2);
  });

  it('reaches the fallback renderer unchanged', () => {
    const renderer = new V2FallbackRenderer();
    renderer.applyGarmentSpec(spec);
    expect(renderer.getState().spec?.configHash).toBe(spec.configHash);
  });

  it('restates the constraints a generator must not violate', () => {
    const constraints = buildReferenceConstraints(spec);
    expect(constraints.collarless).toBe(true);
    expect(constraints.hasShaq).toBe(true);
    expect(constraints.forbid.some((f) => f.includes('collar'))).toBeTruthy();
    expect(constraints.embroideryBandWidthMm).toBeLessThan(30);
  });

  it('keeps rotation state without changing the design', () => {
    const renderer = new V2FallbackRenderer();
    renderer.applyGarmentSpec(spec);
    renderer.rotate(90);
    expect(renderer.getViewState().azimuth).toBe(90);
    expect(renderer.getState().spec?.configHash).toBe(spec.configHash);
    renderer.rotate(360);
    expect(renderer.getViewState().azimuth).toBe(90);
  });

  it('maps a camera preset onto the fallback view state', () => {
    const renderer = new V2FallbackRenderer();
    renderer.setCamera('BACK');
    expect(renderer.getViewState().azimuth).toBe(180);
  });

  it('produces the same spec identity for the same design', () => {
    // createDefaultConfig() is deliberately the same configuration as the demo
    // "usual" design, so the hash must match: identity follows the design, not
    // the object instance.
    const same = buildGarmentSpec(createDefaultConfig(), DEMO_MEASUREMENTS[0], 0);
    expect(same.configHash).toBe(spec.configHash);
  });

  it('produces a different spec for a different design', () => {
    const changed = {
      ...DEMO_USUAL_CONFIG,
      fabricId: 'fab_jabal_winter',
      baseColorId: 'col_midnight',
      threadColorIds: ['th_gold', 'th_ivory'],
    };
    const other = buildGarmentSpec(changed, DEMO_MEASUREMENTS[0], 0);
    expect(other.configHash === spec.configHash).toBeFalsy();
  });

  it('changes spec identity when only one thread channel changes', () => {
    const oneChannel = {
      ...DEMO_USUAL_CONFIG,
      threadColorIds: [DEMO_USUAL_CONFIG.threadColorIds[0], 'th_gold'],
    };
    const other = buildGarmentSpec(oneChannel, DEMO_MEASUREMENTS[0], 0);
    expect(other.configHash === spec.configHash).toBeFalsy();
  });

  it('reports honestly that the fallback cannot capture a raster preview', async () => {
    expect(await new V2FallbackRenderer().capturePreview()).toBe(null);
  });
});

// ── fabric digital twin ─────────────────────────────────────────────────────
describe('fabric digital twin', () => {
  it('is architecture only and says so', async () => {
    expect(fabricTwinPipeline.implemented).toBe(false);
    let threw = false;
    try {
      await fabricTwinPipeline.create('t', {
        supplier: 's', code: 'c', colourName: 'ivory', weightGsm: 120,
        season: 'summer', pricePerGarment: 8, inStock: true, capturedWidthMm: 200,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('refuses to publish without calibrated colour or a physical capture width', () => {
    const gate = canPublishTwin({
      id: 'x', tailorBusinessId: 't', stage: 'awaiting_approval',
      capture: { frontPhotoRef: 'a', closeTextureRef: 'b', angledLightRef: null },
      metadata: { supplier: 's', code: 'c', colourName: 'ivory', weightGsm: 120, season: 'summer', pricePerGarment: 8, inStock: true, capturedWidthMm: null },
      calibratedColourHex: null, tileRef: null, material: null, pbr: null,
      rejectionReason: null, createdAt: '', updatedAt: '',
    });
    expect(gate.ok).toBe(false);
    expect(gate.reasons.some((r) => r.includes('colour not calibrated'))).toBeTruthy();
    expect(gate.reasons.some((r) => r.includes('capture width'))).toBeTruthy();
  });
});
