/**
 * Unit tests for the pure logic.
 *
 * These cover the parts where being wrong is expensive and silent: ages and
 * timelines (a birthday off by a day is visible to a parent), photo scoring
 * (must be stable, or the same photo gets a different verdict each time), the
 * generation state machine (where a wrong predicate deadlocked the progress
 * screen once already), and the storage path layout (which is the shape the
 * privacy rules key off).
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict';

import { ageOn, nextBirthday, parseIsoDate, timelineYears, toIsoDate } from '../src/domain/age';
import { occasionCatalogue, occasionLabel } from '../src/domain/occasions';
import { presentationFor, memoryKindPresentation } from '../src/domain/memoryKinds';
import {
  currentTraits,
  groupTraits,
  pastTraits,
  traitCategories,
  traitCategoryFor,
  traitValueKey,
  traitsAtAgeMonths,
  type ChildTrait,
} from '../src/domain/traits';
import { floorProgressFor, isAwaitingResult, isFailed, stageIndexFor } from '../src/services/threeD/pipeline';
import {
  dHashOf, exposureOf, hammingDistance, measure, sharpnessOf, subjectProminenceOf,
} from '../src/services/readiness/signals';
import { assessCollection, scorePhoto } from '../src/services/readiness/collection';
import { pixelAnalyzerCapabilities, type ViewRole } from '../src/services/readiness/types';
import { blur, centredSubject, distantSubject, sharpDetail, shifted, uniform } from './fixtures';
import { MOCK_DURATION_MS, seedUnit, simulate, willFail } from '../src/services/threeD/mockSimulator';
import { extensionFromUri, mimeFromExtension, storagePathFor } from '../src/data/storagePaths';
import { format } from '../src/i18n/format';
import { selectPlural } from '../src/i18n/plurals';
import { describeAge } from '../src/features/child/age';
import { en } from '../src/i18n/strings';
import { ar } from '../src/i18n/ar';

function isoYearsAgo(years: number): string {
  const now = new Date();
  return `${now.getUTCFullYear() - years}-01-01`;
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function suite(name: string): void {
  console.log(`\n${name}`);
}

function test(name: string, run: () => void | Promise<void>): void {
  try {
    const result = run();
    if (result instanceof Promise) {
      // Async cases push themselves onto the pending list below.
      pending.push(
        result.then(
          () => {
            passed += 1;
            console.log(`  ✓ ${name}`);
          },
          (error: unknown) => {
            failed += 1;
            failures.push(`${name}: ${String(error)}`);
            console.log(`  ✗ ${name}`);
          },
        ),
      );
      return;
    }
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${String(error)}`);
    console.log(`  ✗ ${name}`);
  }
}

const pending: Promise<void>[] = [];

/* ------------------------------------------------------------------ ages */

suite('Age and timeline');

test('age is calendar-accurate, not a division', () => {
  assert.deepEqual(ageOn('2021-04-12', '2026-04-11'), { years: 4, months: 11, totalMonths: 59 });
  assert.deepEqual(ageOn('2021-04-12', '2026-04-12'), { years: 5, months: 0, totalMonths: 60 });
});

test('a birthday on the 29th of February does not fall over', () => {
  const age = ageOn('2020-02-29', '2026-03-01');
  assert.equal(age.years, 6);
});

test('a date of birth in the future reads as zero rather than negative', () => {
  assert.deepEqual(ageOn('2030-01-01', '2026-01-01'), { years: 0, months: 0, totalMonths: 0 });
});

test('a newborn is measured in months', () => {
  assert.equal(ageOn('2026-06-01', '2026-08-20').totalMonths, 2);
});

test('the timeline spans birth year to this year and grows on its own', () => {
  assert.deepEqual(timelineYears('2021-04-12', '2024-01-01'), [2021, 2022, 2023, 2024]);
  assert.deepEqual(timelineYears('2026-01-01', '2026-08-20'), [2026]);
});

test('the next birthday rolls into next year once this year has passed', () => {
  const before = nextBirthday('2021-04-12', '2026-03-01');
  assert.equal(before?.date, '2026-04-12');
  assert.equal(before?.turning, 5);

  const after = nextBirthday('2021-04-12', '2026-08-20');
  assert.equal(after?.date, '2027-04-12');
  assert.equal(after?.turning, 6);
});

test('the birthday is today when it is today', () => {
  const today = nextBirthday('2021-04-12', '2026-04-12');
  assert.equal(today?.daysAway, 0);
});

test('malformed dates are rejected rather than guessed at', () => {
  assert.equal(parseIsoDate('not-a-date'), null);
  assert.equal(parseIsoDate('2026-13-45'), null);
  assert.equal(toIsoDate(new Date('2026-04-12T10:00:00Z')), '2026-04-12');
});

/* ------------------------------------------------------------ occasions */

suite('Occasions');

test('no occasion is treated as universal', () => {
  // The catalogue is a menu, not a default. Nothing in it is pre-selected;
  // families opt in from Settings.
  assert.ok(occasionCatalogue.length >= 8);
  const keys = occasionCatalogue.map((occasion) => occasion.key);
  for (const expected of ['ramadan', 'eid_al_fitr', 'qaranqasho', 'christmas', 'new_year']) {
    assert.ok(keys.includes(expected), `missing ${expected}`);
  }
});

test('every occasion is labelled in both languages', () => {
  for (const occasion of occasionCatalogue) {
    assert.ok(occasion.labelEn.length > 0, occasion.key);
    assert.ok(occasion.labelAr.length > 0, occasion.key);
    assert.notEqual(occasionLabel(occasion.key, 'ar'), occasion.key);
  }
});

/* ------------------------------------------------------- memory kinds */

suite('Memory kinds');

test('every kind offered in the UI has a presentation', () => {
  for (const presentation of memoryKindPresentation) {
    assert.equal(presentationFor(presentation.kind).kind, presentation.kind);
    assert.ok(presentation.labelAr.length > 0);
  }
});

test('an unknown kind falls back rather than rendering blank', () => {
  // Kinds are extensible in the database; the UI must survive one it predates.
  assert.ok(presentationFor('milestone').icon.length > 0);
});

/* ----------------------------------------------------- 3D readiness */

suite('3D readiness — real pixel measurement');

test('blur genuinely lowers the sharpness measurement', () => {
  // Ground truth: the same image, one blurred. If this ever stops holding, the
  // measurement has become decorative.
  const sharp = sharpDetail();
  const soft = blur(sharp, 2);
  assert.ok(sharpnessOf(sharp) > sharpnessOf(soft) * 3,
    `sharp ${sharpnessOf(sharp)} vs blurred ${sharpnessOf(soft)}`);
});

test('exposure detects crushed blacks and blown highlights', () => {
  assert.ok(exposureOf(uniform(32, 32, 5)).clippedShadows > 0.9);
  assert.ok(exposureOf(uniform(32, 32, 252)).clippedHighlights > 0.9);
  const mid = exposureOf(uniform(32, 32, 128));
  assert.ok(mid.clippedShadows < 0.01 && mid.clippedHighlights < 0.01);
});

test('a centred subject reads as more prominent than a distant one', () => {
  const near = subjectProminenceOf(centredSubject());
  const far = subjectProminenceOf(distantSubject());
  assert.ok(near.prominence > far.prominence);
  assert.ok(far.backgroundBusyness > near.backgroundBusyness);
});

test('near-duplicate photos hash closer together than unrelated ones', () => {
  const a = centredSubject();
  const nearDuplicate = shifted(a, 1, 1);
  const unrelated = distantSubject();
  const dupDistance = hammingDistance(dHashOf(a), dHashOf(nearDuplicate));
  const farDistance = hammingDistance(dHashOf(a), dHashOf(unrelated));
  assert.ok(dupDistance < farDistance, `${dupDistance} !< ${farDistance}`);
});

suite('3D readiness — collection intelligence');

function analysed(id: string, role: ViewRole, bitmap: ReturnType<typeof centredSubject>, megapixels = 3) {
  const signals = measure(bitmap);
  return { photoId: id, role, signals: { ...signals, megapixels, width: 2000, height: 3000 } };
}

test('a sharp, well-framed photo scores above a blurred or dark one', () => {
  const good = scorePhoto(analysed('a', 'face', centredSubject(128, 160))).score;
  const soft = scorePhoto(analysed('b', 'face', blur(sharpDetail(128, 160), 3))).score;
  const dark = scorePhoto(analysed('c', 'face', uniform(128, 160, 5))).score;
  assert.ok(good > soft && good > dark, `good ${good}, soft ${soft}, dark ${dark}`);
});

test('a small photo is flagged, whatever else is right about it', () => {
  const report = scorePhoto(analysed('d', 'face', centredSubject(128, 160), 0.2));
  assert.ok(report.issues.some((issue) => issue.key === 'too_small'));
});

test('one usable photo is enough to generate from', () => {
  // Guidance, never a gate: a parent with a single photograph of a moment that
  // will not come again should still get a keepsake.
  const one = assessCollection(
    [analysed('p1', 'face', centredSubject(128, 160))],
    pixelAnalyzerCapabilities, 'test', '1',
  );
  assert.equal(one.canGenerate, true);
  assert.ok(one.coverage.some((item) => item.role === 'full_body' && item.state === 'missing'));
});

test('better coverage scores higher than a single view', () => {
  const one = assessCollection(
    [analysed('p1', 'face', centredSubject(128, 160))],
    pixelAnalyzerCapabilities, 'test', '1',
  ).score;
  const many = assessCollection(
    [
      analysed('p1', 'face', centredSubject(128, 160)),
      analysed('p2', 'full_body', centredSubject(140, 180)),
      analysed('p3', 'side', centredSubject(150, 170, 0.3)),
    ],
    pixelAnalyzerCapabilities, 'test', '1',
  ).score;
  assert.ok(many > one, `${many} !> ${one}`);
});

test('the same shot added twice is detected rather than charged for', () => {
  const base = centredSubject(128, 160);
  const result = assessCollection(
    [analysed('p1', 'face', base), analysed('p2', 'front_body', shifted(base, 1, 1))],
    pixelAnalyzerCapabilities, 'test', '1',
  );
  assert.ok(result.duplicatePairs.length > 0);
  assert.ok(result.photos[1].issues.some((issue) => issue.key === 'duplicate'));
});

test('an empty set cannot generate', () => {
  const none = assessCollection([], pixelAnalyzerCapabilities, 'test', '1');
  assert.equal(none.canGenerate, false);
  assert.equal(none.score, 0);
});

test('the analyser declares exactly what it cannot do', () => {
  // This is the test that keeps the product honest. The previous system
  // reported "Face: Excellent" without anything having looked for a face; these
  // flags are what the UI reads before it is allowed to claim anything.
  assert.equal(pixelAnalyzerCapabilities.readsPixels, true);
  assert.equal(pixelAnalyzerCapabilities.measuresSharpness, true);
  assert.equal(pixelAnalyzerCapabilities.detectsPerson, false);
  assert.equal(pixelAnalyzerCapabilities.detectsFace, false);
  assert.equal(pixelAnalyzerCapabilities.detectsBody, false);
  assert.equal(pixelAnalyzerCapabilities.classifiesView, false);
  assert.equal(pixelAnalyzerCapabilities.verifiesIdentity, false);
});

/* --------------------------------------------------------- 3D pipeline */

suite('3D pipeline');

test('every status maps to a stage the parent can be shown', () => {
  const statuses = [
    'uploaded', 'image_checked', 'generating', 'raw_model_ready', 'quality_review',
    'printability_check', 'approved', 'print_ready', 'ordered', 'printing',
    'shipped', 'delivered', 'failed',
  ] as const;
  for (const status of statuses) {
    const index = stageIndexFor(status);
    assert.ok(index >= 0 && index < en.threeD.stages.length, status);
  }
});

test('progress never goes backwards through the happy path', () => {
  const path = ['uploaded', 'image_checked', 'generating', 'raw_model_ready', 'quality_review', 'printability_check', 'approved'] as const;
  let previous = -1;
  for (const status of path) {
    const value = floorProgressFor(status);
    assert.ok(value >= previous, `${status} went backwards`);
    previous = value;
  }
});

test('a job is only finished when it has an outcome, not merely a late status', () => {
  // This is the bug that deadlocked the progress screen: `raw_model_ready` is
  // past generation but before there is anything to show.
  assert.equal(isAwaitingResult({ status: 'raw_model_ready', completedAt: null }), true);
  assert.equal(isAwaitingResult({ status: 'quality_review', completedAt: null }), true);
  assert.equal(isAwaitingResult({ status: 'approved', completedAt: '2026-01-01T00:00:00Z' }), false);
  assert.equal(isAwaitingResult({ status: 'failed', completedAt: null }), false);
  assert.equal(isFailed('failed'), true);
});

/* ------------------------------------------------------ mock simulator */

suite('Mock3DProvider simulation');

test('a job walks forward and finishes', () => {
  const job = { id: 'job-abc', createdAt: '2026-01-01T00:00:00.000Z', attempt: 1 };
  const start = new Date(job.createdAt).getTime();

  const early = simulate(job, start + 500);
  assert.equal(early.done, false);
  assert.ok(early.progress < 0.2);

  const late = simulate(job, start + MOCK_DURATION_MS * 3);
  assert.equal(late.done, true);
  assert.equal(late.progress, 1);
});

test('progress is monotonic across the whole run', () => {
  const job = { id: 'job-monotonic', createdAt: '2026-01-01T00:00:00.000Z', attempt: 1 };
  const start = new Date(job.createdAt).getTime();
  let previous = -1;
  for (let elapsed = 0; elapsed <= MOCK_DURATION_MS * 2; elapsed += 250) {
    const state = simulate(job, start + elapsed);
    if (state.status === 'failed') break;
    assert.ok(state.progress >= previous, `regressed at ${elapsed}ms`);
    previous = state.progress;
  }
});

test('the simulation is deterministic for a given job', () => {
  const job = { id: 'job-determinism', createdAt: '2026-01-01T00:00:00.000Z', attempt: 1 };
  const at = new Date(job.createdAt).getTime() + 8_000;
  assert.deepEqual(simulate(job, at), simulate(job, at));
  assert.equal(seedUnit('job-determinism', 'x'), seedUnit('job-determinism', 'x'));
});

test('some first attempts fail, so the recovery path is real', () => {
  const failures = Array.from({ length: 400 }, (_, i) => willFail(`job-${i}`, 1)).filter(Boolean);
  assert.ok(failures.length > 0, 'nothing ever failed — the retry path would be untested');
  assert.ok(failures.length < 120, 'too many failures to demo with');
});

test('a retry always succeeds, so a parent is never stuck in a loop', () => {
  for (let i = 0; i < 200; i += 1) {
    assert.equal(willFail(`job-${i}`, 2), false);
  }
});

/* ------------------------------------------------------- storage paths */

suite('Storage layout');

test('paths are scoped by family, which is what the privacy rules key off', () => {
  const path = storagePathFor({
    familyId: 'fam-1',
    childId: 'child-1',
    memoryId: 'mem-1',
    assetId: 'asset-1',
    extension: 'jpg',
  });
  assert.equal(path, 'families/fam-1/children/child-1/memories/mem-1/originals/asset-1.jpg');
  // The storage policy reads the family id from the second segment, so its
  // position is load-bearing.
  assert.equal(path.split('/')[0], 'families');
  assert.equal(path.split('/')[1], 'fam-1');
});

test('originals, previews, models and print files are kept apart', () => {
  const folders = ['originals', 'processed', 'previews', 'models', 'print', 'story', 'avatars'] as const;
  const seen = new Set<string>();
  for (const folder of folders) {
    const path = storagePathFor({
      familyId: 'f', childId: 'c', memoryId: 'm', assetId: 'a', extension: 'jpg', bucketFolder: folder,
    });
    assert.ok(path.includes(`/${folder}/`), folder);
    seen.add(path);
  }
  assert.equal(seen.size, folders.length);
});

test('file extensions and mime types are derived safely', () => {
  assert.equal(extensionFromUri('file:///a/b/photo.JPEG'), 'jpg');
  assert.equal(extensionFromUri('https://x/y.png?token=abc'), 'png');
  assert.equal(extensionFromUri('file:///no-extension'), 'jpg');
  assert.equal(mimeFromExtension('png'), 'image/png');
  assert.equal(mimeFromExtension('glb'), 'model/gltf-binary');
});

/* ---------------------------------------------------------------- i18n */

suite('Language');

function sameShape(a: unknown, b: unknown, path: string): void {
  if (Array.isArray(a)) {
    assert.ok(Array.isArray(b), `${path} should be an array in both languages`);
    assert.equal(a.length, (b as unknown[]).length, `${path} has a different length`);
    a.forEach((item, index) => sameShape(item, (b as unknown[])[index], `${path}[${index}]`));
    return;
  }
  if (a && typeof a === 'object') {
    assert.ok(b && typeof b === 'object', `${path} missing`);
    for (const key of Object.keys(a as object)) {
      sameShape((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`);
    }
    return;
  }
  assert.equal(typeof a, typeof b, `${path} differs in type`);
  if (typeof a === 'string') {
    assert.ok((b as string).length > 0, `${path} is empty in Arabic`);
  }
}

test('Arabic is complete — every string, not just the easy ones', () => {
  sameShape(en, ar, 'strings');
});

test('the four onboarding screens exist in both languages', () => {
  assert.equal(en.onboarding.slides.length, 4);
  assert.equal(ar.onboarding.slides.length, 4);
});

test('placeholder interpolation works and leaves unknown tokens alone', () => {
  assert.equal(format('{count} memories', { count: 3 }), '3 memories');
  assert.equal(format('Born {date}', { date: '12 April 2021' }), 'Born 12 April 2021');
  assert.equal(format('{unknown} stays', {}), '{unknown} stays');
});

test('error copy never leaks technical detail to a parent', () => {
  const technical = ['http', 'error code', '500', '502', 'null', 'undefined', 'exception', 'api'];
  for (const [key, message] of Object.entries(en.errors)) {
    const lower = message.toLowerCase();
    for (const term of technical) {
      assert.ok(!lower.includes(term), `errors.${key} mentions "${term}"`);
    }
  }
});

test('the generation copy never mentions AI machinery', () => {
  const forbidden = ['ai', 'model', 'neural', 'algorithm', 'api', 'provider', 'mesh', 'gpu'];
  for (const stage of en.threeD.stages) {
    const words = stage.toLowerCase().split(/\W+/);
    for (const term of forbidden) {
      assert.ok(!words.includes(term), `stage "${stage}" mentions "${term}"`);
    }
  }
});

/* ------------------------------------------------------- child identity */

suite('Child identity and interests');

function trait(over: Partial<ChildTrait> = {}): ChildTrait {
  return {
    id: over.id ?? 'trait-1',
    familyId: 'fam',
    childId: 'child',
    category: over.category ?? 'animal',
    value: over.value ?? 'Unicorns',
    valueKey: traitValueKey(over.value ?? 'Unicorns'),
    customLabel: null,
    source: over.source ?? 'parent',
    confirmedAt: over.confirmedAt ?? '2026-01-01T00:00:00Z',
    isCurrent: over.isCurrent ?? true,
    observedFrom: over.observedFrom ?? '2025-06-01',
    observedTo: over.observedTo ?? null,
    ageMonthsAtRecord: over.ageMonthsAtRecord ?? 49,
    note: null,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
  };
}

test('value keys fold case and spacing so duplicates collide', () => {
  assert.equal(traitValueKey('Unicorns'), traitValueKey('  unicorns  '));
  assert.equal(traitValueKey('Ice   Cream'), 'ice cream');
});

test('Arabic values fold without being mangled', () => {
  // An ASCII-only rule would destroy these. The key must stay Arabic.
  assert.equal(traitValueKey('  الرسم '), 'الرسم');
  assert.equal(traitValueKey('الرسم'), traitValueKey('الرسم '));
  assert.notEqual(traitValueKey('الرسم'), traitValueKey('السباحة'));
});

test('only parent-confirmed current traits form the child portrait', () => {
  // An unconfirmed suggestion must never be shown as something the child loves.
  const list = [
    trait({ id: 'a', value: 'Unicorns' }),
    trait({ id: 'b', value: 'Horses', source: 'suggested', confirmedAt: null }),
    trait({ id: 'c', value: 'Dinosaurs', isCurrent: false, observedTo: '2026-01-01' }),
  ];
  const shown = currentTraits(list).map((item) => item.value);
  assert.deepEqual(shown, ['Unicorns']);
});

test('retiring an interest keeps it in the archive', () => {
  const list = [
    trait({ id: 'a', value: 'Unicorns', isCurrent: false, observedTo: '2028-01-15' }),
    trait({ id: 'b', value: 'Space', observedFrom: '2028-01-20' }),
  ];
  assert.deepEqual(currentTraits(list).map((x) => x.value), ['Space']);
  assert.deepEqual(pastTraits(list).map((x) => x.value), ['Unicorns']);
});

test('the archive can answer what she loved at five, and what she loves now', () => {
  // The question the whole model exists for.
  const dob = '2021-04-12';
  const list = [
    trait({ id: 'a', value: 'Unicorns', observedFrom: '2025-06-01', observedTo: '2028-01-15', isCurrent: false }),
    trait({ id: 'b', value: 'Space', observedFrom: '2028-01-20', category: 'obsession' }),
  ];

  const atFour = traitsAtAgeMonths(list, dob, 50).map((x) => x.value);
  const atSeven = traitsAtAgeMonths(list, dob, 84).map((x) => x.value);

  assert.deepEqual(atFour, ['Unicorns']);
  assert.deepEqual(atSeven, ['Space']);
});

test('an interest can return years later without erasing the first period', () => {
  const dob = '2021-04-12';
  const list = [
    trait({ id: 'a', value: 'Unicorns', observedFrom: '2025-06-01', observedTo: '2026-06-01', isCurrent: false }),
    trait({ id: 'b', value: 'Unicorns', observedFrom: '2030-02-01' }),
  ];
  // Born 2021-04-12, so: 50 months is inside the first period (2025-06 to
  // 2026-06), 81 months falls in the gap (2028-01), 110 months is inside the
  // second (from 2030-02).
  assert.equal(traitsAtAgeMonths(list, dob, 50).length, 1);
  assert.equal(traitsAtAgeMonths(list, dob, 81).length, 0);
  assert.equal(traitsAtAgeMonths(list, dob, 110).length, 1);
});

test('every category is labelled and prompted in both languages', () => {
  for (const presentation of traitCategories) {
    assert.ok(presentation.labelEn.length > 0, presentation.category);
    assert.ok(presentation.labelAr.length > 0, presentation.category);
    assert.ok(presentation.promptAr.includes('{name}'), presentation.category);
    // Arabic suggestions must be written in Arabic, not transliterated.
    for (const suggestion of presentation.suggestionsAr) {
      assert.ok(/[\u0600-\u06FF]/.test(suggestion), `${presentation.category}: ${suggestion}`);
    }
  }
});

test('personality wording stays parent-facing, not clinical', () => {
  // This is a memory feature, not an assessment. Clinical vocabulary here
  // would be both wrong and a claim we have no business making.
  const clinical = ['disorder', 'syndrome', 'deficit', 'diagnosis', 'adhd', 'autistic', 'anxious', 'depressed'];
  const words = traitCategoryFor('personality').suggestionsEn.map((w) => w.toLowerCase());
  for (const term of clinical) {
    assert.ok(!words.includes(term), `personality suggests "${term}"`);
  }
  assert.ok(words.includes('curious') && words.includes('gentle'));
});

test('grouping preserves display order and drops empty categories', () => {
  const list = [trait({ id: 'a', category: 'personality', value: 'Curious' }), trait({ id: 'b', category: 'colour', value: 'Purple' })];
  const groups = groupTraits(list).map((g) => g.category);
  // `colour` is declared before `personality` in the catalogue.
  assert.deepEqual(groups, ['colour', 'personality']);
});

/* -------------------------------------------------------------- plurals */

suite('Plurals');

test('English never says "1 years old"', () => {
  const n = (value: number) => String(value);
  assert.equal(describeAge(isoYearsAgo(1), en, n), '1 year old');
  assert.equal(describeAge(isoYearsAgo(2), en, n), '2 years old');
  assert.equal(describeAge(isoYearsAgo(5), en, n), '5 years old');
});

test('Arabic uses the dual, and the right plural on each side of ten', () => {
  // Arabic distinguishes one, two, 3–10 and 11+. Getting this wrong is what
  // makes a product feel translated rather than written.
  const n = (value: number) => String(value);
  assert.equal(describeAge(isoYearsAgo(1), ar, n), 'سنة واحدة');
  assert.equal(describeAge(isoYearsAgo(2), ar, n), 'سنتان');
  assert.equal(describeAge(isoYearsAgo(5), ar, n), '5 سنوات');
  assert.equal(describeAge(isoYearsAgo(14), ar, n), '14 سنة');
});

test('the four plural forms are selected at the right boundaries', () => {
  const forms = { one: 'one', two: 'two', few: 'few', many: 'many' };
  assert.equal(selectPlural(1, forms), 'one');
  assert.equal(selectPlural(2, forms), 'two');
  assert.equal(selectPlural(3, forms), 'few');
  assert.equal(selectPlural(10, forms), 'few');
  assert.equal(selectPlural(11, forms), 'many');
  assert.equal(selectPlural(0, forms), 'many');
});

/* -------------------------------------------------------------- report */

Promise.all(pending).then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }
});
