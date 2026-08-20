import { hammingDistance, histogramDistance } from './signals';
import type {
  AnalysedPhoto,
  CollectionReadiness,
  CoverageItem,
  PhotoReadiness,
  ReadinessIssue,
  VisionCapabilities,
  ViewRole,
} from './types';

/**
 * Collection-level readiness.
 *
 * Scoring photos one at a time misses the thing that actually decides whether a
 * reconstruction works: different photos do different jobs. Five near-identical
 * front-on snaps are worth much less than a face shot plus a full body plus a
 * side view, even though each individual image might score well.
 *
 * Pure, so it can be tested directly against known inputs.
 */

/** Below this a photo contributes little; it is still allowed to be used. */
const WEAK_PHOTO_SCORE = 45;
/** dHash bits below which two photos are effectively the same shot. */
const DUPLICATE_DISTANCE = 12;
/** Histogram distance above which a photo looks unrelated to the rest. */
const OUTLIER_DISTANCE = 0.62;

/**
 * What a good reconstruction wants.
 *
 * `needed` items are the ones whose absence visibly costs likeness. Nothing
 * here blocks generation — a single photo is allowed, because a parent with one
 * photograph of a moment that will not come again should still get a keepsake.
 */
const COVERAGE_PLAN: { role: ViewRole; importance: CoverageItem['importance'] }[] = [
  { role: 'face', importance: 'needed' },
  { role: 'full_body', importance: 'needed' },
  { role: 'side', importance: 'helpful' },
  { role: 'back', importance: 'helpful' },
];

/** Scores one photo on measured optics alone. */
export function scorePhoto(photo: AnalysedPhoto): PhotoReadiness & { issues: ReadinessIssue[] } {
  const s = photo.signals;
  const issues: ReadinessIssue[] = [];

  // Resolution. Below roughly a megapixel there is not enough of the child
  // present for a reconstruction, whatever else is right.
  let resolution: number;
  if (s.megapixels >= 3) resolution = 100;
  else if (s.megapixels >= 1.5) resolution = 88;
  else if (s.megapixels >= 0.8) resolution = 70;
  else if (s.megapixels >= 0.3) resolution = 45;
  else resolution = 20;
  if (s.megapixels < 0.8) issues.push({ key: 'too_small', severity: 'warning' });

  // Sharpness is the single strongest optical predictor: a reconstruction
  // cannot invent edges that were never captured.
  const sharpness = Math.round(Math.min(1, s.sharpness / 0.35) * 100);
  if (s.sharpness < 0.12) issues.push({ key: 'blurred', severity: 'warning' });

  // Exposure, judged by clipping rather than by mean alone — a correctly
  // exposed dim room is fine; crushed blacks are not.
  let exposure = 100;
  if (s.clippedShadows > 0.25) {
    exposure -= Math.min(60, s.clippedShadows * 120);
    issues.push({ key: 'too_dark', severity: 'warning' });
  }
  if (s.clippedHighlights > 0.2) {
    exposure -= Math.min(60, s.clippedHighlights * 120);
    issues.push({ key: 'too_bright', severity: 'warning' });
  }
  if (s.brightness < 45) issues.push({ key: 'too_dark', severity: 'note' });
  if (s.contrast < 0.18) {
    exposure -= 15;
    issues.push({ key: 'low_contrast', severity: 'note' });
  }
  exposure = Math.max(0, exposure);

  const framing = Math.round(s.subjectProminence * 100);
  if (s.subjectProminence < 0.45) issues.push({ key: 'subject_small', severity: 'warning' });

  const background = Math.round((1 - s.backgroundBusyness) * 100);
  if (s.backgroundBusyness > 0.7) issues.push({ key: 'busy_background', severity: 'note' });

  if (s.colourCast > 0.6) issues.push({ key: 'strong_colour_cast', severity: 'note' });

  const score = Math.round(
    resolution * 0.28 + sharpness * 0.3 + exposure * 0.2 + framing * 0.14 + background * 0.08,
  );

  return {
    photoId: photo.photoId,
    role: photo.role,
    score: Math.max(0, Math.min(100, score)),
    signals: s,
    issues,
    analyzerId: '',
    analyzerVersion: '',
  };
}

function coverageFor(photos: PhotoReadiness[]): CoverageItem[] {
  return COVERAGE_PLAN.map(({ role, importance }) => {
    const satisfied = photos.some((photo) => {
      if (photo.score < WEAK_PHOTO_SCORE) return false;
      if (photo.role === role) return true;
      // A full-body photo also answers the front-body question, and a face is
      // usually legible in a front-body shot. Coverage should reflect what a
      // photo actually provides, not just its label.
      if (role === 'face' && (photo.role === 'front_body' || photo.role === 'full_body')) {
        return photo.signals.megapixels >= 1.5 && photo.signals.subjectProminence >= 0.55;
      }
      if (role === 'full_body' && photo.role === 'front_body') return true;
      return false;
    });
    return { role, state: satisfied ? 'present' : 'missing', importance };
  });
}

export function assessCollection(
  analysed: AnalysedPhoto[],
  capabilities: VisionCapabilities,
  analyzerId: string,
  analyzerVersion: string,
): CollectionReadiness {
  const photos = analysed.map((photo) => ({
    ...scorePhoto(photo),
    analyzerId,
    analyzerVersion,
  }));

  // Near-duplicates: the same shot twice adds nothing to a reconstruction, and
  // a parent adding one by accident should be told rather than charged for it.
  const duplicatePairs: CollectionReadiness['duplicatePairs'] = [];
  for (let i = 0; i < photos.length; i += 1) {
    for (let j = i + 1; j < photos.length; j += 1) {
      const distance = hammingDistance(photos[i].signals.dHash, photos[j].signals.dHash);
      if (distance <= DUPLICATE_DISTANCE) {
        duplicatePairs.push({ a: photos[i].photoId, b: photos[j].photoId, distance });
      }
    }
  }
  for (const pair of duplicatePairs) {
    const later = photos.find((photo) => photo.photoId === pair.b);
    if (later && !later.issues.some((issue) => issue.key === 'duplicate')) {
      later.issues.push({ key: 'duplicate', severity: 'note' });
    }
  }

  // Outliers: a photo whose colour makeup is unlike every other one in the set
  // may be a different scene — or a different person. We cannot tell which,
  // and say so rather than guessing; the parent is asked to look.
  const outliers: string[] = [];
  if (photos.length >= 3) {
    for (const photo of photos) {
      const others = photos.filter((other) => other.photoId !== photo.photoId);
      const distances = others.map((other) =>
        histogramDistance(photo.signals.histogram, other.signals.histogram),
      );
      const closest = Math.min(...distances);
      if (closest > OUTLIER_DISTANCE) outliers.push(photo.photoId);
    }
  }

  const coverage = coverageFor(photos);
  const usable = photos.filter((photo) => photo.score >= WEAK_PHOTO_SCORE);

  // The collection score blends the best optics available with how much of the
  // plan is covered. Best rather than mean, because one strong reference is
  // worth more than three mediocre ones.
  const bestOptics = photos.length === 0 ? 0 : Math.max(...photos.map((photo) => photo.score));
  const neededMet = coverage.filter((item) => item.importance === 'needed' && item.state === 'present').length;
  const neededTotal = coverage.filter((item) => item.importance === 'needed').length;
  const helpfulMet = coverage.filter((item) => item.importance === 'helpful' && item.state === 'present').length;
  const helpfulTotal = coverage.filter((item) => item.importance === 'helpful').length;

  const coverageScore =
    neededTotal === 0
      ? 100
      : (neededMet / neededTotal) * 80 + (helpfulTotal === 0 ? 20 : (helpfulMet / helpfulTotal) * 20);

  const duplicatePenalty = Math.min(12, duplicatePairs.length * 6);
  const score =
    photos.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(100, Math.round(bestOptics * 0.55 + coverageScore * 0.45 - duplicatePenalty)),
        );

  return {
    score,
    // One usable photo is enough to try. Guidance, never a gate.
    canGenerate: usable.length > 0,
    photos,
    coverage,
    duplicatePairs,
    outliers,
    capabilities,
  };
}
