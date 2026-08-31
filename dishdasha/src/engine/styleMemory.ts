import type {
  Design,
  DesignConfig,
  Order,
  Season,
  StyleMemory,
} from '@dd/domain/types';
import { getPattern } from '@dd/data/embroidery';
import { nowIso } from '@dd/utils/date';

/**
 * CUSTOMER TAILORING MEMORY ENGINE.
 *
 * The long-term moat: after every order the platform knows a little more about
 * how this customer likes his dishdasha made. It is derived — recomputed from
 * orders and saved designs — so it can never drift out of sync with reality,
 * and it stores preferences, never a screenshot or a body image.
 */
const rank = <T extends string>(items: T[]): T[] => {
  const counts = new Map<T, number>();
  items.forEach((item, index) => {
    // Recent choices weigh more than old ones.
    const recencyWeight = 1 + index / Math.max(1, items.length);
    counts.set(item, (counts.get(item) ?? 0) + recencyWeight);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
};

/** 0 (plain) .. 1 (heavily embroidered), from pattern channel count and price. */
const intensityOf = (config: DesignConfig): number => {
  const pattern = getPattern(config.embroideryPatternId);
  if (!pattern || pattern.motif === 'none') return 0;
  const channelWeight = pattern.channelCount / 3;
  const surchargeWeight = Math.min(1, pattern.surcharge / 7);
  return Math.min(1, channelWeight * 0.55 + surchargeWeight * 0.45);
};

export const buildStyleMemory = (
  customerId: string,
  orders: Order[],
  designs: Design[],
): StyleMemory => {
  // Newest first so the recency weighting above works.
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const configs: DesignConfig[] = [
    ...sorted.flatMap((o) => o.items.map((i) => i.config)),
    ...designs.filter((d) => d.isFavorite).map((d) => d.config),
  ];

  const seasonal: Partial<Record<Season, string[]>> = {};
  for (const order of sorted) {
    const month = new Date(order.createdAt).getMonth() + 1;
    const season: Season = month >= 4 && month <= 10 ? 'summer' : 'winter';
    const colorIds = order.items.map((i) => i.config.baseColorId);
    seasonal[season] = [...(seasonal[season] ?? []), ...colorIds].slice(0, 6);
  }

  const quantities = sorted.flatMap((o) => o.items.map((i) => i.quantity));
  const fits = sorted
    .flatMap((o) => o.items.map((i) => i.measurementSnapshot?.fitPreference))
    .filter((f): f is 'slim' | 'regular' | 'relaxed' => Boolean(f));

  const intensities = configs.map(intensityOf);

  return {
    customerId,
    favoriteFabricIds: rank(configs.map((c) => c.fabricId)).slice(0, 5),
    favoriteColorIds: rank(configs.map((c) => c.baseColorId)).slice(0, 5),
    favoritePatternIds: rank(
      configs.map((c) => c.embroideryPatternId).filter((x): x is string => Boolean(x)),
    ).slice(0, 5),
    favoriteThreadColorIds: rank(configs.flatMap((c) => c.threadColorIds)).slice(0, 6),
    preferredFit: fits.length ? rank(fits)[0] : null,
    preferredTailorId: sorted.length ? rank(sorted.map((o) => o.tailorBusinessId))[0] : null,
    typicalQuantity: quantities.length
      ? Math.max(1, Math.round(quantities.reduce((a, b) => a + b, 0) / quantities.length))
      : 1,
    embroideryIntensity: intensities.length
      ? intensities.reduce((a, b) => a + b, 0) / intensities.length
      : 0,
    seasonalPreference: seasonal,
    orderCount: sorted.length,
    lastOrderAt: sorted[0]?.createdAt ?? null,
    updatedAt: nowIso(),
  };
};

/** The exact configuration behind "order my usual dishdasha". */
export const usualConfig = (
  orders: Order[],
  designs: Design[],
): { config: DesignConfig; source: 'last_order' | 'favorite_design' } | null => {
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const lastItem = sorted[0]?.items[0];
  if (lastItem) return { config: lastItem.config, source: 'last_order' };
  const favorite = designs.find((d) => d.isFavorite) ?? designs[0];
  if (favorite) return { config: favorite.config, source: 'favorite_design' };
  return null;
};

/**
 * Affinity of a candidate palette with what we know about this customer.
 * Feeds the "% match" shown next to a suggestion — an affinity number, not a
 * measurement, and labelled as such in the UI.
 */
export const affinityScore = (
  memory: StyleMemory | null,
  candidate: { baseColorId: string; threadColorIds: string[] },
): number => {
  if (!memory || memory.orderCount === 0) return 0.5;
  let score = 0.5;
  const colorRank = memory.favoriteColorIds.indexOf(candidate.baseColorId);
  if (colorRank >= 0) score += 0.22 - colorRank * 0.04;
  const threadHits = candidate.threadColorIds.filter((t) =>
    memory.favoriteThreadColorIds.includes(t),
  ).length;
  score += Math.min(0.2, threadHits * 0.09);
  return Math.max(0, Math.min(1, score));
};
