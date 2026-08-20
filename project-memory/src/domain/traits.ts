/**
 * Child identity and interests.
 *
 * The modelling decision that matters: a trait is an observation with a
 * lifetime, not a field. A child who loves unicorns at four loves space at
 * seven; a `favouriteAnimal` field would record only the last of those and
 * destroy the rest, which are exactly the things this product exists to keep.
 *
 * So recording a new interest never overwrites an old one — it opens a period,
 * and moving on closes it. That is what lets the archive answer both "what
 * does she love now?" and "what did she love when she was five?".
 */

import type { IsoDate, Timestamp, UUID } from './types';

export type TraitCategory =
  | 'colour'
  | 'animal'
  | 'toy'
  | 'character'
  | 'book'
  | 'story'
  | 'show'
  | 'movie'
  | 'song'
  | 'food'
  | 'place'
  | 'hobby'
  | 'sport'
  | 'activity'
  | 'obsession'
  | 'makes_them_laugh'
  | 'curious_about'
  | 'good_at'
  | 'personality'
  | 'dream'
  | 'theme'
  | 'custom';

/**
 * Where a trait came from.
 *
 * `parent` is authoritative. `suggested` is something the system proposed and
 * nobody has agreed to yet — it is never displayed as fact, and it is never
 * created by inferring things from a photograph. If a parent never said Ghazal
 * loves horses, the product does not know that she does.
 */
export type TraitSource = 'parent' | 'suggested';

export interface ChildTrait {
  id: UUID;
  familyId: UUID;
  childId: UUID;
  category: TraitCategory;
  /** As the parent typed it. Never normalised into English. */
  value: string;
  /** Case- and space-folded, used only to prevent exact duplicates. */
  valueKey: string;
  /** The parent's own label when `category` is `custom`. */
  customLabel: string | null;
  source: TraitSource;
  /** Set when a parent accepts a suggestion. Null means nobody has agreed. */
  confirmedAt: Timestamp | null;
  /** True while this is something the child loves now. */
  isCurrent: boolean;
  observedFrom: IsoDate;
  /** Set when the trait stops being current. */
  observedTo: IsoDate | null;
  /** The child's age when first recorded, so history is directly answerable. */
  ageMonthsAtRecord: number | null;
  note: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Folds a value for duplicate detection.
 *
 * Unicode-aware and case-folding, so "Unicorns", "unicorns" and " Unicorns "
 * collide, while Arabic values fold correctly rather than being mangled by an
 * ASCII-only rule.
 */
export function traitValueKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export interface TraitCategoryPresentation {
  category: TraitCategory;
  /** Emoji used as a quiet visual marker on chips. */
  glyph: string;
  labelEn: string;
  labelAr: string;
  /** The question put to the parent, in their words. */
  promptEn: string;
  promptAr: string;
  /** Starting points, never a closed list — parents can type anything. */
  suggestionsEn: readonly string[];
  suggestionsAr: readonly string[];
  /** Several values make sense (hobbies) vs usually one (favourite colour). */
  multiple: boolean;
}

/**
 * The categories offered in the UI, in the order a parent meets them.
 *
 * Suggestions exist to save typing, not to constrain: every category accepts a
 * custom value, and Arabic suggestions are written in Arabic rather than being
 * transliterated English.
 */
export const traitCategories: readonly TraitCategoryPresentation[] = [
  {
    category: 'colour',
    glyph: '🎨',
    labelEn: 'Favourite colour',
    labelAr: 'اللون المفضّل',
    promptEn: 'What colour does {name} love?',
    promptAr: 'ما اللون الذي يحبه {name}؟',
    suggestionsEn: ['Purple', 'Blue', 'Pink', 'Green', 'Red', 'Yellow', 'Orange', 'Black'],
    suggestionsAr: ['بنفسجي', 'أزرق', 'وردي', 'أخضر', 'أحمر', 'أصفر', 'برتقالي', 'أسود'],
    multiple: true,
  },
  {
    category: 'animal',
    glyph: '🦄',
    labelEn: 'Favourite animal',
    labelAr: 'الحيوان المفضّل',
    promptEn: 'Which animals does {name} love?',
    promptAr: 'ما الحيوانات التي يحبها {name}؟',
    suggestionsEn: ['Cat', 'Dog', 'Horse', 'Rabbit', 'Dolphin', 'Unicorn', 'Lion', 'Camel'],
    suggestionsAr: ['قطة', 'كلب', 'حصان', 'أرنب', 'دلفين', 'يونيكورن', 'أسد', 'جمل'],
    multiple: true,
  },
  {
    category: 'hobby',
    glyph: '✏️',
    labelEn: 'Hobbies',
    labelAr: 'الهوايات',
    promptEn: 'What does {name} love doing?',
    promptAr: 'ما الذي يحب {name} فعله؟',
    suggestionsEn: ['Drawing', 'Reading', 'Swimming', 'Dancing', 'Building', 'Singing', 'Cooking'],
    suggestionsAr: ['الرسم', 'القراءة', 'السباحة', 'الرقص', 'البناء', 'الغناء', 'الطبخ'],
    multiple: true,
  },
  {
    category: 'toy',
    glyph: '🧸',
    labelEn: 'Favourite toys',
    labelAr: 'الألعاب المفضّلة',
    promptEn: 'What does {name} play with most?',
    promptAr: 'بماذا يلعب {name} أكثر شيء؟',
    suggestionsEn: ['Teddy bear', 'Blocks', 'Dolls', 'Cars', 'Puzzles', 'Blanket'],
    suggestionsAr: ['دبدوب', 'مكعبات', 'دمى', 'سيارات', 'ألغاز', 'بطانية'],
    multiple: true,
  },
  {
    category: 'character',
    glyph: '⭐',
    labelEn: 'Favourite characters',
    labelAr: 'الشخصيات المفضّلة',
    promptEn: 'Who does {name} love?',
    promptAr: 'من الشخصيات التي يحبها {name}؟',
    suggestionsEn: [],
    suggestionsAr: [],
    multiple: true,
  },
  {
    category: 'food',
    glyph: '🍓',
    labelEn: 'Favourite food',
    labelAr: 'الطعام المفضّل',
    promptEn: 'What does {name} love to eat?',
    promptAr: 'ما الطعام الذي يحبه {name}؟',
    suggestionsEn: ['Pasta', 'Rice', 'Mango', 'Strawberries', 'Chocolate', 'Dates', 'Bread'],
    suggestionsAr: ['معكرونة', 'أرز', 'مانجو', 'فراولة', 'شوكولاتة', 'تمر', 'خبز'],
    multiple: true,
  },
  {
    category: 'place',
    glyph: '🏖️',
    labelEn: 'Favourite places',
    labelAr: 'الأماكن المفضّلة',
    promptEn: 'Where does {name} love to be?',
    promptAr: 'أين يحب {name} أن يكون؟',
    suggestionsEn: ['The beach', 'The park', 'Grandma’s house', 'The mountains', 'Home'],
    suggestionsAr: ['البحر', 'الحديقة', 'بيت الجدة', 'الجبل', 'البيت'],
    multiple: true,
  },
  {
    category: 'sport',
    glyph: '⚽',
    labelEn: 'Sports',
    labelAr: 'الرياضة',
    promptEn: 'Does {name} play a sport?',
    promptAr: 'هل يمارس {name} رياضة؟',
    suggestionsEn: ['Football', 'Swimming', 'Cycling', 'Gymnastics', 'Running', 'Karate'],
    suggestionsAr: ['كرة القدم', 'السباحة', 'ركوب الدراجة', 'الجمباز', 'الجري', 'الكاراتيه'],
    multiple: true,
  },
  {
    category: 'obsession',
    glyph: '🔭',
    labelEn: 'Loving right now',
    labelAr: 'شغفه هذه الأيام',
    promptEn: 'What is {name} obsessed with at the moment?',
    promptAr: 'ما الذي يشغل {name} هذه الأيام؟',
    suggestionsEn: ['Space', 'Dinosaurs', 'Trains', 'Princesses', 'Robots', 'The sea'],
    suggestionsAr: ['الفضاء', 'الديناصورات', 'القطارات', 'الأميرات', 'الروبوتات', 'البحر'],
    multiple: true,
  },
  {
    category: 'personality',
    glyph: '🌱',
    labelEn: 'Personality',
    labelAr: 'الشخصية',
    promptEn: 'How would you describe {name}?',
    promptAr: 'كيف تصف {name}؟',
    // Plain parent-facing words. This is a memory feature, not an assessment:
    // no clinical vocabulary and no claims about the child beyond the parent's.
    suggestionsEn: [
      'Curious', 'Creative', 'Funny', 'Adventurous', 'Gentle', 'Energetic',
      'Quiet', 'Social', 'Imaginative', 'Independent', 'Caring', 'Confident',
    ],
    suggestionsAr: [
      'فضولي', 'مبدع', 'مرح', 'مغامر', 'لطيف', 'نشيط',
      'هادئ', 'اجتماعي', 'خيالي', 'مستقل', 'حنون', 'واثق',
    ],
    multiple: true,
  },
  {
    category: 'dream',
    glyph: '🚀',
    labelEn: 'Dreams of becoming',
    labelAr: 'يحلم أن يصبح',
    promptEn: 'What does {name} want to be?',
    promptAr: 'ماذا يريد {name} أن يصبح؟',
    suggestionsEn: ['Astronaut', 'Doctor', 'Teacher', 'Footballer', 'Artist', 'Engineer', 'Vet'],
    suggestionsAr: ['رائد فضاء', 'طبيب', 'معلّم', 'لاعب كرة', 'فنان', 'مهندس', 'طبيب بيطري'],
    multiple: true,
  },
  {
    category: 'custom',
    glyph: '✨',
    labelEn: 'Something else',
    labelAr: 'شيء آخر',
    promptEn: 'Anything else about {name}?',
    promptAr: 'أي شيء آخر عن {name}؟',
    suggestionsEn: [],
    suggestionsAr: [],
    multiple: true,
  },
];

export function traitCategoryFor(category: TraitCategory): TraitCategoryPresentation {
  return (
    traitCategories.find((item) => item.category === category) ??
    traitCategories[traitCategories.length - 1]
  );
}

/** The categories offered first, before the parent has told us anything. */
export const introTraitCategories: readonly TraitCategory[] = [
  'colour',
  'animal',
  'hobby',
  'personality',
];

/** Only what the parent has confirmed, and only what is true now. */
export function currentTraits(traits: ChildTrait[]): ChildTrait[] {
  return traits.filter((trait) => trait.isCurrent && trait.source === 'parent');
}

/** Traits the child has moved on from, newest period first. */
export function pastTraits(traits: ChildTrait[]): ChildTrait[] {
  return traits
    .filter((trait) => !trait.isCurrent)
    .sort((a, b) => (b.observedTo ?? '').localeCompare(a.observedTo ?? ''));
}

/**
 * What the child loved at a given age, in months.
 *
 * The question the archive exists to answer. A trait counts if the period it
 * was observed in overlaps that age.
 */
export function traitsAtAgeMonths(
  traits: ChildTrait[],
  dateOfBirth: IsoDate,
  ageMonths: number,
): ChildTrait[] {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return [];

  const at = new Date(birth);
  at.setUTCMonth(at.getUTCMonth() + ageMonths);
  const atIso = at.toISOString().slice(0, 10);

  return traits.filter(
    (trait) => trait.observedFrom <= atIso && (trait.observedTo === null || trait.observedTo >= atIso),
  );
}

/** Groups traits by category, preserving the display order above. */
export function groupTraits(traits: ChildTrait[]): { category: TraitCategory; traits: ChildTrait[] }[] {
  return traitCategories
    .map((presentation) => ({
      category: presentation.category,
      traits: traits.filter((trait) => trait.category === presentation.category),
    }))
    .filter((group) => group.traits.length > 0);
}
