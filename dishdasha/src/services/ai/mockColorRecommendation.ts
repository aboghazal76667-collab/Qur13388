import { GARMENT_COLORS, THREAD_COLORS, getColor, getThreadColor } from '@dd/data/colors';
import { EMBROIDERY_PATTERNS } from '@dd/data/embroidery';
import { diversify, generateHarmonyCandidates } from '@dd/engine/colorHarmony';
import { affinityScore } from '@dd/engine/styleMemory';
import { hexToHsl, isNeutral, warmth } from '@dd/engine/color';
import type { HarmonyKind, PaletteSuggestion, StylePersonality } from '@dd/domain/types';
import { uuid } from '@dd/utils/id';
import type {
  ColorRecommendationRequest,
  ColorRecommendationService,
  ProviderInfo,
} from './types';
import { withTelemetry } from './telemetry';

/**
 * LOCAL STYLIST — the default ColorRecommendationService.
 *
 * The deterministic harmony engine produces candidates; this class ranks them
 * against the customer's style memory and writes the Arabic explanation. When
 * a hosted LLM is wired in later it replaces only the ranking + explanation
 * step, because generating candidates locally is what keeps the feature free
 * and instant.
 */

const HARMONY_PHRASE: Record<HarmonyKind, { ar: string; en: string }> = {
  monochromatic: { ar: 'تدرّج من نفس العائلة اللونية', en: 'a single-family gradation' },
  analogous: { ar: 'ألوان متجاورة على دائرة الألوان', en: 'neighbouring hues' },
  complementary: { ar: 'تباين متقابل واضح', en: 'a clear opposing contrast' },
  split_complementary: { ar: 'تباين متوازن دون حدّة', en: 'balanced contrast without harshness' },
  tonal: { ar: 'درجات محايدة متقاربة', en: 'close neutral tones' },
  neutral_accent: { ar: 'أساس محايد مع لمسة لونية', en: 'a neutral base with one accent' },
};

const PERSONALITY_PHRASE: Record<StylePersonality, { ar: string; en: string }> = {
  classic: { ar: 'مظهر كلاسيكي مألوف', en: 'a familiar classic look' },
  calm: { ar: 'إحساس هادئ ومريح للعين', en: 'a calm, easy feel' },
  luxe: { ar: 'حضور فاخر بلمسة راقية', en: 'a refined, premium presence' },
  modern: { ar: 'طابع عصري خفيف', en: 'a light modern character' },
  bold: { ar: 'إطلالة جريئة تلفت النظر', en: 'a bold, noticeable look' },
  formal: { ar: 'انضباط رسمي مناسب للمناسبات', en: 'formal discipline suited to occasions' },
};

const OCCASION_PHRASE: Record<string, { ar: string; en: string }> = {
  daily: { ar: 'للاستخدام اليومي', en: 'for everyday wear' },
  work: { ar: 'لأجواء العمل', en: 'for the workplace' },
  friday: { ar: 'لصلاة الجمعة', en: 'for Friday' },
  eid: { ar: 'للعيد', en: 'for Eid' },
  wedding: { ar: 'لحفلات الزواج', en: 'for weddings' },
  formal: { ar: 'للمناسبات الرسمية', en: 'for formal occasions' },
  special: { ar: 'للمناسبات الخاصة', en: 'for special occasions' },
};

/**
 * Writes the "why this works" line. Templated rather than generated so it is
 * always grammatical Arabic, always accurate about the colours it names, and
 * costs nothing.
 */
const explain = (
  baseColorId: string,
  threadColorIds: string[],
  harmony: HarmonyKind,
  personality: StylePersonality,
  occasion: string,
): { ar: string; en: string } => {
  const base = getColor(baseColorId);
  const t1 = getThreadColor(threadColorIds[0]);
  const t2 = threadColorIds[1] ? getThreadColor(threadColorIds[1]) : undefined;
  const t3 = threadColorIds[2] ? getThreadColor(threadColorIds[2]) : undefined;

  const baseAr = base?.name.ar ?? 'اللون الأساسي';
  const baseEn = base?.name.en ?? 'the base colour';
  const t1Ar = t1?.name.ar ?? 'الخيط';
  const t1En = t1?.name.en ?? 'the thread';

  const parts: { ar: string; en: string }[] = [];
  parts.push({
    ar: `${baseAr} مع تطريز ${t1Ar} يعطي ${PERSONALITY_PHRASE[personality].ar}`,
    en: `${baseEn} with ${t1En} embroidery gives ${PERSONALITY_PHRASE[personality].en}`,
  });

  if (t2) {
    const role = t2.metallic ? { ar: 'تبرز النقش دون مبالغة', en: 'lifts the pattern without shouting' } : { ar: 'تضيف عمقاً للنقش', en: 'adds depth to the pattern' };
    parts.push({
      ar: `، بينما لمسة ${t2.name.ar} ${role.ar}`,
      en: `, while the ${t2.name.en} accent ${role.en}`,
    });
  }
  if (t3) {
    parts.push({
      ar: `، ويعمل ${t3.name.ar} كخيط إبراز خفيف`,
      en: `, with ${t3.name.en} as a light highlight thread`,
    });
  }

  const closing = {
    ar: `. التنسيق مبني على ${HARMONY_PHRASE[harmony].ar}، وهو مناسب ${OCCASION_PHRASE[occasion]?.ar ?? ''}.`,
    en: `. The combination is built on ${HARMONY_PHRASE[harmony].en}, suited ${OCCASION_PHRASE[occasion]?.en ?? ''}.`,
  };

  return {
    ar: parts.map((p) => p.ar).join('') + closing.ar,
    en: parts.map((p) => p.en).join('') + closing.en,
  };
};

/** Picks a pattern whose character matches the palette's personality. */
const suggestPattern = (
  personality: StylePersonality,
  channelCount: number,
): string | null => {
  const pool = EMBROIDERY_PATTERNS.filter(
    (p) => p.active && p.motif !== 'none' && p.channelCount === channelCount,
  );
  if (pool.length === 0) return null;
  const preferred: Record<StylePersonality, string[]> = {
    classic: ['omani_traditional'],
    calm: ['minimal', 'omani_traditional'],
    luxe: ['omani_traditional', 'geometric'],
    modern: ['omani_contemporary', 'geometric'],
    bold: ['geometric', 'omani_contemporary'],
    formal: ['geometric', 'omani_traditional'],
  };
  const families = preferred[personality];
  const match = pool
    .filter((p) => families.includes(p.styleFamily))
    .sort((a, b) => b.popularity - a.popularity)[0];
  return (match ?? pool.sort((a, b) => b.popularity - a.popularity)[0]).id;
};

export class LocalHarmonyStylist implements ColorRecommendationService {
  readonly info: ProviderInfo = {
    name: 'local-harmony-engine',
    model: 'deterministic-v1',
    // Genuinely local logic rather than a fake AI call: it really does compute
    // the palettes it shows. It is simply not an LLM.
    isLive: true,
  };

  async recommend(req: ColorRecommendationRequest): Promise<PaletteSuggestion[]> {
    return withTelemetry(
      {
        kind: 'palette',
        provider: this.info.name,
        model: this.info.model,
        inputHash: `${req.occasion}:${req.season}:${req.timeOfDay}:${req.baseColorId ?? 'any'}`,
        estimatedCost: 0,
      },
      async () => {
        const count = req.count ?? 5;
        const candidates = generateHarmonyCandidates({
          colors: GARMENT_COLORS,
          threads: THREAD_COLORS,
          baseColorId: req.baseColorId ?? null,
          occasion: req.occasion,
          season: req.season,
          timeOfDay: req.timeOfDay,
          channelCount: req.channelCount,
          inspirationHexes: req.inspirationHexes,
        }, 24);

        const scored = candidates.map((c) => {
          const affinity = affinityScore(req.memory, c);
          // Harmony quality dominates; personal affinity nudges the order.
          const match = Math.min(0.98, c.harmonyScore * 0.68 + affinity * 0.32);
          return { c, match };
        });

        const chosen = diversify(
          scored.sort((a, b) => b.match - a.match).map((s) => s.c),
          Math.max(3, Math.min(6, count)),
        );

        return chosen.map((c) => {
          const match = scored.find((s) => s.c === c)?.match ?? c.harmonyScore;
          return {
            id: uuid(),
            baseColorId: c.baseColorId,
            threadColorIds: c.threadColorIds,
            furakhaColorId: c.furakhaColorId,
            suggestedPatternId: suggestPattern(c.personality, req.channelCount),
            personality: c.personality,
            matchScore: Math.round(match * 100) / 100,
            harmony: c.harmony,
            reason: explain(c.baseColorId, c.threadColorIds, c.harmony, c.personality, req.occasion),
            occasion: req.occasion,
            season: req.season,
            source: 'harmony_engine' as const,
          };
        });
      },
    );
  }
}

/** Descriptive helpers reused by the UI when rendering a palette card. */
export const paletteMood = (baseHex: string, threadHex: string) => ({
  neutralBase: isNeutral(baseHex),
  temperature: warmth(threadHex),
  threadLightness: hexToHsl(threadHex).l,
});
