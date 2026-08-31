import type { EmbroideryPattern, MotifKey } from '@dd/domain/types';

/**
 * EMBROIDERY DIGITAL LIBRARY.
 *
 * Patterns are data, not UI. Each one names a vector `motif` renderer plus its
 * independent thread channels — changing channel 2 must recolour only the
 * paths bound to channel 2. The motifs are original abstract/geometric
 * constructions drawn for this project; no proprietary tailoring pattern has
 * been copied.
 *
 * Tailors will later upload their own catalogues; `tailorBusinessIds` already
 * scopes availability per workshop.
 */
type Seed = {
  id: string;
  code: string;
  ar: string;
  en: string;
  motif: MotifKey;
  channels: 1 | 2 | 3;
  family: EmbroideryPattern['styleFamily'];
  defaults: string[];
  surcharge: number;
  tags: string[];
  popularity: number;
  isNew?: boolean;
  classification?: EmbroideryPattern['classification'];
  tailors?: string[];
};

const ALL_TAILORS = ['tlr_al_asalah', 'tlr_muscat_atelier', 'tlr_nizwa_house'];

const CHANNEL_LABELS: Record<number, { ar: string; en: string }> = {
  1: { ar: 'الخيط الأساسي', en: 'Primary thread' },
  2: { ar: 'الخيط الثانوي', en: 'Secondary thread' },
  3: { ar: 'خيط اللمسة', en: 'Accent thread' },
};

const SEEDS: Seed[] = [
  { id: 'emb_none', code: '00', ar: 'بدون تطريز', en: 'No embroidery', motif: 'none', channels: 1, family: 'minimal', defaults: ['th_white'], surcharge: 0, tags: ['plain'], popularity: 40, classification: 'unverified' },
  { id: 'emb_01', code: '01', ar: 'سلسلة المعين', en: 'Chain diamond', motif: 'chain_diamond', channels: 2, family: 'omani_traditional', defaults: ['th_navy', 'th_silver'], surcharge: 3.5, tags: ['classic', 'daily'], popularity: 96, classification: 'traditional' },
  { id: 'emb_02', code: '02', ar: 'الحبل المزدوج', en: 'Twin cord', motif: 'twin_cord', channels: 2, family: 'omani_traditional', defaults: ['th_ivory', 'th_gold'], surcharge: 3.0, tags: ['classic'], popularity: 88, classification: 'traditional' },
  { id: 'emb_03', code: '03', ar: 'سعف النخيل', en: 'Palm frond', motif: 'palm_frond', channels: 3, family: 'omani_traditional', defaults: ['th_deep_green', 'th_gold', 'th_ivory'], surcharge: 5.5, tags: ['eid', 'occasion'], popularity: 91, classification: 'traditional' },
  { id: 'emb_04', code: '04', ar: 'الشبكة', en: 'Lattice', motif: 'lattice', channels: 2, family: 'geometric', defaults: ['th_graphite', 'th_platinum'], surcharge: 4.0, tags: ['modern'], popularity: 72 },
  { id: 'emb_05', code: '05', ar: 'الموج', en: 'Wave rope', motif: 'wave_rope', channels: 2, family: 'omani_contemporary', defaults: ['th_royal_blue', 'th_sky'], surcharge: 3.8, tags: ['coastal', 'modern'], popularity: 68 },
  { id: 'emb_06', code: '06', ar: 'عقدة النجمة', en: 'Star knot', motif: 'star_knot', channels: 3, family: 'geometric', defaults: ['th_navy', 'th_silver', 'th_sky'], surcharge: 6.0, tags: ['formal', 'wedding'], popularity: 84 },
  { id: 'emb_07', code: '07', ar: 'صف الأقواس', en: 'Arch row', motif: 'arch_row', channels: 2, family: 'omani_traditional', defaults: ['th_chocolate', 'th_camel'], surcharge: 3.6, tags: ['classic'], popularity: 63, classification: 'traditional' },
  { id: 'emb_08', code: '08', ar: 'الخط الرفيع', en: 'Fine pinstripe', motif: 'fine_pinstripe', channels: 1, family: 'minimal', defaults: ['th_pearl_grey'], surcharge: 1.8, tags: ['minimal', 'daily'], popularity: 79 },
  { id: 'emb_09', code: '09', ar: 'الجديلة', en: 'Rope braid', motif: 'rope_braid', channels: 2, family: 'omani_traditional', defaults: ['th_ivory', 'th_sand'], surcharge: 3.2, tags: ['classic'], popularity: 74, classification: 'traditional' },
  { id: 'emb_10', code: '10', ar: 'التعريشة', en: 'Trellis', motif: 'trellis', channels: 3, family: 'geometric', defaults: ['th_teal', 'th_platinum', 'th_white'], surcharge: 5.8, tags: ['modern', 'occasion'], popularity: 58, isNew: true },
  { id: 'emb_11', code: '11', ar: 'صف الأهلة', en: 'Crescent row', motif: 'crescent_row', channels: 2, family: 'omani_contemporary', defaults: ['th_antique_gold', 'th_ivory'], surcharge: 4.4, tags: ['eid'], popularity: 81 },
  { id: 'emb_12', code: '12', ar: 'الزجزاج', en: 'Zigzag band', motif: 'zigzag_band', channels: 2, family: 'geometric', defaults: ['th_burgundy', 'th_sand'], surcharge: 3.4, tags: ['bold'], popularity: 52 },
  { id: 'emb_13', code: '13', ar: 'سلسلة الزهيرات', en: 'Floret chain', motif: 'floret_chain', channels: 3, family: 'omani_contemporary', defaults: ['th_plum', 'th_silver', 'th_white'], surcharge: 6.4, tags: ['occasion', 'wedding'], popularity: 66, isNew: true },
  { id: 'emb_14', code: '14', ar: 'القوس المزدوج', en: 'Double arch', motif: 'double_arch', channels: 2, family: 'omani_traditional', defaults: ['th_black', 'th_pearl_grey'], surcharge: 3.9, tags: ['formal'], popularity: 70, classification: 'traditional' },
  { id: 'emb_15', code: '15', ar: 'المربع الكوفي', en: 'Square kufic', motif: 'square_kufic', channels: 3, family: 'geometric', defaults: ['th_maroon', 'th_gold', 'th_ivory'], surcharge: 6.8, tags: ['formal', 'wedding', 'eid'], popularity: 87 },
];

export const EMBROIDERY_PATTERNS: EmbroideryPattern[] = SEEDS.map((s) => ({
  id: s.id,
  code: s.code,
  name: { ar: s.ar, en: s.en },
  collectionId: s.family,
  styleFamily: s.family,
  motif: s.motif,
  channelCount: s.channels,
  channels: Array.from({ length: s.channels }, (_, i) => ({
    index: (i + 1) as 1 | 2 | 3,
    label: CHANNEL_LABELS[i + 1],
    defaultThreadColorId: s.defaults[i] ?? s.defaults[0],
  })),
  allowedZones:
    s.motif === 'none' ? [] : (['collar', 'placket', 'chest', 'cuff'] as const).slice(),
  surcharge: s.surcharge,
  tags: s.tags,
  popularity: s.popularity,
  isNew: s.isNew ?? false,
  classification: s.classification ?? 'unverified',
  tailorBusinessIds: s.tailors ?? ALL_TAILORS,
  active: true,
}));

export const getPattern = (id: string | null): EmbroideryPattern | undefined =>
  id ? EMBROIDERY_PATTERNS.find((p) => p.id === id) : undefined;

export const patternsForTailor = (tailorId: string): EmbroideryPattern[] =>
  EMBROIDERY_PATTERNS.filter((p) => p.active && p.tailorBusinessIds.includes(tailorId));

export const EMBROIDERY_COLLECTIONS = [
  { id: 'omani_traditional', name: { ar: 'تقليدي عُماني', en: 'Omani traditional' } },
  { id: 'omani_contemporary', name: { ar: 'عُماني معاصر', en: 'Omani contemporary' } },
  { id: 'geometric', name: { ar: 'هندسي', en: 'Geometric' } },
  { id: 'minimal', name: { ar: 'بسيط', en: 'Minimal' } },
];
