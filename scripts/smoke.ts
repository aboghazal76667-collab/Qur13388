/**
 * Engine smoke test.
 *
 * Runs the deterministic pipeline in plain Node so corpus behaviour can be
 * checked without a device:  npx tsx scripts/smoke.ts
 */

import { TOTAL_VERSES, getRootProfile, getVerse, surahs, toReference, verseExists } from '../src/quran/repository';
import { normalizedSearch, rootSearch, rootsOfWord, search } from '../src/quran/search';
import { analyzeWord, describeSenseSpread } from '../src/analysis/internalAnalysis';
import { compareTerms } from '../src/analysis/comparison';
import { runOfflineAnalysis } from '../src/analysis/offlineEngine';
import { analyzeQuestion } from '../src/analysis/questionAnalyzer';
import { validateAnalysisPayload } from '../src/analysis/validate';
import { buildConceptGraph } from '../src/graph/builder';

const line = (s: string) => console.log(`\n=== ${s} ===`);
let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`);
  if (!ok) failures++;
};

line('dataset');
check('114 surahs', surahs.length === 114);
check('6236 verses', TOTAL_VERSES === 6236, String(TOTAL_VERSES));
const fatiha = getVerse(1, 1)!;
check('1:1 text', fatiha.uthmaniText.includes('بِسۡمِ'), fatiha.uthmaniText);
check('2:255 exists', verseExists(2, 255));
check('2:287 does not exist', !verseExists(2, 287));
check('114:7 does not exist', !verseExists(114, 7));

line('reference guard');
check('invalid ref rejected', toReference(2, 999) === null);
const validRef = toReference(2, 183, 'اختبار');
check('valid ref resolves text', !!validRef && validRef.text.length > 10, validRef?.text);

line('roots');
for (const [root, label] of [['صلو', 'ص ل و'], ['كتب', 'ك ت ب'], ['ضرب', 'ض ر ب'], ['حجب', 'ح ج ب'], ['خمر', 'خ م ر'], ['نبا', 'ن ب أ'], ['رسل', 'ر س ل']] as const) {
  const p = getRootProfile(root);
  check(`root ${label}`, !!p && p.occurrenceCount > 0, p ? `${p.occurrenceCount} occ / ${p.verseCount} verses / ${p.forms.length} forms` : 'missing');
}

line('search modes');
check('normalized "حجاب"', normalizedSearch('حجاب').length > 0, `${normalizedSearch('حجاب').length} hits`);
check('root "ح ج ب"', rootSearch('ح ج ب').length > 0, `${rootSearch('ح ج ب').length} verses`);
check('auto search "الصلاة"', search('الصلاة', { limit: 10 }).length > 0);
check('rootsOfWord(الصلاة)', rootsOfWord('الصلاة').includes('صلو'), rootsOfWord('الصلاة').join(','));
check('rootsOfWord(ضرب)', rootsOfWord('ضرب').length > 0, rootsOfWord('ضرب').join(','));

line('word analysis: ضرب');
const darb = analyzeWord('ضرب', { root: 'ضرب' });
check('occurrences > 50', darb.occurrenceCount > 50, String(darb.occurrenceCount));
check('multiple usage patterns', darb.usagePatterns.length > 1, `${darb.usagePatterns.length} patterns`);
console.log('  spread:', describeSenseSpread(darb).headline);
console.log('  patterns:', darb.usagePatterns.slice(0, 5).map((p) => `${p.label}(${p.verseKeys.length})`).join(' | '));
console.log('  prepositions:', darb.prepositionProfile.slice(0, 5).map((p) => `${p.particle}:${p.count}`).join(' '));

line('comparison: نبي / رسول');
const cmp = compareTerms('النبي', 'الرسول', { rootA: 'نبا', rootB: 'رسل' });
check('A has occurrences', cmp.termA.occurrenceCount > 0, String(cmp.termA.occurrenceCount));
check('B has occurrences', cmp.termB.occurrenceCount > 0, String(cmp.termB.occurrenceCount));
check('shared verses found', cmp.sharedVerses.length > 0, `${cmp.sharedVerses.length} shared`);
check('contrasts built', cmp.contrasts.length > 0, `${cmp.contrasts.length}`);
console.log('  verdict:', cmp.distributionalVerdict.summary);

line('question analyzer');
for (const q of [
  'ما معنى الصلاة في القرآن؟',
  'هل الحجاب في القرآن يعني تغطية الشعر؟',
  'ما الفرق بين الكتاب والقرآن والذكر؟',
  'ما معنى ضرب في القرآن؟',
  'هل كل أمر في القرآن يعني الوجوب؟',
]) {
  const qa = analyzeQuestion(q);
  check(`"${q.slice(0, 28)}…" roots`, qa.candidateRoots.length > 0, qa.candidateRoots.join(','));
  console.log(`    assumptions: ${qa.implicitAssumptions.length}, subQ: ${qa.subQuestions.length}`);
}

line('offline pipeline');
const questions = [
  'ما معنى الصلاة في القرآن؟',
  'هل الحجاب في القرآن يعني تغطية الشعر؟',
  'ما الفرق بين النبي والرسول؟',
  'ما معنى ضرب في القرآن؟',
  'ما الفرق بين الكتاب والقرآن والذكر؟',
];
for (const q of questions) {
  const t0 = Date.now();
  const r = runOfflineAnalysis(q);
  const ms = Date.now() - t0;
  check(
    `"${q.slice(0, 26)}…"`,
    r.centralVerses.length > 0 && r.wordAnalyses.length > 0,
    `${ms}ms · ${r.centralVerses.length} verses · ${r.wordAnalyses.length} words · ${r.arguments.length} args · counter:${!!r.strongestCounterArgument} · nonSyn:${r.nonSynonymyNotes.length} · conf:${r.confidence.level}`
  );
  // Every citation must resolve to real dataset text.
  const allRefsValid = r.centralVerses.every((v) => verseExists(v.surah, v.ayah) && v.text.length > 0);
  check('  all citations resolve', allRefsValid);
}

line('thinker records');
const r = runOfflineAnalysis('ما الفرق بين الكتاب والقرآن والذكر؟');
for (const t of r.thinkerPerspectives) {
  console.log(`  ${t.thinkerName}: ${t.claims.length} claims${t.noDataMessage ? ' — ' + t.noDataMessage.slice(0, 50) : ''}`);
  check(`  ${t.thinkerName} claims all sourced`, t.claims.every((c) => !!c.source));
}

line('hallucination guard');
const fake = {
  summary: 'خلاصة اختبارية',
  centralVerses: [
    { surah: 2, ayah: 183, relevance: 'صحيحة' },
    { surah: 2, ayah: 9999, relevance: 'مخترعة' },
    { surah: 200, ayah: 1, relevance: 'سورة غير موجودة' },
    { surah: 5, ayah: 3, text: 'نص مزور تمامًا لا علاقة له بالآية', relevance: 'نص مغلوط' },
  ],
  arguments: [{ conclusion: 'س', premises: ['ص'], quranEvidence: [{ surah: 999, ayah: 1 }], assumptions: [], confidence: 'high', directness: 'A', chain: [] }],
  confidence: { level: 'medium', reason: 'اختبار' },
};
const out = validateAnalysisPayload(fake, {
  question: 'اختبار',
  base: { questionAnalysis: r.questionAnalysis, wordAnalyses: r.wordAnalyses, nonSynonymyNotes: r.nonSynonymyNotes, thinkerPerspectives: r.thinkerPerspectives },
});
check('invented verses dropped', out.value.centralVerses.length === 2, `kept ${out.value.centralVerses.map((v) => v.key).join(',')}`);
check('rejections reported', out.rejected.length >= 3, `${out.rejected.length}`);
check('forged quotation replaced', out.value.centralVerses.every((v) => v.text === getVerse(v.surah, v.ayah)!.uthmaniText));
check('argument with no valid evidence graded E', out.value.arguments[0]?.directness === 'E', out.value.arguments[0]?.directness);
check('thinker section untouched by model', out.value.thinkerPerspectives.length === r.thinkerPerspectives.length);
out.rejected.forEach((x) => console.log('    rejected:', x));

line('graph');
const g = buildConceptGraph('salah');
check('concept graph built', g.nodes.length > 3 && g.edges.length > 2, `${g.nodes.length} nodes / ${g.edges.length} edges`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
