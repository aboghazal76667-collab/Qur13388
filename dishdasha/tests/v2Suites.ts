import { describe, expect, it } from './harness';

import { OM_STANDARD, OMANI_DISHDASHA_STYLES, getOmaniStyle, selectableOmaniStyles } from '@dd/domain/omaniStyles';
import { CANVAS, isDetailWorthDrawing, mmPerPoint, regionToViewBox } from '@dd/visual/units';
import {
  CANONICAL,
  buildFrame,
  bodyOutlinePath,
  centreFrontX,
  facing,
  measurementsFromProfile,
  nearestSnap,
  normalizeAngle,
  projectedHalfWidth,
  sleevePath,
} from '@dd/visual/garmentGeometry';
import { MATERIAL_BY_TEXTURE, materialFor, shadingRamp, threadMaterial, drapeProfile } from '@dd/visual/materials';
import {
  PHYSICAL_LIMITS,
  ZONE_BAND_WIDTH,
  defaultPhysical,
  repeatsAlong,
  scaleForZone,
  validatePhysical,
} from '@dd/visual/embroideryScale';
import { patternPhysical, patternZones } from '@dd/visual/patternPhysical';
import { resolveQuality } from '@dd/visual/quality';
import { EMBROIDERY_PATTERNS } from '@dd/data/embroidery';
import { DEMO_MEASUREMENTS, DEMO_USUAL_CONFIG } from '@dd/data/demo';
import { createDefaultConfig, hashConfig } from '@dd/engine/design';
import { buildGarmentSpec } from '@dd/services/ai/photorealistic';
import { evidenceFromOwnRenderer, validateAgainstSpec } from '@dd/services/ai/consistencyValidator';
import { assessPhoto, MockVirtualTryOnProvider } from '@dd/services/ai/virtualTryOn';
import { LocalStylistV2, matchLabelFor } from '@dd/services/ai/stylistV2';
import { canPublish } from '@dd/services/ingestion/embroideryImporter';
import { fabricScanner } from '@dd/services/ingestion/fabricScanner';
import { dictionaries } from '@dd/i18n/strings';

// ── Omani authenticity ──────────────────────────────────────────────────────
describe('Omani authenticity', () => {
  it('ships exactly one style and does not invent regional variants', () => {
    expect(OMANI_DISHDASHA_STYLES).toHaveLength(1);
    expect(OM_STANDARD.region).toBe(null);
    expect(selectableOmaniStyles()).toHaveLength(1);
  });

  it('is collarless — the defining characteristic', () => {
    expect(OM_STANDARD.necklineProfile.collarless).toBe(true);
  });

  it('has a shaq and a furakha', () => {
    expect(OM_STANDARD.shaqProfile.length).toBeGreaterThan(100);
    expect(OM_STANDARD.embroideryZones).toContain('SHAQ');
    expect(OM_STANDARD.furakhaProfile.cordLengths.medium).toBeGreaterThan(50);
  });

  it('marks its millimetre values as needing a tailor reference', () => {
    expect(OM_STANDARD.referenceStatus).toBe('reference_required');
    expect(OM_STANDARD.references.some((r) => r.includes('REFERENCE_REQUIRED'))).toBeTruthy();
  });

  it('falls back to the standard style for an unknown id', () => {
    expect(getOmaniStyle('om_nonexistent').id).toBe('om_standard');
  });
});

// ── the V1 scale regression, guarded ────────────────────────────────────────
describe('embroidery physical scale', () => {
  it('keeps the shaq band near 18mm — V1 rendered 130mm', () => {
    expect(OM_STANDARD.shaqProfile.bandWidth).toBeLessThan(30);
    expect(OM_STANDARD.shaqProfile.bandWidth).toBeGreaterThan(8);
    expect(ZONE_BAND_WIDTH.SHAQ).toBeLessThan(30);
  });

  it('keeps every zone band within manufacturable limits', () => {
    for (const [zone, width] of Object.entries(ZONE_BAND_WIDTH)) {
      expect(width).toBeGreaterThan(PHYSICAL_LIMITS.width.min - 1);
      expect(width).toBeLessThan(PHYSICAL_LIMITS.width.max + 1);
    }
  });

  it('rejects physically impossible embroidery', () => {
    const bad = { width: 130, repeat: 160, density: 40, stitchWeight: 6, scaleConstraints: { min: 1, max: 1 } };
    const issues = validatePhysical(bad);
    expect(issues.length).toBeGreaterThan(3);
    expect(issues.some((i) => i.field === 'width')).toBeTruthy();
  });

  it('accepts every seeded pattern as physically plausible', () => {
    for (const pattern of EMBROIDERY_PATTERNS) {
      if (pattern.motif === 'none') continue;
      expect(validatePhysical(patternPhysical(pattern))).toHaveLength(0);
    }
  });

  it('scales a pattern into a zone rather than the zone around the pattern', () => {
    const wide = { width: 24, repeat: 28, density: 10, stitchWeight: 0.7, scaleConstraints: { min: 0.5, max: 1.6 } };
    const fitted = scaleForZone(wide, 'NECKLINE');
    expect(fitted.bandWidth).toBe(ZONE_BAND_WIDTH.NECKLINE);
    // The resulting band is the zone's width, never the pattern's.
    expect(fitted.bandWidth).toBeLessThan(wide.width);
  });

  it('clamps scaling so a pattern never balloons', () => {
    const tiny = { width: 4, repeat: 6, density: 8, stitchWeight: 0.5, scaleConstraints: { min: 0.8, max: 1.2 } };
    expect(scaleForZone(tiny, 'SHAQ').scale).toBeLessThan(1.21);
  });

  it('does not offer a wide pattern for a narrow neckline', () => {
    const widePattern = EMBROIDERY_PATTERNS.find((p) => patternPhysical(p).width > 20);
    if (widePattern) expect(patternZones(widePattern).includes('NECKLINE')).toBeFalsy();
  });

  it('always allows the shaq, the principal Omani zone', () => {
    for (const p of EMBROIDERY_PATTERNS.filter((x) => x.motif !== 'none')) {
      expect(patternZones(p)).toContain('SHAQ');
    }
  });

  it('computes repeats along a run', () => {
    expect(repeatsAlong(100, 20)).toBe(5);
    expect(repeatsAlong(0, 20)).toBe(1);
  });

  it('derives a conservative profile for an unmeasured pattern', () => {
    expect(validatePhysical(defaultPhysical(3, 7))).toHaveLength(0);
  });
});

// ── geometry and rotation ───────────────────────────────────────────────────
describe('garment geometry', () => {
  const frame = buildFrame(CANONICAL, OM_STANDARD);

  it('falls A-line: the hem is never narrower than the chest', () => {
    expect(frame.hem.halfWidth).toBeGreaterThan(frame.chest.halfWidth);
  });

  it('is ankle length relative to its width', () => {
    const height = frame.hemY - frame.shoulder.y;
    expect(height / (frame.hem.halfWidth * 2)).toBeGreaterThan(1.9);
  });

  it('narrows as it turns to the side and returns at the back', () => {
    const front = projectedHalfWidth(frame.chest, 0);
    const side = projectedHalfWidth(frame.chest, 90);
    const back = projectedHalfWidth(frame.chest, 180);
    expect(side).toBeLessThan(front);
    expect(Math.abs(back - front)).toBeLessThan(0.001);
  });

  it('keeps the garment the same size at every angle — it must not morph', () => {
    for (let a = 0; a < 360; a += 15) {
      const half = projectedHalfWidth(frame.hem, a);
      expect(half).toBeGreaterThan(frame.hem.halfDepth - 1);
      expect(half).toBeLessThan(frame.hem.halfWidth + 1);
    }
  });

  it('moves the centre front across the body as it rotates', () => {
    expect(Math.abs(centreFrontX(frame.chest, 0))).toBeLessThan(0.001);
    expect(centreFrontX(frame.chest, 90)).toBeGreaterThan(10);
    expect(Math.abs(centreFrontX(frame.chest, 180))).toBeLessThan(0.001);
  });

  it('shows the front from the front and hides it from the back', () => {
    expect(facing(frame.chest, 0, 0)).toBeGreaterThan(0.9);
    expect(facing(frame.chest, 0, 180)).toBeLessThan(-0.9);
    expect(facing(frame.chest, 180, 180)).toBeGreaterThan(0.9);
  });

  it('produces a valid path at every angle', () => {
    for (let a = 0; a < 360; a += 30) {
      const d = bodyOutlinePath(frame, a);
      expect(d.startsWith('M')).toBeTruthy();
      expect(d.includes('NaN')).toBeFalsy();
      expect(sleevePath(frame, 'left', a).includes('NaN')).toBeFalsy();
      expect(sleevePath(frame, 'right', a).includes('NaN')).toBeFalsy();
    }
  });

  it('normalises and snaps angles', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(nearestSnap(8)).toBe(0);
    expect(nearestSnap(96)).toBe(90);
    expect(nearestSnap(172)).toBe(180);
  });
});

// ── measurements drive proportions, never a fitted garment ──────────────────
describe('measurement-driven proportions', () => {
  it('reads a saved profile into millimetres', () => {
    const m = measurementsFromProfile(DEMO_MEASUREMENTS[0]);
    expect(m.totalLength).toBe(1460);
    expect(m.chestCircumference).toBe(1040);
  });

  it('falls back to canonical without a profile', () => {
    expect(measurementsFromProfile(null)).toEqual(CANONICAL);
  });

  it('clamps extreme values so the robe stays a robe', () => {
    const wild = {
      ...DEMO_MEASUREMENTS[0],
      values: { ...DEMO_MEASUREMENTS[0].values, total_length: 400, chest: 40 },
    };
    const m = measurementsFromProfile(wild);
    expect(m.totalLength).toBeGreaterThan(1099);
    expect(m.chestCircumference).toBeGreaterThan(759);
  });

  it('keeps the garment loose: ease is always added over the body', () => {
    const frame = buildFrame(measurementsFromProfile(DEMO_MEASUREMENTS[0]), OM_STANDARD);
    const bodyHalf = DEMO_MEASUREMENTS[0].values.chest * 10 / 4;
    expect(frame.chest.halfWidth).toBeGreaterThan(bodyHalf);
  });

  it('grows the garment when the customer is larger', () => {
    const bigger = {
      ...DEMO_MEASUREMENTS[0],
      values: { ...DEMO_MEASUREMENTS[0].values, chest: 130, total_length: 165 },
    };
    const a = buildFrame(measurementsFromProfile(DEMO_MEASUREMENTS[0]), OM_STANDARD);
    const b = buildFrame(measurementsFromProfile(bigger), OM_STANDARD);
    expect(b.chest.halfWidth).toBeGreaterThan(a.chest.halfWidth);
    expect(b.hemY).toBeGreaterThan(a.hemY);
  });
});

// ── fabric / colour separation ──────────────────────────────────────────────
describe('fabric material system', () => {
  it('separates fabric from colour: same dye, different material, different render', () => {
    const sateen = shadingRamp('#EFE7D6', materialFor('sateen'));
    const linen = shadingRamp('#EFE7D6', materialFor('linen_slub'));
    expect(sateen.specularStrength).toBeGreaterThan(linen.specularStrength);
    expect(sateen.deepShadow === linen.deepShadow).toBeFalsy();
  });

  it('gives every catalogue texture a material', () => {
    for (const key of Object.keys(MATERIAL_BY_TEXTURE)) {
      const m = MATERIAL_BY_TEXTURE[key as keyof typeof MATERIAL_BY_TEXTURE];
      expect(m.weavePitch).toBeGreaterThan(0.2);
      expect(m.weavePitch).toBeLessThan(1.5);
    }
  });

  it('adapts the shading ramp to dye lightness', () => {
    const pale = shadingRamp('#FFFFFF', materialFor('poplin'));
    const dark = shadingRamp('#1B2536', materialFor('poplin'));
    // A near-white has no headroom above; a navy has almost none below.
    expect(pale.light === '#FFFFFF').toBeTruthy();
    expect(dark.deepShadow === dark.base).toBeFalsy();
  });

  it('drapes more softly the more fluid the cloth', () => {
    expect(drapeProfile(materialFor('crepe')).foldCount)
      .toBeGreaterThan(drapeProfile(materialFor('wool_blend')).foldCount);
  });

  it('reports metallic thread as more lustrous than cotton', () => {
    expect(threadMaterial('#C39B4A', true).sheen)
      .toBeGreaterThan(threadMaterial('#C39B4A', false).sheen);
  });
});

// ── rendering quality ───────────────────────────────────────────────────────
describe('render quality modes', () => {
  it('drops detail on thumbnails and keeps it in detail views', () => {
    expect(resolveQuality('AUTO', 90, false)).toBe('LIGHT');
    expect(resolveQuality('AUTO', 200, true)).toBe('HIGH');
  });

  it('honours an explicit request', () => {
    expect(resolveQuality('LIGHT', 900, true)).toBe('LIGHT');
  });

  it('knows when a feature is too small to bother drawing', () => {
    expect(isDetailWorthDrawing(360, CANVAS.width, 0.4)).toBeFalsy();
    expect(isDetailWorthDrawing(360, 120, 0.4)).toBeTruthy();
    expect(mmPerPoint(300, 1200)).toBe(4);
  });

  it('renders a millimetre region as a viewBox', () => {
    expect(regionToViewBox({ x: 1, y: 2, w: 3, h: 4 })).toBe('1 2 3 4');
  });
});

// ── photorealistic input mapping ────────────────────────────────────────────
describe('photorealistic preview input', () => {
  const spec = buildGarmentSpec(DEMO_USUAL_CONFIG, DEMO_MEASUREMENTS[0], 0);

  it('sends the complete structured design, not a text prompt', () => {
    expect(spec.schemaVersion).toBe(2);
    expect(spec.garmentType).toBe('OMANI_DISHDASHA');
    expect(spec.colour.hex.startsWith('#')).toBeTruthy();
    expect(spec.fabric.weave.length).toBeGreaterThan(2);
    expect(Object.keys(spec.proportionsMm).length).toBeGreaterThan(5);
  });

  it('carries the embroidery identity and its millimetre scale', () => {
    expect(Boolean(spec.embroidery)).toBeTruthy();
    expect(spec.embroidery!.bandWidthMm).toBeLessThan(30);
    expect(spec.embroidery!.channels.length).toBeGreaterThan(1);
    expect(spec.embroidery!.channels[0].hex.startsWith('#')).toBeTruthy();
  });

  it('states the invariants a generator must not violate', () => {
    expect(spec.invariants.collarless).toBe(true);
    expect(spec.invariants.hasShaq).toBe(true);
    expect(spec.invariants.ankleLength).toBe(true);
  });

  it('uses the design hash as its identity and cache key', () => {
    expect(spec.configHash).toBe(hashConfig(DEMO_USUAL_CONFIG));
  });

  it('changes the spec when any thread changes', () => {
    const other = buildGarmentSpec(
      { ...DEMO_USUAL_CONFIG, threadColorIds: ['th_gold', 'th_silver'] },
      DEMO_MEASUREMENTS[0],
      0,
    );
    expect(other.configHash === spec.configHash).toBeFalsy();
  });
});

// ── consistency validation ──────────────────────────────────────────────────
describe('design consistency validator', () => {
  const spec = buildGarmentSpec(DEMO_USUAL_CONFIG, DEMO_MEASUREMENTS[0], 0);

  it('passes when the image matches the specification', () => {
    const r = validateAgainstSpec(spec, evidenceFromOwnRenderer(spec));
    expect(r.verdict).toBe('ok');
    expect(r.requiresRegeneration).toBeFalsy();
  });

  it('fails when the garment colour is wrong', () => {
    const r = validateAgainstSpec(spec, { ...evidenceFromOwnRenderer(spec), dominantHex: '#8B0000' });
    expect(r.requiresRegeneration).toBeTruthy();
  });

  it('fails outright when a collar is detected', () => {
    const r = validateAgainstSpec(spec, { ...evidenceFromOwnRenderer(spec), collarDetected: true });
    expect(r.verdict).toBe('poor');
    expect(r.requiresRegeneration).toBeTruthy();
  });

  it('fails when the furakha is missing', () => {
    const r = validateAgainstSpec(spec, { ...evidenceFromOwnRenderer(spec), furakhaDetected: false });
    expect(r.checks.find((c) => c.key === 'furakha')?.passed).toBeFalsy();
  });

  it('reports unknown rather than passing when there is no inspector', () => {
    const r = validateAgainstSpec(spec, null);
    expect(r.verdict).toBe('unknown');
    expect(r.confidence).toBe(0);
  });
});

// ── try-on input mapping and consent ────────────────────────────────────────
describe('virtual try-on', () => {
  const spec = buildGarmentSpec(DEMO_USUAL_CONFIG, DEMO_MEASUREMENTS[0], 0);

  it('refuses without consent, at the service boundary', async () => {
    let threw = false;
    try {
      await new MockVirtualTryOnProvider().render({
        spec,
        customerPhotoUri: 'file://x.jpg',
        consentAt: '',
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('refuses a photo that failed the quality gate', async () => {
    let threw = false;
    try {
      await new MockVirtualTryOnProvider().render({
        spec,
        customerPhotoUri: 'file://x.jpg',
        consentAt: new Date().toISOString(),
        photoQuality: assessPhoto(200, 200),
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('returns the original alongside the result, for before/after', async () => {
    const out = await new MockVirtualTryOnProvider().render({
      spec,
      customerPhotoUri: 'file://x.jpg',
      consentAt: new Date().toISOString(),
      photoQuality: assessPhoto(1080, 1920),
    });
    expect(out.originalUri).toBe('file://x.jpg');
    expect(out.asset.isSimulated).toBe(true);
    expect(out.asset.designHash).toBe(spec.configHash);
  });

  it('judges framing only — never body shape', () => {
    expect(assessPhoto(1080, 1920).acceptable).toBe(true);
    expect(assessPhoto(1920, 1080).issues).toContain('not_full_body');
  });
});

// ── stylist V2 ──────────────────────────────────────────────────────────────
describe('AI stylist V2', () => {
  it('returns complete, orderable designs', async () => {
    const designs = await new LocalStylistV2().recommend({
      current: createDefaultConfig(),
      occasion: 'eid',
      season: 'all_year',
      timeOfDay: 'evening',
      memory: null,
      tailorId: 'tlr_al_asalah',
      count: 3,
    });
    expect(designs.length).toBeGreaterThan(0);
    for (const d of designs) {
      expect(d.config.fabricId.length).toBeGreaterThan(0);
      expect(d.config.baseColorId.length).toBeGreaterThan(0);
      expect(d.config.threadColorIds.length).toBeGreaterThan(0);
      expect(d.config.furakhaColorId.length).toBeGreaterThan(0);
      expect(d.totalPrice).toBeGreaterThan(0);
    }
  });

  it('prefers designs the chosen tailor can actually produce', async () => {
    const designs = await new LocalStylistV2().recommend({
      current: createDefaultConfig(),
      occasion: 'daily',
      season: 'summer',
      timeOfDay: 'day',
      memory: null,
      tailorId: 'tlr_nizwa_house',
      count: 3,
    });
    expect(designs[0].availability.producible).toBe(true);
  });

  it('never suggests a rejected colour', async () => {
    const designs = await new LocalStylistV2().recommend({
      current: createDefaultConfig(),
      occasion: 'daily',
      season: 'summer',
      timeOfDay: 'day',
      memory: null,
      tailorId: null,
      rejectedColorIds: ['col_off_white', 'col_soft_white'],
      count: 3,
    });
    for (const d of designs) {
      expect(['col_off_white', 'col_soft_white'].includes(d.baseColorId)).toBeFalsy();
    }
  });

  it('describes affinity in words, never as a fabricated percentage', () => {
    const labels = [
      matchLabelFor(0.9, 0.8, 'classic', true),
      matchLabelFor(0.4, 0.2, 'bold', false),
      matchLabelFor(0.6, 0.6, 'modern', false),
    ];
    for (const l of labels) {
      expect(l.startsWith('match.')).toBeTruthy();
      // Every label must exist as real copy in both languages.
      expect(dictionaries.ar[l].length).toBeGreaterThan(3);
      expect(dictionaries.en[l].length).toBeGreaterThan(3);
    }
  });
});

// ── ingestion architecture ──────────────────────────────────────────────────
describe('tailor ingestion pipelines', () => {
  it('reports honestly that fabric scanning is not implemented', async () => {
    expect(fabricScanner.implemented).toBe(false);
    let threw = false;
    try {
      await fabricScanner.submit('tlr_al_asalah', 'photo://x');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('refuses to publish embroidery without measured millimetres', () => {
    const draft = {
      id: 'd1',
      tailorBusinessId: 't',
      stage: 'awaiting_verification' as const,
      sourceRef: 'x',
      sourceKind: 'photo' as const,
      physical: null,
      channelCount: 2 as const,
      threadColourIds: ['th_navy', 'th_silver'],
      allowedZones: ['SHAQ' as const],
      ownershipConfirmed: true,
      rejectionReason: null,
      createdAt: '',
      updatedAt: '',
    };
    const gate = canPublish(draft);
    expect(gate.ok).toBeFalsy();
    expect(gate.reasons.some((r) => r.includes('physical dimensions'))).toBeTruthy();
  });

  it('requires the tailor to confirm ownership of the pattern', () => {
    const gate = canPublish({
      id: 'd2',
      tailorBusinessId: 't',
      stage: 'awaiting_verification',
      sourceRef: 'x',
      sourceKind: 'vector',
      physical: defaultPhysical(2, 3),
      channelCount: 2,
      threadColourIds: [],
      allowedZones: ['SHAQ'],
      ownershipConfirmed: false,
      rejectionReason: null,
      createdAt: '',
      updatedAt: '',
    });
    expect(gate.ok).toBeFalsy();
    expect(gate.reasons.some((r) => r.includes('ownership'))).toBeTruthy();
  });
});

// ── RTL and localisation ────────────────────────────────────────────────────
describe('localisation', () => {
  it('translates every key in both languages', () => {
    const arKeys = Object.keys(dictionaries.ar);
    const enKeys = Object.keys(dictionaries.en);
    expect(arKeys.length).toBe(enKeys.length);
    for (const k of arKeys) {
      expect(dictionaries.en[k as keyof typeof dictionaries.en].length).toBeGreaterThan(0);
    }
  });

  it('has Arabic copy for every V2 view and detail label', () => {
    for (const k of ['view.front', 'view.side', 'view.back', 'detail.shaq', 'detail.furakha', 'quality.title']) {
      const value = dictionaries.ar[k as keyof typeof dictionaries.ar];
      expect(value.length).toBeGreaterThan(1);
      // Arabic copy must actually be Arabic, not an untranslated fallback.
      expect(/[؀-ۿ]/.test(value)).toBeTruthy();
    }
  });
});
