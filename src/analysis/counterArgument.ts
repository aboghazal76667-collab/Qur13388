/**
 * Counterargument Engine.
 *
 * After any substantive conclusion, the system is required to attack it. The
 * offline version does this structurally: it looks inside the corpus for the
 * occurrences that a conclusion has to explain away — usages of the same root
 * that fall OUTSIDE the pattern the conclusion rests on.
 *
 * This is not decoration. A reading that accounts for 40 of 60 occurrences and
 * quietly ignores the other 20 is a weaker reading, and the user should be told
 * which 20.
 */

import type { CounterArgument, UsagePattern, WordAnalysis } from '../types/analysis';
import type { QuranReference, VerseKey } from '../types/quran';
import { getVerseByKey, referenceFromVerse } from '../quran/repository';

const toRefs = (keys: VerseKey[], relevance: string, limit = 4): QuranReference[] =>
  keys
    .slice(0, limit)
    .map((k) => getVerseByKey(k))
    .filter(Boolean)
    .map((v) => referenceFromVerse(v!, relevance));

/**
 * Build the strongest objection available from the text itself against a
 * reading built on `dominantPattern`.
 */
export function buildCounterArgument(
  analysis: WordAnalysis,
  dominantPattern?: UsagePattern
): CounterArgument | null {
  const patterns = analysis.usagePatterns;
  if (patterns.length === 0) return null;

  const dominant = dominantPattern ?? patterns[0];
  const outliers = patterns.filter((p) => p.id !== dominant.id);

  if (outliers.length === 0) {
    // Nothing in the distribution objects; the honest objection is methodological.
    return {
      statement:
        `كل مواضع «${analysis.word}» تنتظم في نمط بنيوي واحد، ` +
        'لكن اتحاد البنية النحوية لا يستلزم اتحاد الدلالة: قد يرد اللفظ في التركيب نفسه ' +
        'ويُراد به معنيان مختلفان بحسب الموضوع لا بحسب الإعراب.',
      quranEvidence: dominant.sampleReferences.slice(0, 3),
      response:
        'يُردّ على ذلك بأن غياب أي تنوّع بنيوي يجعل دعوى تعدد المعنى بلا سند من النص، ' +
        'فتبقى دعوى ممكنة غير مدعومة.',
      strength: 'medium',
    };
  }

  // Rank objections by how much of the corpus they leave unexplained.
  const ranked = [...outliers].sort((a, b) => b.verseKeys.length - a.verseKeys.length);
  const strongest = ranked[0];
  const unexplained = ranked.reduce((sum, p) => sum + p.verseKeys.length, 0);
  const total = patterns.reduce((sum, p) => sum + p.verseKeys.length, 0);
  const share = total > 0 ? unexplained / total : 0;

  return {
    statement:
      `أقوى اعتراض من داخل النص: القراءة المبنية على النمط «${dominant.label}» ` +
      `تترك ${unexplained} موضعًا (نحو ${Math.round(share * 100)}% من المواضع) خارج تفسيرها، ` +
      `أبرزها النمط «${strongest.label}». ` +
      'وأي قراءة لا تستوعب هذه المواضع تبقى ناقصة حتى تفسّرها أو تبيّن سبب استثنائها.',
    quranEvidence: toRefs(strongest.verseKeys, `موضع خارج النمط الغالب: ${strongest.label}`, 4),
    response:
      share < 0.25
        ? 'يمكن الردّ بأن هذه المواضع أقلية واضحة، وأن حمل الأقل على الأكثر مسلك معتبر ' +
          'ما دام السياق لا يمنعه — مع بقاء الاعتراض قائمًا إلى أن تُفسَّر هذه المواضع فرديًا.'
        : 'نسبة المواضع الخارجة كبيرة بحيث لا يصح تجاوزها بالتغليب. ' +
          'الترجيح هنا يتطلب فحص كل نمط على حدة قبل الحكم، أو القول بتعدد الدلالة.',
    strength: share >= 0.35 ? 'high' : share >= 0.15 ? 'medium' : 'low',
  };
}

/**
 * A generic objection applied when the conclusion depends on a term that never
 * appears in the cited verses — the "is B actually in the text?" check.
 */
export function absenceCounterArgument(
  term: string,
  citedVerses: QuranReference[]
): CounterArgument {
  return {
    statement:
      `لفظ «${term}» لا يرد في الآيات المستشهد بها. ` +
      'كل استنتاج يعتمد عليه يمرّ إذن بمقدمة مضافة إلى النص، لا مأخوذة منه.',
    quranEvidence: citedVerses.slice(0, 3),
    response:
      'قد يُردّ بأن اللفظ غير لازم إذا كان المعنى مستفادًا من التركيب لا من المفردة، ' +
      'لكن عبء بيان ذلك يقع على القراءة نفسها.',
    strength: 'high',
  };
}
