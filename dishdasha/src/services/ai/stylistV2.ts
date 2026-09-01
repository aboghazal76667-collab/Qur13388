/**
 * AI STYLIST V2 — complete, executable designs.
 *
 * V1 answered "these colours look nice". V2 answers with something the
 * customer can actually order: a fabric, a fabric colour, a pattern, every
 * thread channel, a furakha, a price difference against what they have now,
 * and whether the selected tailor can actually make it.
 *
 * The deterministic harmony engine is PRESERVED and still generates the
 * candidates — it is what makes the stylist free, instant and offline. This
 * layer turns a palette into a buildable garment and ranks it.
 */
import { GARMENT_COLORS, THREAD_COLORS, getColor, getThreadColor } from '@dd/data/colors';
import { EMBROIDERY_PATTERNS, getPattern } from '@dd/data/embroidery';
import { FABRICS, getFabric } from '@dd/data/fabrics';
import { getTailor } from '@dd/data/tailors';
import { diversify, generateHarmonyCandidates } from '@dd/engine/colorHarmony';
import { affinityScore } from '@dd/engine/styleMemory';
import { applyPattern, normalizeConfig } from '@dd/engine/design';
import { calculatePrice } from '@dd/engine/pricing';
import type {
  DesignConfig,
  Fabric,
  Occasion,
  Season,
  StyleMemory,
  StylePersonality,
} from '@dd/domain/types';
import type { Localized } from '@dd/i18n';
import { uuid } from '@dd/utils/id';
import { withTelemetry } from './telemetry';
import type { ProviderInfo } from './types';

/** How close a suggestion is to the customer — in words, never a percentage. */
export type MatchLabel =
  | 'match.veryClose'
  | 'match.close'
  | 'match.classic'
  | 'match.bold'
  | 'match.fresh';

export type CompleteDesign = {
  id: string;
  /** A fully-formed configuration. Applying it needs no further decisions. */
  config: DesignConfig;
  fabricId: string;
  baseColorId: string;
  patternId: string | null;
  threadColorIds: string[];
  furakhaColorId: string;
  personality: StylePersonality;
  occasion: Occasion;
  season: Season;
  reason: Localized;
  /** Words, not a fabricated confidence percentage. */
  matchLabel: MatchLabel;
  /** Internal ranking score. Never rendered as a scientific figure. */
  rankScore: number;
  /** Difference against the customer's current design, in OMR. */
  priceDelta: number;
  totalPrice: number;
  availability: {
    tailorId: string | null;
    fabricAvailable: boolean;
    patternAvailable: boolean;
    /** True only when the chosen tailor can actually produce all of it. */
    producible: boolean;
  };
};

export type StylistV2Request = {
  current: DesignConfig;
  occasion: Occasion;
  season: Season;
  timeOfDay: 'day' | 'evening';
  memory: StyleMemory | null;
  tailorId: string | null;
  inspirationHexes?: string[];
  /** Colours the customer explicitly rejected — never suggested again. */
  rejectedColorIds?: string[];
  count?: number;
};

/**
 * Chooses a fabric that suits the occasion and season and that the tailor
 * stocks. Availability is a first-class input, not a warning afterwards.
 */
const pickFabric = (
  occasion: Occasion,
  season: Season,
  tailorId: string | null,
  memory: StyleMemory | null,
  colorId: string,
): Fabric | undefined => {
  const wantsPremium = ['eid', 'wedding', 'formal', 'special'].includes(occasion);
  const pool = FABRICS.filter((f) => {
    if (!f.active || !f.inStock) return false;
    if (!f.colorIds.includes(colorId)) return false;
    if (tailorId && !f.tailorBusinessIds.includes(tailorId)) return false;
    if (season !== 'all_year' && f.season !== season && f.season !== 'all_year') return false;
    return true;
  });
  if (pool.length === 0) return undefined;

  const score = (f: Fabric) => {
    let s = 0;
    if (wantsPremium && (f.category === 'premium' || f.category === 'formal')) s += 3;
    if (!wantsPremium && (f.category === 'daily' || f.category === 'light_summer')) s += 2;
    // A fabric the customer already chose is a strong signal.
    const rank = memory?.favoriteFabricIds.indexOf(f.id) ?? -1;
    if (rank >= 0) s += 3 - rank * 0.5;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
};

const pickPattern = (
  personality: StylePersonality,
  channelCount: number,
  tailorId: string | null,
  memory: StyleMemory | null,
) => {
  const families: Record<StylePersonality, string[]> = {
    classic: ['omani_traditional'],
    calm: ['minimal', 'omani_traditional'],
    luxe: ['omani_traditional', 'geometric'],
    modern: ['omani_contemporary', 'geometric'],
    bold: ['geometric', 'omani_contemporary'],
    formal: ['geometric', 'omani_traditional'],
  };
  const pool = EMBROIDERY_PATTERNS.filter(
    (p) =>
      p.active &&
      p.motif !== 'none' &&
      p.channelCount === channelCount &&
      (!tailorId || p.tailorBusinessIds.includes(tailorId)),
  );
  if (pool.length === 0) return undefined;
  const preferred = families[personality];
  return [...pool].sort((a, b) => {
    const fa = preferred.includes(a.styleFamily) ? 1 : 0;
    const fb = preferred.includes(b.styleFamily) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const ma = memory?.favoritePatternIds.includes(a.id) ? 1 : 0;
    const mb = memory?.favoritePatternIds.includes(b.id) ? 1 : 0;
    if (ma !== mb) return mb - ma;
    return b.popularity - a.popularity;
  })[0];
};

/**
 * Converts an internal rank into language a customer can act on.
 *
 * Deliberately NOT a percentage: "94% suitable for your taste" implies a
 * measurement we do not have. The words describe the relationship to their
 * past choices, which is the thing we actually know.
 */
export const matchLabelFor = (
  rankScore: number,
  affinity: number,
  personality: StylePersonality,
  isFamiliar: boolean,
): MatchLabel => {
  if (personality === 'bold') return 'match.bold';
  if (affinity >= 0.72 && isFamiliar) return 'match.veryClose';
  if (affinity >= 0.58) return 'match.close';
  if (personality === 'classic' || personality === 'formal') return 'match.classic';
  return rankScore > 0.7 ? 'match.close' : 'match.fresh';
};

export class LocalStylistV2 {
  readonly info: ProviderInfo = {
    name: 'local-stylist-v2',
    model: 'harmony+memory-v2',
    isLive: true,
  };

  async recommend(req: StylistV2Request): Promise<CompleteDesign[]> {
    return withTelemetry(
      {
        kind: 'palette',
        provider: this.info.name,
        model: this.info.model,
        inputHash: `${req.occasion}:${req.season}:${req.timeOfDay}:${req.tailorId ?? 'any'}`,
        estimatedCost: 0,
      },
      async () => {
        const rejected = new Set(req.rejectedColorIds ?? []);
        const channelCount = (req.current.threadColorIds.length || 2) as 1 | 2 | 3;
        const tailor = getTailor(req.tailorId);

        const candidates = generateHarmonyCandidates(
          {
            colors: GARMENT_COLORS.filter((c) => !rejected.has(c.id)),
            threads: THREAD_COLORS,
            baseColorId: null,
            occasion: req.occasion,
            season: req.season,
            timeOfDay: req.timeOfDay,
            channelCount,
            inspirationHexes: req.inspirationHexes,
          },
          28,
        );

        const currentPrice = calculatePrice({
          config: req.current,
          fabric: getFabric(req.current.fabricId),
          pattern: getPattern(req.current.embroideryPatternId),
          tailor,
          quantity: 1,
        }).total;

        const built: CompleteDesign[] = [];
        for (const c of diversify(candidates, 14)) {
          const fabric = pickFabric(req.occasion, req.season, req.tailorId, req.memory, c.baseColorId);
          if (!fabric) continue;
          const pattern = pickPattern(c.personality, channelCount, req.tailorId, req.memory);
          if (!pattern) continue;

          const config = normalizeConfig({
            ...applyPattern(req.current, pattern.id),
            fabricId: fabric.id,
            baseColorId: c.baseColorId,
            threadColorIds: c.threadColorIds,
            furakhaColorId: c.furakhaColorId,
          });

          const price = calculatePrice({ config, fabric, pattern, tailor, quantity: 1 });
          const affinity = affinityScore(req.memory, c);
          const rankScore = Math.min(0.99, c.harmonyScore * 0.62 + affinity * 0.38);
          const isFamiliar =
            (req.memory?.favoriteColorIds.includes(c.baseColorId) ?? false) ||
            (req.memory?.favoriteFabricIds.includes(fabric.id) ?? false);

          built.push({
            id: uuid(),
            config,
            fabricId: fabric.id,
            baseColorId: c.baseColorId,
            patternId: pattern.id,
            threadColorIds: c.threadColorIds,
            furakhaColorId: c.furakhaColorId,
            personality: c.personality,
            occasion: req.occasion,
            season: req.season,
            reason: explain(c.baseColorId, c.threadColorIds, fabric, c.personality),
            matchLabel: matchLabelFor(rankScore, affinity, c.personality, isFamiliar),
            rankScore,
            priceDelta: Math.round((price.total - currentPrice) * 1000) / 1000,
            totalPrice: price.total,
            availability: {
              tailorId: req.tailorId,
              fabricAvailable: !req.tailorId || fabric.tailorBusinessIds.includes(req.tailorId),
              patternAvailable: !req.tailorId || pattern.tailorBusinessIds.includes(req.tailorId),
              producible:
                !req.tailorId ||
                (fabric.tailorBusinessIds.includes(req.tailorId) &&
                  pattern.tailorBusinessIds.includes(req.tailorId)),
            },
          });
        }

        // Producible designs first — a beautiful suggestion the chosen tailor
        // cannot sew is not a suggestion.
        return built
          .sort((a, b) => {
            if (a.availability.producible !== b.availability.producible) {
              return a.availability.producible ? -1 : 1;
            }
            return b.rankScore - a.rankScore;
          })
          .slice(0, req.count ?? 3);
      },
    );
  }
}

const explain = (
  baseColorId: string,
  threadColorIds: string[],
  fabric: Fabric,
  personality: StylePersonality,
): Localized => {
  const base = getColor(baseColorId);
  const t1 = getThreadColor(threadColorIds[0]);
  const t2 = threadColorIds[1] ? getThreadColor(threadColorIds[1]) : undefined;
  const mood: Record<StylePersonality, Localized> = {
    classic: { ar: 'مظهر كلاسيكي مألوف', en: 'a familiar classic look' },
    calm: { ar: 'إحساس هادئ ومريح', en: 'a calm, easy feel' },
    luxe: { ar: 'حضور فاخر', en: 'a premium presence' },
    modern: { ar: 'طابع عصري خفيف', en: 'a light modern character' },
    bold: { ar: 'إطلالة لافتة', en: 'a striking look' },
    formal: { ar: 'انضباط رسمي', en: 'formal discipline' },
  };
  return {
    ar: `${base?.name.ar ?? ''} على ${fabric.name.ar} مع تطريز ${t1?.name.ar ?? ''}${t2 ? ` ولمسة ${t2.name.ar}` : ''} — ${mood[personality].ar}.`,
    en: `${base?.name.en ?? ''} in ${fabric.name.en} with ${t1?.name.en ?? ''} embroidery${t2 ? ` and a ${t2.name.en} accent` : ''} — ${mood[personality].en}.`,
  };
};

export const stylistV2 = new LocalStylistV2();
