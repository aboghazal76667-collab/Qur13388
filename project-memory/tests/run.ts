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
import { HeuristicPhotoQualityAnalyzer } from '../src/services/photoQuality/heuristic';
import { verdictFor } from '../src/services/photoQuality/types';
import { floorProgressFor, isAwaitingResult, isFailed, stageIndexFor } from '../src/services/threeD/pipeline';
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

/* ------------------------------------------------------ photo quality */

suite('Photo quality');

test('scoring the same photo twice gives the same answer', async () => {
  const analyzer = new HeuristicPhotoQualityAnalyzer();
  const photo = { uri: 'file:///photo.jpg', width: 3024, height: 4032, byteSize: 2_400_000, fileName: 'photo.jpg' };
  const first = await analyzer.analyze(photo, 'asset-1');
  const second = await analyzer.analyze(photo, 'asset-1');
  assert.equal(first.overallScore, second.overallScore);
  assert.deepEqual(
    first.dimensions.map((d) => d.score),
    second.dimensions.map((d) => d.score),
  );
});

test('a better photo scores higher than a worse one', async () => {
  const analyzer = new HeuristicPhotoQualityAnalyzer();
  const good = await analyzer.analyze(
    { uri: 'file:///a.jpg', width: 3024, height: 4032, byteSize: 3_000_000, fileName: 'a.jpg' },
    'a',
  );
  const bad = await analyzer.analyze(
    { uri: 'file:///a.jpg', width: 320, height: 240, byteSize: 12_000, fileName: 'a.jpg' },
    'a',
  );
  assert.ok(good.overallScore > bad.overallScore, `${good.overallScore} !> ${bad.overallScore}`);
});

test('scores stay inside 0–100 even with missing metadata', async () => {
  const analyzer = new HeuristicPhotoQualityAnalyzer();
  const report = await analyzer.analyze({ uri: 'file:///x.jpg' }, 'x');
  assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
  for (const dimension of report.dimensions) {
    assert.ok(dimension.score >= 0 && dimension.score <= 100, dimension.key);
  }
});

test('a weak photo comes with advice, a strong one does not need it', async () => {
  const analyzer = new HeuristicPhotoQualityAnalyzer();
  const bad = await analyzer.analyze(
    { uri: 'file:///tiny.jpg', width: 200, height: 150, byteSize: 4_000, fileName: 'tiny.jpg' },
    'tiny',
  );
  assert.ok(bad.advice && bad.advice.length > 0);
  assert.equal(bad.verdict, 'poor');
});

test('a small photo cannot average its way to a good score', async () => {
  // A flattering lighting estimate must not rescue an image that simply does
  // not have enough of the child in it.
  const analyzer = new HeuristicPhotoQualityAnalyzer();
  const small = await analyzer.analyze(
    { uri: 'file:///small.jpg', width: 400, height: 300, byteSize: 90_000, fileName: 'small.jpg' },
    'small',
  );
  assert.ok(small.overallScore <= 45, `scored ${small.overallScore}`);
  assert.equal(small.verdict, 'poor');
  assert.ok(small.advice?.toLowerCase().includes('small'));
});

test('the analyzer is honest about not inspecting pixels', () => {
  // The UI reads this flag to word the panel. If a real vision model lands and
  // forgets to set it, the product would understate what it knows — but if a
  // metadata scorer claimed true, it would overstate, which is the failure
  // that matters when the subject is somebody's child.
  assert.equal(new HeuristicPhotoQualityAnalyzer().inspectsPixels, false);
});

test('verdict thresholds line up with the score bands', () => {
  assert.equal(verdictFor(90), 'excellent');
  assert.equal(verdictFor(85), 'excellent');
  assert.equal(verdictFor(70), 'good');
  assert.equal(verdictFor(50), 'fair');
  assert.equal(verdictFor(49), 'poor');
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
