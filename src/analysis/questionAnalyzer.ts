/**
 * STEP 1 — Question Analyzer.
 *
 * Decomposes a free-text question into the main issue, the Quranic vocabulary
 * it touches, the roots worth searching, the sub-questions that need answering,
 * and — the part that matters most — the premises the question itself smuggles
 * in. A question like "هل الحجاب يعني تغطية الشعر؟" already presupposes that
 * "الحجاب" is the relevant Quranic term; surfacing that is half the analysis.
 */

import type { QuestionAnalysis } from '../types/analysis';
import { extractContentWordPairs, looseStem, normalizeArabic } from '../quran/arabic';
import { rootsOfWord } from '../quran/search';
import { rootExists } from '../quran/repository';
import { CONCEPTS } from '../knowledge/concepts';

interface AssumptionRule {
  test: RegExp;
  assumption: string;
}

/**
 * Question shapes that carry a hidden premise. Each rule states the premise
 * neutrally so the user can accept or reject it, rather than having it decided
 * for them silently.
 */
const ASSUMPTION_RULES: AssumptionRule[] = [
  {
    test: /هل\s+.*يعني|هل\s+.*بمعنى|يعني\s+/,
    assumption:
      'يفترض السؤال أن اللفظ المسؤول عنه يحمل معنى واحدًا محددًا يمكن إثباته أو نفيه، ' +
      'بينما قد يحمل اللفظ عدة استعمالات في النص.',
  },
  {
    test: /الفرق\s+بين/,
    assumption:
      'يفترض السؤال وجود فرق دلالي بين الألفاظ المذكورة. ' +
      'وجود الفرق أو انتفاؤه هو نفسه ما ينبغي اختباره، لا ما يُبنى عليه.',
  },
  {
    test: /هل\s+.*واجب|الوجوب|فرض|حرام|يحرم|جائز/,
    assumption:
      'يفترض السؤال أن تصنيف الأحكام (واجب / حرام / جائز) مقولة مستخرجة من النص. ' +
      'هذه المصطلحات اصطلاحات أصولية لاحقة، فيلزم بيان كيف تُستخرج من صيغة الآية نفسها.',
  },
  {
    test: /كل\s+أمر|جميع\s+الأوامر|صيغة\s+الأمر/,
    assumption:
      'يفترض السؤال أن صيغة الأمر النحوية تحمل دلالة واحدة ثابتة في كل مواضعها.',
  },
  {
    test: /لماذا|لم\s+/,
    assumption:
      'يفترض السؤال أن للنص علة معلنة يمكن استخراجها، وقد لا يصرّح النص بالعلة.',
  },
  {
    test: /في\s+الإسلام|في\s+الدين|الشريعة/,
    assumption:
      'يوسّع السؤال دائرة المصدر من القرآن إلى «الإسلام» أو «الشريعة» عمومًا. ' +
      'هذا التطبيق يقصر الاستدلال على النص القرآني، فيلزم إعادة صياغة السؤال ضمن هذا الحد.',
  },
];

/**
 * Phrases that frame a question rather than name its subject. "ما معنى ضرب في
 * القرآن؟" is a question about ضرب, not about القرآن, so the frame is stripped
 * before terms are extracted — otherwise every question would retrieve the root
 * ق ر أ.
 */
const FRAMING_PHRASES = [
  /في\s+القرآن\s+الكريم/g,
  /في\s+القرآن/g,
  /في\s+المصحف/g,
  /من\s+القرآن/g,
  /حسب\s+القرآن/g,
];

function stripFraming(question: string): string {
  let out = question;
  for (const pattern of FRAMING_PHRASES) out = out.replace(pattern, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Word-level match, not substring match.
 *
 * Substring containment produced false hits that mattered: the content word
 * «أمر» is contained in «امرأة» once both are normalised, which routed a
 * question about imperative forms to the concept "المرأة". Matching on whole
 * words, or on shared loose stems of at least three letters, removes that class
 * of error.
 */
function termsMatch(a: string, b: string): boolean {
  const x = normalizeArabic(a);
  const y = normalizeArabic(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const sx = looseStem(x);
  const sy = looseStem(y);
  return sx.length >= 3 && sx === sy;
}

export function analyzeQuestion(question: string): QuestionAnalysis {
  const trimmed = question.trim();
  const contentPairs = extractContentWordPairs(stripFraming(trimmed));
  const contentWords = contentPairs.map((p) => p.normalized);

  const conceptHits = CONCEPTS.filter(
    (c) =>
      c.terms.some((t) => contentWords.some((w) => termsMatch(t, w))) ||
      contentWords.some((w) => termsMatch(c.labelArabic, w))
  );

  // The reader's own spelling first, then the concept map's canonical terms.
  const quranicTerms = Array.from(
    new Set([...contentPairs.map((p) => p.surface), ...conceptHits.flatMap((c) => c.terms.slice(0, 3))])
  ).slice(0, 10);

  // Roots taken straight from the question's own words rank ahead of roots
  // pulled in by concept association, so retrieval stays anchored to what was
  // actually asked.
  const askedRoots = contentWords.flatMap((w) => rootsOfWord(w));
  const candidateRoots = Array.from(new Set([...askedRoots, ...conceptHits.flatMap((c) => c.roots)]))
    .filter((r) => rootExists(r))
    .slice(0, 10);

  const implicitAssumptions = ASSUMPTION_RULES.filter((r) => r.test.test(trimmed)).map(
    (r) => r.assumption
  );

  if (implicitAssumptions.length === 0 && contentWords.length > 0) {
    implicitAssumptions.push(
      'يفترض السؤال أن المصطلح المستعمل فيه هو المصطلح الذي يستعمله القرآن نفسه. ' +
        'قد يكون اللفظ الشائع اليوم مختلفًا عن لفظ النص أو أوسع منه.'
    );
  }

  const subQuestions = buildSubQuestions(candidateRoots, contentWords, conceptHits);

  return {
    originalQuestion: trimmed,
    mainIssue: deriveMainIssue(trimmed, conceptHits),
    quranicTerms,
    candidateRoots,
    implicitAssumptions,
    subQuestions,
    relatedConcepts: conceptHits.map((c) => c.id),
  };
}

function deriveMainIssue(question: string, concepts: typeof CONCEPTS): string {
  if (concepts.length === 1) {
    return `تحديد دلالة «${concepts[0].labelArabic}» من خلال استعمال القرآن لها.`;
  }
  if (concepts.length > 1) {
    return `العلاقة بين ${concepts.map((c) => `«${c.labelArabic}»`).join(' و')} في الاستعمال القرآني.`;
  }
  return `فحص السؤال: ${question} — اعتمادًا على النص القرآني وحده.`;
}

function buildSubQuestions(
  roots: string[],
  words: string[],
  concepts: typeof CONCEPTS
): string[] {
  const out: string[] = [];

  for (const root of roots.slice(0, 4)) {
    out.push(`أين وردت مادة (${root.split('').join(' ')}) في القرآن، وكم موضعًا؟`);
  }
  for (const word of words.slice(0, 3)) {
    out.push(`كيف استعمل القرآن لفظ «${word}»، وما السياقات المختلفة له؟`);
  }
  for (const concept of concepts.slice(0, 2)) {
    out.push(...concept.openQuestions.slice(0, 2));
  }

  out.push('هل يوجد نص قرآني صريح في المسألة، أم أن الوصول إليها يحتاج خطوات استدلالية؟');
  out.push('ما المقدمات التي يجب إضافتها إلى النص للوصول إلى الجواب، وهل هي قرآنية؟');

  return Array.from(new Set(out)).slice(0, 10);
}
