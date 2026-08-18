/**
 * Human-readable Arabic labels for the morphology tags carried by the corpus.
 *
 * These labels describe grammatical form only. They say what a word IS
 * (a perfect verb, a plural noun, an imperative) — never what it MEANS.
 */

export const FEATURE_LABELS: Record<string, string> = {
  // Part of speech / derivation
  PN: 'اسم عَلَم',
  ADJ: 'صفة',
  ACT_PCPL: 'اسم فاعل',
  PASS_PCPL: 'اسم مفعول',
  VN: 'مصدر',
  PRON: 'ضمير',
  DEM: 'اسم إشارة',
  REL: 'اسم موصول',
  LOC: 'ظرف',
  INDEF: 'نكرة',

  // Verb tense / mood / voice
  PERF: 'فعل ماضٍ',
  IMPF: 'فعل مضارع',
  IMPV: 'فعل أمر',
  PASS: 'مبني للمجهول',
  'MOOD:IND': 'مرفوع',
  'MOOD:SUBJ': 'منصوب',
  'MOOD:JUS': 'مجزوم',

  // Case
  NOM: 'مرفوع (فاعل/مبتدأ)',
  ACC: 'منصوب (مفعول/حال)',
  GEN: 'مجرور',

  // Gender / number
  M: 'مذكر',
  F: 'مؤنث',
  MS: 'مذكر مفرد',
  FS: 'مؤنث مفرد',
  MD: 'مذكر مثنى',
  FD: 'مؤنث مثنى',
  MP: 'مذكر جمع',
  FP: 'مؤنث جمع',

  // Person agreement
  '1S': 'المتكلم المفرد',
  '1P': 'المتكلم الجمع',
  '2MS': 'المخاطب المذكر المفرد',
  '2FS': 'المخاطبة المؤنثة المفردة',
  '2MD': 'المخاطب المثنى',
  '2FD': 'المخاطبة المثنى',
  '2MP': 'المخاطبون',
  '2FP': 'المخاطبات',
  '3MS': 'الغائب المذكر',
  '3FS': 'الغائبة المؤنثة',
  '3MD': 'الغائب المثنى',
  '3FD': 'الغائبة المثنى',
  '3D': 'الغائب المثنى',
  '3MP': 'الغائبون',
  '3FP': 'الغائبات',
  '2D': 'المخاطب المثنى',

  // Particles
  P: 'حرف جر',
  CONJ: 'حرف عطف',
  NEG: 'أداة نفي',
  COND: 'أداة شرط',
  SUB: 'حرف مصدري',
  INTG: 'أداة استفهام',
  RES: 'أداة حصر',
  CERT: 'حرف تحقيق',
  FUT: 'حرف استقبال',
  EXH: 'أداة تحضيض',
  EXP: 'أداة تفسير',
  AMD: 'حرف استئناف',
  SUR: 'حرف فجاءة',
  AVR: 'حرف ردع',
  ANS: 'حرف جواب',
  RET: 'حرف إضراب',
  INC: 'حرف ابتداء',
  PRO: 'ناهية',
  PREV: 'كافّة',
  ATT: 'حرف تنبيه',
  EXL: 'أداة تفصيل',
  SUP: 'حرف زائد',
  INL: 'حروف مقطّعة',
  T: 'تاء القسم',
  INT: 'أداة نداء',
  NV: 'أداة نداء',
};

/** Verb form (وزن) numbering used by the corpus: VF:1 … VF:11. */
export function verbFormLabel(feature: string): string | null {
  const m = /^VF:(\d+)$/.exec(feature);
  if (!m) return null;
  const forms = [
    '',
    'فَعَلَ (المجرد)',
    'فعَّل (التضعيف)',
    'فاعَل (المفاعلة)',
    'أفعَل (التعدية)',
    'تفعَّل',
    'تفاعَل',
    'انفعَل',
    'افتعَل',
    'افعلَّ',
    'استفعَل',
    'افعالَّ',
  ];
  return forms[Number(m[1])] ?? null;
}

export function featureLabel(feature: string): string {
  if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature];
  const vf = verbFormLabel(feature);
  if (vf) return `وزن ${vf}`;
  if (feature.startsWith('FAM:')) return `من أسرة ${feature.slice(4)}`;
  return feature;
}

export const TENSE_FEATURES = ['PERF', 'IMPF', 'IMPV'] as const;
export const NUMBER_FEATURES = ['MS', 'FS', 'MD', 'FD', 'MP', 'FP'] as const;
export const CASE_FEATURES = ['NOM', 'ACC', 'GEN'] as const;

export function tenseOf(features: string[]): string | undefined {
  return TENSE_FEATURES.find((t) => features.includes(t));
}

export function numberOf(features: string[]): string | undefined {
  return NUMBER_FEATURES.find((t) => features.includes(t));
}

export function caseOf(features: string[]): string | undefined {
  return CASE_FEATURES.find((t) => features.includes(t));
}

export function isSingular(features: string[]): boolean {
  return features.includes('MS') || features.includes('FS');
}

export function isPlural(features: string[]): boolean {
  return features.includes('MP') || features.includes('FP');
}

/** Prepositions the analysis engine watches, since they often flip the sense. */
export const PREPOSITIONS = [
  'في', 'من', 'الي', 'علي', 'عن', 'ب', 'ل', 'ك', 'مع', 'حتي', 'بين', 'لدي', 'عند', 'دون',
];

export const PREPOSITION_SURFACES: Record<string, string> = {
  في: 'في',
  من: 'مِن',
  الي: 'إلى',
  علي: 'على',
  عن: 'عن',
  ب: 'بـ',
  ل: 'لـ',
  ك: 'كـ',
  مع: 'مع',
  حتي: 'حتى',
  بين: 'بين',
  لدي: 'لدى',
  عند: 'عند',
  دون: 'دون',
};
