import { describe, expect, it } from './harness';

import { GARMENT_COLORS, THREAD_COLORS, getColor, getThreadColor } from '@dd/data/colors';
import { EMBROIDERY_PATTERNS, getPattern } from '@dd/data/embroidery';
import { FABRICS, getFabric } from '@dd/data/fabrics';
import { TAILORS, getTailor } from '@dd/data/tailors';
import { DEMO_DESIGNS, DEMO_MEASUREMENTS, DEMO_ORDERS, DEMO_USUAL_CONFIG } from '@dd/data/demo';
import { OMANI_DISHDASHA, defaultComponentOptions } from '@dd/domain/garments';
import { OMANI_DISHDASHA_DEFAULT_TEMPLATE } from '@dd/domain/measurementTemplates';
import {
  classifyHarmony,
  diversify,
  generateHarmonyCandidates,
  scorePairing,
} from '@dd/engine/colorHarmony';
import { contrastRatio, hexToHsl, hslToHex, mix, normalizeHex } from '@dd/engine/color';
import {
  applyPattern,
  applyThreadColor,
  createDefaultConfig,
  deserializeDesign,
  hashConfig,
  normalizeConfig,
  serializeDesign,
  validateConfig,
} from '@dd/engine/design';
import { addMoney, formatMoney, multiplyMoney, roundMoney } from '@dd/engine/money';
import {
  applyAlterationDelta,
  convertValue,
  hasBlockingIssues,
  validateMeasurements,
} from '@dd/engine/measurements';
import { calculatePrice } from '@dd/engine/pricing';
import {
  CUSTOMER_STAGES,
  advanceOrder,
  createOrder,
  customerStage,
  isTerminal,
  nextStatus,
} from '@dd/engine/orders';
import { affinityScore, buildStyleMemory, usualConfig } from '@dd/engine/styleMemory';
import { LocalHarmonyStylist } from '@dd/services/ai/mockColorRecommendation';
import { SimulatedPreviewProvider, clearPreviewCache } from '@dd/services/ai/mockImageGeneration';
import { MockPaymentProvider } from '@dd/services/payment/mock';
import { measurementEstimationService } from '@dd/services/measurement/provider';
import type { OrderItem } from '@dd/domain/types';

// ── colour primitives ─────────────────────────────────────────────────────
describe('colour primitives', () => {
  it('normalises short and long hex', () => {
    expect(normalizeHex('fff')).toBe('#FFFFFF');
    expect(normalizeHex('#25384f')).toBe('#25384F');
  });

  it('round-trips hex → hsl → hex within tolerance', () => {
    const original = '#2C6B57';
    const restored = hslToHex(hexToHsl(original));
    // Rounding through integer HSL loses a little precision; a couple of
    // points per channel is expected and visually identical.
    const a = parseInt(original.slice(1, 3), 16);
    const b = parseInt(restored.slice(1, 3), 16);
    expect(Math.abs(a - b) < 4).toBeTruthy();
  });

  it('computes WCAG contrast symmetrically', () => {
    const forward = contrastRatio('#FFFFFF', '#000000');
    const backward = contrastRatio('#000000', '#FFFFFF');
    expect(forward).toBeCloseTo(21, 1);
    expect(forward).toBeCloseTo(backward, 6);
  });

  it('mixes toward the target colour', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

// ── harmony engine ────────────────────────────────────────────────────────
describe('colour harmony engine', () => {
  it('classifies neutral base + coloured thread as neutral accent', () => {
    expect(classifyHarmony('#F2EDE3', '#25384F')).toBe('neutral_accent');
  });

  it('classifies two neutrals as tonal', () => {
    expect(classifyHarmony('#C8C6C0', '#585A5C')).toBe('tonal');
  });

  it('classifies opposing hues as complementary', () => {
    expect(classifyHarmony('#2C5686', '#A9673F')).toBe('complementary');
  });

  it('scores a thread that vanishes into the fabric below a visible one', () => {
    const invisible = scorePairing('#F2EDE3', '#F8F6F1', 3);
    const visible = scorePairing('#F2EDE3', '#25384F', 3);
    expect(visible).toBeGreaterThan(invisible);
  });

  it('is deterministic: the same input yields the same palettes', () => {
    const input = {
      colors: GARMENT_COLORS,
      threads: THREAD_COLORS,
      occasion: 'eid' as const,
      season: 'all_year' as const,
      timeOfDay: 'evening' as const,
      channelCount: 2 as const,
    };
    const first = generateHarmonyCandidates(input, 8);
    const second = generateHarmonyCandidates(input, 8);
    expect(first).toEqual(second);
  });

  it('honours a locked base colour', () => {
    const candidates = generateHarmonyCandidates({
      colors: GARMENT_COLORS,
      threads: THREAD_COLORS,
      baseColorId: 'col_navy',
      occasion: 'formal',
      season: 'winter',
      timeOfDay: 'evening',
      channelCount: 2,
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.baseColorId === 'col_navy')).toBeTruthy();
  });

  it('produces one thread per requested channel', () => {
    for (const channelCount of [1, 2, 3] as const) {
      const candidates = generateHarmonyCandidates({
        colors: GARMENT_COLORS,
        threads: THREAD_COLORS,
        occasion: 'daily',
        season: 'summer',
        timeOfDay: 'day',
        channelCount,
      });
      expect(candidates[0].threadColorIds).toHaveLength(channelCount);
    }
  });

  it('never repeats a thread within one palette', () => {
    const candidates = generateHarmonyCandidates({
      colors: GARMENT_COLORS,
      threads: THREAD_COLORS,
      occasion: 'wedding',
      season: 'all_year',
      timeOfDay: 'evening',
      channelCount: 3,
    });
    for (const candidate of candidates) {
      expect(new Set(candidate.threadColorIds).size).toBe(candidate.threadColorIds.length);
    }
  });

  it('diversifies rather than returning near-identical palettes', () => {
    const candidates = generateHarmonyCandidates({
      colors: GARMENT_COLORS,
      threads: THREAD_COLORS,
      occasion: 'friday',
      season: 'all_year',
      timeOfDay: 'day',
      channelCount: 2,
    }, 24);
    const picked = diversify(candidates, 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((p) => p.baseColorId)).size).toBeGreaterThan(1);
  });

  it('only references thread ids that exist in the catalogue', () => {
    const candidates = generateHarmonyCandidates({
      colors: GARMENT_COLORS,
      threads: THREAD_COLORS,
      occasion: 'work',
      season: 'all_year',
      timeOfDay: 'day',
      channelCount: 3,
    });
    for (const candidate of candidates) {
      expect(Boolean(getColor(candidate.baseColorId))).toBeTruthy();
      for (const threadId of candidate.threadColorIds) {
        expect(Boolean(getThreadColor(threadId))).toBeTruthy();
      }
    }
  });
});

// ── money ─────────────────────────────────────────────────────────────────
describe('OMR money arithmetic', () => {
  it('adds without floating-point drift', () => {
    expect(addMoney([0.1, 0.2])).toBe(0.3);
    expect(addMoney([6.5, 8.5, 3.5, 1.2])).toBe(19.7);
  });

  it('keeps three decimals of precision (baisa)', () => {
    expect(roundMoney(12.4567)).toBe(12.457);
    expect(multiplyMoney(0.001, 3)).toBe(0.003);
  });

  it('formats with the currency symbol on the correct side', () => {
    expect(formatMoney(12.5, 'en')).toBe('OMR 12.500');
    expect(formatMoney(12.5, 'ar')).toBe('12.500 ر.ع');
  });
});

// ── pricing ───────────────────────────────────────────────────────────────
describe('price calculation', () => {
  const config = createDefaultConfig();
  const base = {
    config,
    fabric: getFabric(config.fabricId),
    pattern: getPattern(config.embroideryPatternId),
    tailor: getTailor('tlr_al_asalah'),
  };

  it('produces fabric, tailoring and embroidery lines', () => {
    const price = calculatePrice({ ...base, quantity: 1 });
    const keys = price.lines.map((l) => l.key);
    expect(keys).toContain('fabric');
    expect(keys).toContain('tailoring');
    expect(keys).toContain('embroidery');
  });

  it('scales linearly with quantity', () => {
    const one = calculatePrice({ ...base, quantity: 1 });
    const three = calculatePrice({ ...base, quantity: 3 });
    expect(three.subtotal).toBe(multiplyMoney(one.subtotal, 3));
  });

  it('omits a tax line when the merchant has not configured tax', () => {
    const price = calculatePrice({ ...base, quantity: 1, taxRate: null });
    expect(price.lines.some((l) => l.key === 'tax')).toBeFalsy();
    expect(price.taxRate).toBe(null);
    expect(price.total).toBe(price.subtotal);
  });

  it('applies a configured tax rate to the discounted, delivered total', () => {
    const price = calculatePrice({ ...base, quantity: 1, taxRate: 0.05 });
    const tax = price.lines.find((l) => l.key === 'tax');
    expect(Boolean(tax)).toBeTruthy();
    expect(price.total).toBeGreaterThan(price.subtotal);
  });

  it('never lets a discount exceed the goods total', () => {
    const price = calculatePrice({
      ...base,
      quantity: 1,
      discount: { kind: 'amount', value: 9999 },
    });
    expect(price.total).toBe(0);
  });

  it('waives delivery above the free-delivery threshold', () => {
    const tailor = getTailor('tlr_al_asalah')!;
    const cheap = calculatePrice({ ...base, quantity: 1, fulfilment: 'delivery' });
    const bulk = calculatePrice({ ...base, quantity: 8, fulfilment: 'delivery' });
    expect(cheap.lines.find((l) => l.key === 'delivery')?.amount).toBe(tailor.deliveryFee);
    expect(bulk.lines.find((l) => l.key === 'delivery')?.amount).toBe(0);
  });

  it('charges component surcharges', () => {
    const upgraded = { ...config, componentOptions: { ...config.componentOptions, collar: 'collar_round_piped' } };
    const plain = calculatePrice({ ...base, quantity: 1 });
    const fancy = calculatePrice({ ...base, config: upgraded, quantity: 1 });
    expect(fancy.total).toBeGreaterThan(plain.total);
  });
});

// ── design serialisation ──────────────────────────────────────────────────
describe('design serialisation', () => {
  it('round-trips through JSON without loss', () => {
    const config = createDefaultConfig();
    const restored = deserializeDesign(serializeDesign(config));
    expect(restored).toEqual(config);
  });

  it('returns null for malformed input instead of throwing', () => {
    expect(deserializeDesign('not json')).toBe(null);
    expect(deserializeDesign('{"v":1}')).toBe(null);
  });

  it('gives identical configs the same hash', () => {
    const a = createDefaultConfig();
    const b = createDefaultConfig();
    expect(hashConfig(a)).toBe(hashConfig(b));
  });

  it('changes the hash when any thread changes', () => {
    const a = createDefaultConfig();
    const b = applyThreadColor(a, 1, 'th_gold');
    expect(hashConfig(a) === hashConfig(b)).toBeFalsy();
  });

  it('is insensitive to component-option key order', () => {
    const a = createDefaultConfig();
    const reordered = {
      ...a,
      componentOptions: Object.fromEntries(Object.entries(a.componentOptions).reverse()),
    };
    expect(hashConfig(normalizeConfig(reordered))).toBe(hashConfig(a));
  });

  it('changing one thread channel leaves the others untouched', () => {
    const a = normalizeConfig({ ...createDefaultConfig(), embroideryPatternId: 'emb_06', threadColorIds: ['th_navy', 'th_silver', 'th_sky'] });
    const b = applyThreadColor(a, 1, 'th_gold');
    expect(b.threadColorIds[0]).toBe('th_navy');
    expect(b.threadColorIds[1]).toBe('th_gold');
    expect(b.threadColorIds[2]).toBe('th_sky');
  });

  it('pads and trims threads to the new pattern channel count', () => {
    const three = normalizeConfig({ ...createDefaultConfig(), embroideryPatternId: 'emb_06', threadColorIds: ['th_navy', 'th_silver', 'th_sky'] });
    const one = applyPattern(three, 'emb_08');
    expect(one.threadColorIds).toHaveLength(1);
    const backToThree = applyPattern(one, 'emb_06');
    expect(backToThree.threadColorIds).toHaveLength(3);
    // The channel the customer already chose survives the round trip.
    expect(backToThree.threadColorIds[0]).toBe('th_navy');
  });

  it('clears threads when embroidery is removed', () => {
    const cleared = applyPattern(createDefaultConfig(), null);
    expect(cleared.embroideryPatternId).toBe(null);
    expect(cleared.threadColorIds).toHaveLength(0);
  });

  it('flags a colour the chosen fabric does not carry', () => {
    const config = { ...createDefaultConfig(), baseColorId: 'col_burgundy' };
    const issues = validateConfig(config);
    expect(issues.some((i) => i.kind === 'color_unavailable_in_fabric')).toBeTruthy();
  });

  it('flags an out-of-stock fabric', () => {
    const config = { ...createDefaultConfig(), fabricId: 'fab_khareef_blend' };
    expect(validateConfig(config).some((i) => i.kind === 'fabric_unavailable')).toBeTruthy();
  });
});

// ── measurements ──────────────────────────────────────────────────────────
describe('measurement validation', () => {
  const valid = DEMO_MEASUREMENTS[0].values;

  it('accepts the seeded tailor-verified profile', () => {
    const issues = validateMeasurements(valid, 'tpl_om_dishdasha_default', 'cm');
    expect(hasBlockingIssues(issues)).toBeFalsy();
  });

  it('rejects an impossible total length', () => {
    const issues = validateMeasurements({ ...valid, total_length: 15 }, 'tpl_om_dishdasha_default', 'cm');
    expect(issues.some((i) => i.fieldKey === 'total_length' && i.code === 'out_of_range')).toBeTruthy();
    expect(hasBlockingIssues(issues)).toBeTruthy();
  });

  it('requires the required fields', () => {
    const { chest, ...withoutChest } = valid;
    const issues = validateMeasurements(withoutChest, 'tpl_om_dishdasha_default', 'cm');
    expect(issues.some((i) => i.fieldKey === 'chest' && i.code === 'required')).toBeTruthy();
  });

  it('does not require optional fields', () => {
    const { seat, armhole, bottom_width, ...trimmed } = valid;
    expect(hasBlockingIssues(validateMeasurements(trimmed, 'tpl_om_dishdasha_default', 'cm'))).toBeFalsy();
  });

  it('warns without blocking on an implausible sleeve-to-length ratio', () => {
    // Both values are individually in range; only their ratio is odd.
    const issues = validateMeasurements({ ...valid, total_length: 115, sleeve_length: 78 }, 'tpl_om_dishdasha_default', 'cm');
    const warning = issues.find((i) => i.code === 'implausible_ratio');
    expect(Boolean(warning)).toBeTruthy();
    expect(warning?.severity).toBe('warning');
    expect(hasBlockingIssues(issues)).toBeFalsy();
  });

  it('validates inches against the same underlying centimetre ranges', () => {
    const inches: Record<string, number> = {};
    for (const [key, value] of Object.entries(valid)) inches[key] = convertValue(value, 'cm', 'in');
    expect(hasBlockingIssues(validateMeasurements(inches, 'tpl_om_dishdasha_default', 'in'))).toBeFalsy();
  });

  it('converts units reversibly', () => {
    expect(convertValue(convertValue(62, 'cm', 'in'), 'in', 'cm')).toBeCloseTo(62, 0);
  });

  it('applies an alteration delta and demotes the profile to needs_review', () => {
    const updated = applyAlterationDelta(DEMO_MEASUREMENTS[0], 'sleeve_length', -1);
    expect(updated.values.sleeve_length).toBe(61);
    // A tailor-verified profile the customer edited is no longer verified.
    expect(updated.status).toBe('needs_review');
    // The original object is untouched.
    expect(DEMO_MEASUREMENTS[0].values.sleeve_length).toBe(62);
  });
});

// ── orders ────────────────────────────────────────────────────────────────
describe('order workflow', () => {
  const makeItem = (): OrderItem => {
    const config = createDefaultConfig();
    return {
      id: 'oit_test',
      config,
      configHash: hashConfig(config),
      quantity: 1,
      measurementProfileId: DEMO_MEASUREMENTS[0].id,
      measurementSnapshot: DEMO_MEASUREMENTS[0],
      price: calculatePrice({
        config,
        fabric: getFabric(config.fabricId),
        pattern: getPattern(config.embroideryPatternId),
        tailor: getTailor('tlr_al_asalah'),
        quantity: 1,
      }),
      notes: null,
    };
  };

  const newOrder = () =>
    createOrder({
      customerId: 'cus_test',
      tailor: getTailor('tlr_al_asalah')!,
      branchId: 'br_asalah_ruwi',
      items: [makeItem()],
      fulfilment: 'pickup',
      addressId: null,
      addressSnapshot: null,
      price: makeItem().price,
      payment: null,
    });

  it('starts as received with one history event', () => {
    const order = newOrder();
    expect(order.status).toBe('received');
    expect(order.history).toHaveLength(1);
    expect(order.number.startsWith('OD-')).toBeTruthy();
  });

  it('promises the slower end of the workshop range', () => {
    const order = newOrder();
    const days = Math.round((new Date(order.expectedReadyAt).getTime() - new Date(order.createdAt).getTime()) / 86400000);
    expect(days).toBe(getTailor('tlr_al_asalah')!.productionDays.max);
  });

  it('skips out_for_delivery on a pickup order', () => {
    let order = newOrder();
    const seen: string[] = [];
    for (let i = 0; i < 20 && !isTerminal(order.status); i++) {
      order = advanceOrder(order, 'tester');
      seen.push(order.status);
    }
    expect(order.status).toBe('delivered');
    expect(seen.includes('out_for_delivery')).toBeFalsy();
  });

  it('includes out_for_delivery on a delivery order', () => {
    expect(nextStatus('ready', 'delivery')).toBe('out_for_delivery');
    expect(nextStatus('ready', 'pickup')).toBe('delivered');
  });

  it('records a timestamp for every transition', () => {
    let order = newOrder();
    order = advanceOrder(order, 'tester');
    order = advanceOrder(order, 'tester');
    expect(order.history).toHaveLength(3);
    expect(order.history.every((e) => Boolean(e.at))).toBeTruthy();
  });

  it('stops advancing at the terminal state', () => {
    let order = newOrder();
    for (let i = 0; i < 30; i++) order = advanceOrder(order);
    const settled = advanceOrder(order);
    expect(settled.status).toBe('delivered');
    expect(settled.history.length).toBe(order.history.length);
  });

  it('maps eleven operational statuses onto five customer stages', () => {
    expect(customerStage('received')).toBe('placed');
    expect(customerStage('cutting')).toBe('inProduction');
    expect(customerStage('quality_check')).toBe('inProduction');
    expect(customerStage('ready')).toBe('ready');
    expect(customerStage('delivered')).toBe('delivered');
    expect(CUSTOMER_STAGES).toHaveLength(5);
  });
});

// ── payment boundary ──────────────────────────────────────────────────────
describe('payment provider', () => {
  it('creates a pending simulated session', async () => {
    const provider = new MockPaymentProvider();
    const session = await provider.createSession({
      orderDraftId: 'draft',
      amount: 24.5,
      currency: 'OMR',
      customerRef: 'cus_test',
      description: 'test',
    });
    expect(session.status).toBe('pending');
    expect(session.isSimulated).toBe(true);
  });

  it('reports success and failure distinctly, and never charges', async () => {
    const provider = new MockPaymentProvider();
    const ok = await provider.createSession({ orderDraftId: 'd1', amount: 10, currency: 'OMR', customerRef: 'c', description: 'x' });
    const bad = await provider.createSession({ orderDraftId: 'd2', amount: 10, currency: 'OMR', customerRef: 'c', description: 'x' });
    expect((await provider.confirm(ok.id, 'success')).status).toBe('paid');
    expect((await provider.confirm(bad.id, 'failure')).status).toBe('failed');
  });

  it('refuses to confirm an unknown session', async () => {
    const provider = new MockPaymentProvider();
    expect((await provider.confirm('nope', 'success')).status).toBe('failed');
  });
});

// ── AI service boundary ───────────────────────────────────────────────────
describe('AI services', () => {
  it('returns between three and six explained palettes', async () => {
    const suggestions = await new LocalHarmonyStylist().recommend({
      occasion: 'eid',
      season: 'all_year',
      timeOfDay: 'evening',
      channelCount: 2,
      memory: null,
      count: 5,
    });
    expect(suggestions.length).toBeGreaterThan(2);
    expect(suggestions.length).toBeLessThan(7);
    for (const suggestion of suggestions) {
      expect(suggestion.reason.ar.length).toBeGreaterThan(20);
      expect(suggestion.reason.en.length).toBeGreaterThan(20);
      expect(suggestion.matchScore).toBeGreaterThan(0);
      expect(suggestion.matchScore).toBeLessThan(1.01);
    }
  });

  it('marks the preview provider output as simulated and caches by design hash', async () => {
    clearPreviewCache();
    const provider = new SimulatedPreviewProvider();
    const config = createDefaultConfig();
    const hash = hashConfig(config);
    const first = await provider.generate({ config, configHash: hash, quality: 'low' });
    const started = Date.now();
    const second = await provider.generate({ config, configHash: hash, quality: 'low' });
    expect(first.isSimulated).toBe(true);
    expect(second.id).toBe(first.id);
    // A cache hit must not repeat the generation delay.
    expect(Date.now() - started).toBeLessThan(100);
  });

  it('reports camera body measurement as unavailable rather than faking it', async () => {
    expect(measurementEstimationService.available).toBe(false);
    let threw = false;
    try {
      await measurementEstimationService.estimate([], 175);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

// ── style memory ──────────────────────────────────────────────────────────
describe('style memory', () => {
  it('derives usual fabric, colour and tailor from order history', () => {
    const memory = buildStyleMemory('cus_demo_001', DEMO_ORDERS, DEMO_DESIGNS);
    expect(memory.orderCount).toBe(DEMO_ORDERS.length);
    expect(memory.favoriteColorIds).toContain('col_off_white');
    expect(memory.preferredTailorId).toBe('tlr_al_asalah');
    expect(memory.preferredFit).toBe('regular');
  });

  it('is empty but valid for a brand-new customer', () => {
    const memory = buildStyleMemory('cus_new', [], []);
    expect(memory.orderCount).toBe(0);
    expect(memory.preferredTailorId).toBe(null);
    expect(memory.typicalQuantity).toBe(1);
    expect(memory.lastOrderAt).toBe(null);
  });

  it('resolves the usual configuration from the most recent order', () => {
    const usual = usualConfig(DEMO_ORDERS, DEMO_DESIGNS);
    expect(usual?.source).toBe('last_order');
    expect(hashConfig(usual!.config)).toBe(hashConfig(DEMO_USUAL_CONFIG));
  });

  it('falls back to a favourite design when there are no orders', () => {
    const usual = usualConfig([], DEMO_DESIGNS);
    expect(usual?.source).toBe('favorite_design');
  });

  it('scores a familiar palette above an unfamiliar one', () => {
    const memory = buildStyleMemory('cus_demo_001', DEMO_ORDERS, DEMO_DESIGNS);
    const familiar = affinityScore(memory, { baseColorId: 'col_off_white', threadColorIds: ['th_navy', 'th_silver'] });
    const unfamiliar = affinityScore(memory, { baseColorId: 'col_burgundy', threadColorIds: ['th_plum'] });
    expect(familiar).toBeGreaterThan(unfamiliar);
  });

  it('returns a neutral score with no history rather than a false confidence', () => {
    expect(affinityScore(null, { baseColorId: 'col_navy', threadColorIds: ['th_gold'] })).toBe(0.5);
  });
});

// ── catalogue integrity ───────────────────────────────────────────────────
describe('catalogue integrity', () => {
  it('meets the seed-data floor promised to the demo', () => {
    expect(GARMENT_COLORS.length).toBeGreaterThan(19);
    expect(FABRICS.length).toBeGreaterThan(9);
    expect(EMBROIDERY_PATTERNS.filter((p) => p.motif !== 'none').length).toBeGreaterThan(14);
    expect(TAILORS).toHaveLength(3);
    expect(DEMO_MEASUREMENTS).toHaveLength(2);
    expect(DEMO_ORDERS).toHaveLength(3);
  });

  it('uses unique ids throughout', () => {
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    expect(unique(GARMENT_COLORS.map((c) => c.id))).toBeTruthy();
    expect(unique(THREAD_COLORS.map((c) => c.id))).toBeTruthy();
    expect(unique(FABRICS.map((f) => f.id))).toBeTruthy();
    expect(unique(EMBROIDERY_PATTERNS.map((p) => p.id))).toBeTruthy();
  });

  it('only lists colour ids that exist in the colour catalogue', () => {
    for (const fabric of FABRICS) {
      for (const colorId of fabric.colorIds) {
        expect(Boolean(getColor(colorId))).toBeTruthy();
      }
    }
  });

  it('gives every pattern channel a real default thread', () => {
    for (const pattern of EMBROIDERY_PATTERNS) {
      expect(pattern.channels).toHaveLength(pattern.channelCount);
      for (const channel of pattern.channels) {
        expect(Boolean(getThreadColor(channel.defaultThreadColorId))).toBeTruthy();
      }
    }
  });

  it('references only real tailors from fabrics and patterns', () => {
    const ids = new Set(TAILORS.map((t) => t.id));
    for (const fabric of FABRICS) for (const id of fabric.tailorBusinessIds) expect(ids.has(id)).toBeTruthy();
    for (const pattern of EMBROIDERY_PATTERNS) for (const id of pattern.tailorBusinessIds) expect(ids.has(id)).toBeTruthy();
  });

  it('labels every seeded tailor and fabric as demo data', () => {
    expect(TAILORS.every((t) => t.isDemoData)).toBeTruthy();
    expect(FABRICS.every((f) => f.isDemoData)).toBeTruthy();
    // Ratings are left null rather than invented for fictional businesses.
    expect(TAILORS.every((t) => t.ratingAverage === null)).toBeTruthy();
  });

  it('exposes only the Omani dishdasha today', () => {
    expect(OMANI_DISHDASHA.enabled).toBe(true);
    expect(OMANI_DISHDASHA.id).toBe('OMANI_DISHDASHA');
    const defaults = defaultComponentOptions(OMANI_DISHDASHA);
    expect(Object.keys(defaults)).toHaveLength(OMANI_DISHDASHA.components.length);
  });

  it('keeps every measurement field range plausible', () => {
    for (const field of OMANI_DISHDASHA_DEFAULT_TEMPLATE.fields) {
      expect(field.min).toBeLessThan(field.typical);
      expect(field.typical).toBeLessThan(field.max);
    }
  });

  it('starts the demo customer on a valid, orderable configuration', () => {
    expect(validateConfig(DEMO_USUAL_CONFIG)).toHaveLength(0);
    for (const design of DEMO_DESIGNS) {
      expect(design.configHash).toBe(hashConfig(design.config));
    }
  });
});
