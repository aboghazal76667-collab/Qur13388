/**
 * Thinker knowledge profiles.
 *
 * ── The rule this file exists to enforce ────────────────────────────────────
 * Nothing is attributed to a named person unless we can point at a source.
 * Where our records are empty, `dataCoverage: 'none'` makes the UI print an
 * explicit "we hold no documented position" message instead of letting a model
 * fill the silence. An empty claim list here is a correct answer, not a gap to
 * be papered over.
 *
 * `documentation` on each claim is the honesty dial:
 *   documented  — we hold a specific, checkable citation (page/timestamp).
 *   attributed  — the position is publicly and repeatedly associated with the
 *                 author in the cited work, but we have not pinned the locator.
 *   undocumented — never displayed as the thinker's view.
 *
 * To add a thinker: append a `Thinker` here and its claims to `THINKER_CLAIMS`.
 * No other file needs to change.
 */

import type { SourceReference, Thinker, ThinkerClaim } from '../types/knowledge';
import { toReference } from '../quran/repository';
import type { QuranReference } from '../types/quran';

const refs = (pairs: [number, number, string?][]): QuranReference[] =>
  pairs
    .map(([s, a, why]) => toReference(s, a, why))
    .filter(Boolean) as QuranReference[];

const SHAHROUR_KITAB_WAL_QURAN: SourceReference = {
  kind: 'book',
  title: 'الكتاب والقرآن: قراءة معاصرة',
  author: 'محمد شحرور',
  year: '1990',
};

export const THINKERS: Thinker[] = [
  {
    id: 'shahrour',
    nameArabic: 'محمد شحرور',
    nameTransliterated: 'Muhammad Shahrour',
    lifespan: '1938 – 2019',
    country: 'سوريا',
    methodSummary:
      'مهندس ومفكر سوري، اشتهر بمشروع «القراءة المعاصرة» الذي يقارب النص القرآني من داخله ' +
      'اعتمادًا على اللغة والسياق، ويرفض اعتبار التراث التفسيري سلطة نهائية على النص. ' +
      'أبرز ما يميّز منهجه رفضُ افتراض الترادف بين ألفاظ القرآن، وبناء تفريقات اصطلاحية ' +
      'على هذا الأساس. هذا وصف لمنهجه لا إقرار بنتائجه.',
    methodPrinciples: [
      'عدم الترادف: لكل لفظ قرآني دلالته الخاصة، ولا يُفترض تطابق لفظين ما لم يثبت.',
      'الاعتماد على النص القرآني في تحديد المصطلح بدل الرجوع إلى المعاجم المتأخرة.',
      'التمييز بين ما يعدّه «رسالة» (تشريعًا) وما يعدّه «نبوة» (خبرًا وكونيات).',
      'قراءة التشريع بوصفه مجالًا بين حدّين لا نقطة واحدة (ما يسميه «نظرية الحدود»).',
    ],
    knownSources: [
      SHAHROUR_KITAB_WAL_QURAN,
      { kind: 'book', title: 'الدولة والمجتمع', author: 'محمد شحرور', year: '1994' },
      { kind: 'book', title: 'الإسلام والإيمان: منظومة القيم', author: 'محمد شحرور', year: '1996' },
      { kind: 'book', title: 'نحو أصول جديدة للفقه الإسلامي', author: 'محمد شحرور', year: '2000' },
    ],
    dataCoverage: 'partial',
    coverageNote:
      'لدينا وصف موثّق لمنهجه ولعدد من أطروحاته العامة المنشورة في كتبه، ' +
      'لكن قاعدة الادعاءات التفصيلية لكل مسألة ما زالت محدودة. ' +
      'ما لا يوجد نصّه هنا لا يُنسب إليه.',
  },
  {
    id: 'ardiqawi',
    nameArabic: 'ياسر عرديقاوي',
    nameTransliterated: 'Yasser Ardiqawi',
    country: '—',
    methodSummary:
      'مفكر معاصر مهتم بقراءة القرآن من داخله. لا نملك في قاعدة بياناتنا وصفًا موثقًا ' +
      'ومحدّدًا لمنهجه من مصادره المباشرة، ولذلك لا نقدّم هنا تلخيصًا قد يكون غير دقيق.',
    methodPrinciples: [],
    knownSources: [],
    dataCoverage: 'none',
    coverageNote:
      'لا توجد لدينا بيانات موثقة كافية عن أطروحات هذا المفكر. ' +
      'لن يُنسب إليه أي رأي داخل التطبيق حتى تُضاف مصادر مباشرة موثقة ' +
      '(كتاب، مقال، أو تسجيل مع توقيت).',
  },
  {
    id: 'saadoun',
    nameArabic: 'حسين سعدون',
    nameTransliterated: 'Hussein Saadoun',
    country: '—',
    methodSummary:
      'باحث معاصر يُذكر ضمن الأسماء المهتمة بفهم القرآن بالقرآن. ' +
      'لا نملك وصفًا موثقًا لمنهجه من مصادره المباشرة.',
    methodPrinciples: [],
    knownSources: [],
    dataCoverage: 'none',
    coverageNote:
      'لا توجد لدينا بيانات موثقة كافية عن أطروحات هذا المفكر. ' +
      'لن يُنسب إليه أي رأي داخل التطبيق حتى تُضاف مصادر مباشرة موثقة.',
  },
  {
    id: 'nahar',
    nameArabic: 'نايف نهار',
    nameTransliterated: 'Nayef Nahar',
    country: '—',
    methodSummary:
      'أكاديمي وباحث معاصر. لا نملك في قاعدة بياناتنا وصفًا موثقًا ومحدّدًا لمواقفه ' +
      'في المسائل التي يعالجها هذا التطبيق.',
    methodPrinciples: [],
    knownSources: [],
    dataCoverage: 'none',
    coverageNote:
      'لا توجد لدينا بيانات موثقة كافية عن أطروحات هذا المفكر. ' +
      'لن يُنسب إليه أي رأي داخل التطبيق حتى تُضاف مصادر مباشرة موثقة.',
  },
];

export const THINKER_BY_ID = new Map(THINKERS.map((t) => [t.id, t]));

/**
 * Recorded claims. Every entry must carry a `source`.
 *
 * These are logged as POSITIONS HELD, to be tested against the text — not as
 * findings of this application. The `reasoning` field reports the author's own
 * stated line of argument where it is publicly known; it is not an endorsement.
 */
export const THINKER_CLAIMS: ThinkerClaim[] = [
  {
    id: 'shahrour-non-synonymy',
    thinkerId: 'shahrour',
    topic: 'method',
    topicLabel: 'المنهج — عدم الترادف',
    claim:
      'لا ترادف في القرآن: كل لفظ يحمل دلالة تخصّه، وافتراض تطابق لفظين يحتاج إلى إثبات لا إلى تسليم.',
    reasoning:
      'يبني هذا المبدأ على أن دقة النص تقتضي ألا يرد لفظان مختلفان لمعنى واحد، ' +
      'ويستعمله أساسًا منهجيًا لإعادة تحديد المصطلحات القرآنية.',
    quranReferences: [],
    source: SHAHROUR_KITAB_WAL_QURAN,
    documentation: 'attributed',
    confidence: 0.85,
  },
  {
    id: 'shahrour-kitab-quran',
    thinkerId: 'shahrour',
    topic: 'kitab',
    topicLabel: 'الكتاب والقرآن',
    claim:
      'يميّز بين «الكتاب» و«القرآن» بوصفهما مصطلحين غير مترادفين، فيجعل الكتاب هو المجموع المدوَّن ' +
      'والقرآن قسمًا منه، ويبني على ذلك تفريقًا بين النبوة والرسالة.',
    reasoning:
      'يستند إلى المواضع التي يُعطف فيها اللفظان أو يوصف فيها أحدهما بما لا يوصف به الآخر، ' +
      'ويعدّ العطف قرينة على المغايرة.',
    quranReferences: refs([
      [15, 1, 'يجمع بين «الكتاب» و«قرآن» في سياق واحد'],
      [27, 1, 'يجمع بين «القرآن» و«كتاب مبين»'],
    ]),
    source: SHAHROUR_KITAB_WAL_QURAN,
    documentation: 'attributed',
    confidence: 0.75,
  },
  {
    id: 'shahrour-hudood',
    thinkerId: 'shahrour',
    topic: 'hukm',
    topicLabel: 'نظرية الحدود',
    claim:
      'يقرأ النصوص التشريعية بوصفها حدودًا (عليا ودنيا) يتحرك التشريع البشري بينها، ' +
      'لا أحكامًا نقطية ثابتة لا تقبل الاجتهاد داخل المجال.',
    reasoning:
      'ينطلق من ورود لفظ «حدود الله» في سياق التشريع، ومن كون بعض الأحكام ترد بصيغة الحد الأقصى ' +
      'أو الأدنى، فيبني على ذلك تصورًا رياضيًا للمجال التشريعي.',
    quranReferences: refs([
      [2, 229, 'يرد فيها لفظ «حدود الله» في سياق تشريعي'],
      [4, 13, 'ذكر الحدود مقرونًا بالطاعة'],
    ]),
    source: SHAHROUR_KITAB_WAL_QURAN,
    documentation: 'attributed',
    confidence: 0.8,
  },
  {
    id: 'shahrour-islam-iman',
    thinkerId: 'shahrour',
    topic: 'islam',
    topicLabel: 'الإسلام والإيمان',
    claim:
      'يفرّق بين «الإسلام» و«الإيمان» فيجعلهما دائرتين مختلفتين لا مترادفتين، ' +
      'الأولى أعمّ والثانية خاصة بأتباع الرسالة الخاتمة.',
    reasoning:
      'يستند إلى المواضع التي يقابل فيها النص بين اللفظين صراحةً، ويعدّ المقابلة دليل مغايرة.',
    quranReferences: refs([
      [49, 14, 'مقابلة صريحة بين «أسلمنا» و«لم تؤمنوا»'],
    ]),
    source: {
      kind: 'book',
      title: 'الإسلام والإيمان: منظومة القيم',
      author: 'محمد شحرور',
      year: '1996',
    },
    documentation: 'attributed',
    confidence: 0.8,
  },
];

export function claimsForThinker(thinkerId: string): ThinkerClaim[] {
  return THINKER_CLAIMS.filter((c) => c.thinkerId === thinkerId && c.documentation !== 'undocumented');
}

export function claimsForTopic(topicId: string): ThinkerClaim[] {
  return THINKER_CLAIMS.filter((c) => c.topic === topicId && c.documentation !== 'undocumented');
}

export const NO_DATA_MESSAGE =
  'لا توجد لدينا بيانات موثقة كافية عن موقف هذا المفكر في هذه المسألة.';

export const DOCUMENTATION_LABELS: Record<ThinkerClaim['documentation'], string> = {
  documented: 'موثّق بمصدر محدد',
  attributed: 'منسوب إليه في مصدر منشور (دون تحديد الموضع)',
  undocumented: 'غير موثق — لا يُعرض',
};
