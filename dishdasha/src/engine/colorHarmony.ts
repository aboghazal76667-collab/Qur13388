/**
 * DETERMINISTIC COLOUR HARMONY ENGINE.
 *
 * This is the cheap, fast, offline half of the stylist. It produces candidate
 * palettes from colour theory alone; the AI layer only ranks and explains
 * them. Keeping candidate generation out of the LLM means the stylist still
 * works with no network, no API key and no per-request cost.
 */
import type {
  GarmentColor,
  HarmonyKind,
  Occasion,
  Season,
  StylePersonality,
  ThreadColor,
} from '@dd/domain/types';
import { contrastRatio, hexToHsl, hueDistance, isNeutral, warmth } from './color';

export type HarmonyCandidate = {
  baseColorId: string;
  threadColorIds: string[];
  furakhaColorId: string;
  harmony: HarmonyKind;
  personality: StylePersonality;
  /** 0..1 quality of the colour relationship itself, before personalisation. */
  harmonyScore: number;
};

export type HarmonyInput = {
  colors: GarmentColor[];
  threads: ThreadColor[];
  /** When set, palettes are built around this base rather than exploring bases. */
  baseColorId?: string | null;
  occasion: Occasion;
  season: Season;
  timeOfDay: 'day' | 'evening';
  channelCount: 1 | 2 | 3;
  /** Colours pulled from a kumma/mussar photo, biasing thread selection. */
  inspirationHexes?: string[];
};

const OCCASION_RULES: Record<
  Occasion,
  {
    preferredHarmonies: HarmonyKind[];
    personality: StylePersonality;
    /** Lower = quieter contrast between fabric and thread. */
    contrastTarget: number;
    allowMetallic: boolean;
    preferLightBase: boolean;
  }
> = {
  daily: { preferredHarmonies: ['tonal', 'monochromatic', 'neutral_accent'], personality: 'calm', contrastTarget: 2.4, allowMetallic: false, preferLightBase: true },
  work: { preferredHarmonies: ['neutral_accent', 'monochromatic', 'analogous'], personality: 'formal', contrastTarget: 3.0, allowMetallic: false, preferLightBase: true },
  friday: { preferredHarmonies: ['tonal', 'analogous', 'neutral_accent'], personality: 'classic', contrastTarget: 2.8, allowMetallic: true, preferLightBase: true },
  eid: { preferredHarmonies: ['analogous', 'split_complementary', 'neutral_accent'], personality: 'luxe', contrastTarget: 4.0, allowMetallic: true, preferLightBase: true },
  wedding: { preferredHarmonies: ['complementary', 'split_complementary', 'neutral_accent'], personality: 'luxe', contrastTarget: 4.6, allowMetallic: true, preferLightBase: false },
  formal: { preferredHarmonies: ['monochromatic', 'neutral_accent', 'analogous'], personality: 'formal', contrastTarget: 3.6, allowMetallic: true, preferLightBase: false },
  special: { preferredHarmonies: ['split_complementary', 'complementary', 'analogous'], personality: 'bold', contrastTarget: 4.2, allowMetallic: true, preferLightBase: false },
};

const SEASON_BASE_FAMILIES: Record<Season, string[]> = {
  summer: ['white', 'beige', 'grey', 'blue'],
  winter: ['grey', 'blue', 'green', 'brown', 'black'],
  all_year: ['white', 'beige', 'grey', 'blue', 'green', 'brown'],
};

/** Classifies the hue relationship between a base and a thread. */
export const classifyHarmony = (baseHex: string, threadHex: string): HarmonyKind => {
  const a = hexToHsl(baseHex);
  const b = hexToHsl(threadHex);
  const baseNeutral = isNeutral(baseHex);
  const threadNeutral = isNeutral(threadHex);

  if (baseNeutral && threadNeutral) return 'tonal';
  if (baseNeutral !== threadNeutral) return 'neutral_accent';

  const d = hueDistance(a.h, b.h);
  if (d <= 18) return 'monochromatic';
  if (d <= 45) return 'analogous';
  if (d >= 150) return 'complementary';
  if (d >= 110) return 'split_complementary';
  return 'analogous';
};

/**
 * Scores how well one thread sits on a base fabric colour.
 * Combines hue relationship, contrast against a target, and warm/cool balance.
 */
export const scorePairing = (
  baseHex: string,
  threadHex: string,
  contrastTarget: number,
): number => {
  const ratio = contrastRatio(baseHex, threadHex);
  /*
   * Contrast is scored asymmetrically, because the two failure modes are not
   * equally bad. Below the target the embroidery starts to disappear into the
   * cloth, which ruins the garment — so the penalty is steep and reaches zero
   * at no contrast at all. Above the target it merely reads bolder, which is a
   * legitimate choice (navy on off-white is the commonest dishdasha in Oman
   * and sits near ratio 9) — so it decays gently and never below 0.55.
   */
  const contrastScore =
    ratio < contrastTarget
      ? Math.max(0, (ratio - 1) / (contrastTarget - 1))
      : Math.max(0.55, 1 - (ratio - contrastTarget) / 18);

  const harmony = classifyHarmony(baseHex, threadHex);
  const harmonyWeights: Record<HarmonyKind, number> = {
    monochromatic: 0.8,
    analogous: 0.9,
    tonal: 0.85,
    neutral_accent: 0.95,
    split_complementary: 0.75,
    complementary: 0.65,
  };

  const wa = warmth(baseHex);
  const wb = warmth(threadHex);
  // Warm base + warm thread reads coherent; warm/cool clash is penalised
  // unless one side is neutral, which always mediates.
  const temperatureScore =
    wa === 'neutral' || wb === 'neutral' ? 0.9 : wa === wb ? 1 : 0.62;

  return Math.min(1, contrastScore * 0.45 + harmonyWeights[harmony] * 0.35 + temperatureScore * 0.2);
};

/** Second and third threads must relate to thread 1, not fight it. */
const scoreSecondaryThread = (
  primaryHex: string,
  secondaryHex: string,
  baseHex: string,
): number => {
  const withBase = contrastRatio(baseHex, secondaryHex);
  // A secondary thread that vanishes into the fabric is wasted stitching.
  if (withBase < 1.35) return 0.15;
  const between = contrastRatio(primaryHex, secondaryHex);
  // Ideal: clearly distinguishable from thread 1 without becoming a rival.
  const separation = Math.max(0, 1 - Math.abs(between - 2.2) / 3.2);
  const harmony = classifyHarmony(primaryHex, secondaryHex);
  const bonus =
    harmony === 'monochromatic' || harmony === 'tonal' || harmony === 'neutral_accent' ? 1 : 0.72;
  return Math.min(1, separation * 0.6 + bonus * 0.4);
};

const nearestHueBonus = (hex: string, inspiration: string[]): number => {
  if (inspiration.length === 0) return 0;
  const h = hexToHsl(hex).h;
  const best = Math.min(...inspiration.map((i) => hueDistance(h, hexToHsl(i).h)));
  return best <= 25 ? 0.12 : best <= 55 ? 0.06 : 0;
};

/**
 * Generates ranked candidate palettes. Pure function: same input, same output.
 */
export const generateHarmonyCandidates = (
  input: HarmonyInput,
  limit = 12,
): HarmonyCandidate[] => {
  const rules = OCCASION_RULES[input.occasion];
  const inspiration = input.inspirationHexes ?? [];

  const activeThreads = input.threads.filter(
    (t) => t.active && (rules.allowMetallic || !t.metallic),
  );
  if (activeThreads.length === 0) return [];

  const seasonFamilies = SEASON_BASE_FAMILIES[input.season];
  const bases = input.baseColorId
    ? input.colors.filter((c) => c.id === input.baseColorId)
    : input.colors.filter(
        (c) => c.active && (seasonFamilies.includes(c.family) || c.family === 'accent'),
      );

  const candidates: HarmonyCandidate[] = [];

  for (const base of bases) {
    // Evening and formal wear tolerate darker fabric; daytime leans light.
    const lightnessBias =
      rules.preferLightBase && input.timeOfDay === 'day'
        ? base.lightness / 100
        : 0.6 + (1 - Math.abs(base.lightness - 55) / 100) * 0.4;

    const ranked = activeThreads
      .map((t) => ({
        thread: t,
        score: scorePairing(base.hex, t.hex, rules.contrastTarget) + nearestHueBonus(t.hex, inspiration),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    for (const primary of ranked) {
      const threadIds = [primary.thread.id];
      let combinedScore = primary.score;

      if (input.channelCount >= 2) {
        const secondary = activeThreads
          .filter((t) => t.id !== primary.thread.id)
          .map((t) => ({
            thread: t,
            score:
              scoreSecondaryThread(primary.thread.hex, t.hex, base.hex) +
              nearestHueBonus(t.hex, inspiration),
          }))
          .sort((a, b) => b.score - a.score)[0];
        if (secondary) {
          threadIds.push(secondary.thread.id);
          combinedScore = combinedScore * 0.65 + secondary.score * 0.35;
        }
      }

      if (input.channelCount >= 3) {
        const used = new Set(threadIds);
        const accent = activeThreads
          .filter((t) => !used.has(t.id))
          .map((t) => ({
            thread: t,
            // The third thread is a highlight: it should be light and quiet.
            score:
              scoreSecondaryThread(primary.thread.hex, t.hex, base.hex) *
              (hexToHsl(t.hex).l > 60 ? 1.1 : 0.8),
          }))
          .sort((a, b) => b.score - a.score)[0];
        if (accent) {
          threadIds.push(accent.thread.id);
          combinedScore = combinedScore * 0.8 + accent.score * 0.2;
        }
      }

      const harmony = classifyHarmony(base.hex, primary.thread.hex);
      const harmonyPreferenceBonus = rules.preferredHarmonies.includes(harmony) ? 0.12 : 0;

      candidates.push({
        baseColorId: base.id,
        threadColorIds: threadIds,
        // The furakha traditionally echoes the primary thread.
        furakhaColorId: primary.thread.id,
        harmony,
        personality: personalityFor(harmony, rules.personality, base, primary.thread),
        harmonyScore: Math.min(
          1,
          combinedScore * 0.78 + lightnessBias * 0.1 + harmonyPreferenceBonus,
        ),
      });
    }
  }

  return dedupe(candidates)
    .sort((a, b) => b.harmonyScore - a.harmonyScore)
    .slice(0, limit);
};

const personalityFor = (
  harmony: HarmonyKind,
  occasionPersonality: StylePersonality,
  base: GarmentColor,
  thread: ThreadColor,
): StylePersonality => {
  if (thread.metallic && base.lightness > 70) return 'luxe';
  if (harmony === 'complementary' || harmony === 'split_complementary') return 'bold';
  if (harmony === 'monochromatic' || harmony === 'tonal') return 'calm';
  if (harmony === 'neutral_accent' && base.family === 'white') return 'classic';
  return occasionPersonality;
};

const dedupe = (list: HarmonyCandidate[]): HarmonyCandidate[] => {
  const seen = new Set<string>();
  const out: HarmonyCandidate[] = [];
  for (const c of list) {
    const key = `${c.baseColorId}|${c.threadColorIds.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
};

/** Spreads results so the user does not see six near-identical palettes. */
export const diversify = (
  candidates: HarmonyCandidate[],
  count: number,
): HarmonyCandidate[] => {
  const picked: HarmonyCandidate[] = [];
  const usedBases = new Set<string>();
  const usedHarmonies = new Set<HarmonyKind>();

  for (const c of candidates) {
    if (picked.length >= count) break;
    if (usedBases.has(c.baseColorId) && usedHarmonies.has(c.harmony)) continue;
    picked.push(c);
    usedBases.add(c.baseColorId);
    usedHarmonies.add(c.harmony);
  }
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.slice(0, count);
};
