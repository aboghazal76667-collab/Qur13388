/** Arabic text utilities: normalisation, root handling, display helpers. */

/** Harakat, tanween, shadda, sukun, superscript alif, Quranic annotation marks. */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣣ࣡-ࣿ]/g;
const TATWEEL = /ـ/g;
/** Quran-specific pause marks and sajdah signs that sit inline in the text. */
const QURAN_MARKS = /[۝۞۩ۖ-ۜ۟-۪ۨ-ۭ]/g;
const NON_ARABIC = /[^ء-يٱ\s]/g;

/**
 * Superscript alif (U+0670) is where Uthmani orthography and everyday typing
 * diverge, and getting it wrong makes core words unsearchable. It is a
 * diacritic standing in for a full alif, so it is expanded rather than dropped:
 *
 *   ٱلۡكِتَٰبَ   -> الكتاب   (not الكتب: a reader typing الكتاب must match)
 *   رَزَقۡنَٰهُمۡ  -> رزقناهم
 *
 * Two carriers behave differently and are handled first:
 *   وٰ  the waw itself is the long alif:  ٱلصَّلَوٰةَ -> الصلاة, ٱلۡحَيَوٰةُ -> الحياة
 *   ىٰ  the alif maqsura already carries it: عَلَىٰ -> على, مُوسَىٰ -> موسى
 *
 * A small closed set (الرحمٰن, هٰذا, ذٰلك) is written without the alif in
 * ordinary orthography too, so expansion over-generates there. Those are caught
 * by `collapseAlif`, which search falls back to.
 */
const SUPERSCRIPT_ALIF = '\u0670';
/** Harakat that may sit between a letter and its superscript alif. */
const HARAKAT = '[\u064B-\u0652\u0653-\u065F]*';

const WAW_AS_ALIF = new RegExp(`\u0648${HARAKAT}${SUPERSCRIPT_ALIF}`, 'g');
const MAQSURA_AS_ALIF = new RegExp(`\u0649${HARAKAT}${SUPERSCRIPT_ALIF}`, 'g');
const SUPERSCRIPT_AFTER_LETTER = new RegExp(
  `([\u0621-\u064A])(${HARAKAT})${SUPERSCRIPT_ALIF}`,
  'g'
);

function expandSuperscriptAlif(input: string): string {
  return input
    .replace(WAW_AS_ALIF, 'ا')
    .replace(MAQSURA_AS_ALIF, '\u0649')
    .replace(SUPERSCRIPT_AFTER_LETTER, '$1$2ا');
}

/**
 * Recall fallback: drop every non-initial bare alif, so spellings differing
 * only by a written/unwritten alif converge (الرحمان <-> الرحمن, هاذا <-> هذا).
 *
 * Lossy on purpose - كتاب and كتب collapse together - so it is never the
 * primary key. Search consults it only when the faithful key returns nothing.
 */
export function collapseAlif(input: string): string {
  return input.replace(/(.)ا/g, '$1');
}

/**
 * Reduce a string to a stable search key:
 * strips diacritics and tatweel, unifies hamza carriers, alif maqsura and taa
 * marbuta. Two words that a reader would consider "the same word written
 * differently" collapse to the same key.
 */
export function normalizeArabic(input: string): string {
  if (!input) return '';
  return expandSuperscriptAlif(input)
    .replace(DIACRITICS, '')
    .replace(QURAN_MARKS, '')
    .replace(TATWEEL, '')
    .replace(/[آأإٱٲٳٵ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/[ؤئ]/g, 'ء') // ؤ ئ -> ء
    // The mushaf spells madda out as hamza + alif (ءَامَنُوا۟, ٱلۡقُرۡءَان) where
    // ordinary typing uses a single آ. Collapsing the pair makes القرآن and
    // آمنوا findable.
    .replace(/ءا/g, 'ا')
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/اا+/g, 'ا') // ربوٰا -> الربا, not الرباا
    .replace(NON_ARABIC, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalisation that keeps taa marbuta and alif maqsura distinct. */
export function lightNormalize(input: string): string {
  if (!input) return '';
  return expandSuperscriptAlif(input)
    .replace(DIACRITICS, '')
    .replace(QURAN_MARKS, '')
    .replace(TATWEEL, '')
    .replace(/ٱ/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

const DEFINITE_ARTICLE = /^(?:و|ف|ب|ك|ل)?(?:ال)/;
const PREFIX_PARTICLES = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل', 'س'];
const SUFFIXES = ['هما', 'كما', 'هم', 'هن', 'كم', 'كن', 'نا', 'ها', 'ه', 'ك', 'ي', 'ون', 'ين', 'ات', 'ان'];

/**
 * Best-effort stem for free-text search only. This is deliberately shallow: the
 * authoritative root/lemma always comes from the morphology dataset, never from
 * this function.
 */
export function looseStem(word: string): string {
  let w = normalizeArabic(word);
  for (const p of PREFIX_PARTICLES) {
    if (w.length - p.length >= 3 && w.startsWith(p)) {
      w = w.slice(p.length);
      break;
    }
  }
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 3 && w.endsWith(s)) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  return w;
}

export function hasDefiniteArticle(word: string): boolean {
  return DEFINITE_ARTICLE.test(normalizeArabic(word));
}

/** Root key used for lookups: hamza carriers unified, spaces removed. */
export function normalizeRoot(root: string): string {
  return root
    .replace(/\s+/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/ى/g, 'ي');
}

/** Render a root the way it is spoken: "ص ل و". */
export function displayRoot(root: string): string {
  return root.split('').join(' ');
}

/** Accepts "ح ج ب", "حجب", "ح-ج-ب" and returns the canonical lookup key. */
export function parseRootInput(input: string): string {
  return normalizeRoot(input.replace(/[\s\-_.]+/g, ''));
}

export function isArabic(text: string): boolean {
  return /[ء-ي]/.test(text);
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Arabic-Indic digits for verse numbering in the mushaf view. */
export function toArabicNumerals(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

const STOP_WORDS = new Set([
  'من', 'في', 'على', 'الي', 'عن', 'مع', 'هل', 'ما', 'ماذا', 'لماذا', 'كيف', 'اين', 'متي',
  'هو', 'هي', 'هم', 'هن', 'انا', 'نحن', 'انت', 'الذي', 'التي', 'الذين', 'هذا', 'هذه', 'ذلك',
  'ان', 'او', 'ثم', 'قد', 'لا', 'لم', 'لن', 'كل', 'بين', 'عند', 'يعني', 'معني', 'معنا',
  'الفرق', 'يوجد', 'توجد', 'كان', 'يكون', 'حسب', 'حول', 'وهل', 'وما', 'اذا',
  'الكريم', 'اية', 'ايه', 'ايات', 'سوره', 'كلمه',
]);

export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(normalizeArabic(word));
}

/** Content words from a free-text question, normalised, in order, de-duplicated. */
export function extractContentWords(question: string): string[] {
  return extractContentWordPairs(question).map((p) => p.normalized);
}

/**
 * Same filtering as `extractContentWords`, but keeps the reader's own spelling
 * alongside the search key. Screens should show `surface` — displaying the
 * normalised key back to the user renders «الصلاة» as «الصلاه», which looks
 * like a typo the app introduced.
 */
export function extractContentWordPairs(question: string): { surface: string; normalized: string }[] {
  const seen = new Set<string>();
  const out: { surface: string; normalized: string }[] = [];
  for (const raw of tokenize(question)) {
    const normalized = normalizeArabic(raw);
    if (!normalized || normalized.length < 3 || isStopWord(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ surface: raw.replace(/[؟?!.,،:;]/g, '').trim() || raw, normalized });
  }
  return out;
}
