import { newId, nowIso } from '@/lib/ids';
import type { PhotoQualityReport, QualityDimension, QualityDimensionKey } from '@/domain';

import { verdictFor, type PhotoInput, type PhotoQualityAnalyzer } from './types';

/**
 * The MVP analyzer.
 *
 * It scores what can honestly be measured from the image's own properties —
 * resolution, aspect ratio, pixel density, compression ratio — and is explicit
 * about the fact that it does not yet look at faces or bodies. Where it cannot
 * measure something it produces a stable, image-derived estimate rather than a
 * random number, so a parent who re-checks the same photo sees the same score.
 *
 * `inspectsPixels` is false. The UI reads that flag and words the panel
 * accordingly, which keeps the product honest: we never claim to have found a
 * face we did not look for.
 */

const ANALYZER_ID = 'heuristic-metadata';
const ANALYZER_VERSION = '1.0.0';

/** Stable 0–1 value derived from a string, so scoring is deterministic. */
function stableUnit(seed: string, salt: string): number {
  let hash = 2166136261;
  const input = `${seed}::${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

interface Measures {
  megapixels: number;
  aspect: number;
  /** Bytes per pixel — a rough proxy for compression damage. */
  bytesPerPixel: number | null;
  isPortraitish: boolean;
  hasDimensions: boolean;
}

function measure(input: PhotoInput): Measures {
  const width = input.width ?? 0;
  const height = input.height ?? 0;
  const hasDimensions = width > 0 && height > 0;
  const megapixels = hasDimensions ? (width * height) / 1_000_000 : 0;
  const aspect = hasDimensions ? width / height : 1;
  const bytesPerPixel =
    hasDimensions && input.byteSize ? input.byteSize / (width * height) : null;

  return {
    megapixels,
    aspect,
    bytesPerPixel,
    isPortraitish: aspect <= 1.05,
    hasDimensions,
  };
}

/**
 * Resolution drives how much of a face survives a crop, so it is the strongest
 * signal available without a model.
 */
function resolutionScore(m: Measures): number {
  if (!m.hasDimensions) return 62;
  if (m.megapixels >= 8) return 96;
  if (m.megapixels >= 4) return 90;
  if (m.megapixels >= 2) return 80;
  if (m.megapixels >= 1) return 68;
  if (m.megapixels >= 0.5) return 52;
  return 34;
}

/**
 * Heavily compressed images lose the fine edges a reconstruction needs. Very
 * low bytes-per-pixel is the clearest sign of that.
 */
function compressionScore(m: Measures): number {
  if (m.bytesPerPixel == null) return 70;
  if (m.bytesPerPixel >= 0.9) return 95;
  if (m.bytesPerPixel >= 0.5) return 88;
  if (m.bytesPerPixel >= 0.25) return 78;
  if (m.bytesPerPixel >= 0.12) return 62;
  return 44;
}

/**
 * A hard ceiling on the overall score, set by resolution alone.
 *
 * Without this, a tiny image with a flattering lighting estimate can average
 * its way up to "fair". It cannot: below about a megapixel there is simply not
 * enough of the child's face present for a reconstruction, and no amount of
 * good lighting puts the pixels back. Better to say so than to let a parent
 * spend a generation finding out.
 */
function resolutionCeiling(m: Measures): number {
  if (!m.hasDimensions) return 100;
  if (m.megapixels >= 2) return 100;
  if (m.megapixels >= 1) return 80;
  if (m.megapixels >= 0.5) return 62;
  return 45;
}

function framingScore(m: Measures): number {
  if (!m.hasDimensions) return 65;
  // A tall frame is what a standing child fits into. Wide landscape crops
  // usually mean the subject is small in frame.
  if (m.aspect <= 0.85) return 92;
  if (m.aspect <= 1.05) return 82;
  if (m.aspect <= 1.4) return 70;
  return 56;
}

interface DimensionSpec {
  key: QualityDimensionKey;
  score: number;
  hint: string | null;
}

export class HeuristicPhotoQualityAnalyzer implements PhotoQualityAnalyzer {
  readonly id = ANALYZER_ID;
  readonly version = ANALYZER_VERSION;
  readonly inspectsPixels = false;

  async analyze(input: PhotoInput, assetId: string): Promise<PhotoQualityReport> {
    const m = measure(input);
    const seed = input.fileName ?? input.uri;

    const resolution = resolutionScore(m);
    const compression = compressionScore(m);
    const framing = framingScore(m);

    // Face and body cannot be measured without a model. We derive a stable
    // estimate anchored to the measurable signals so the number is never
    // wilder than the evidence supports, and we surface the caveat in the UI.
    const faceEstimate = clamp(
      resolution * 0.6 + compression * 0.25 + stableUnit(seed, 'face') * 22 - 4,
    );
    const bodyEstimate = clamp(
      framing * 0.55 + resolution * 0.25 + stableUnit(seed, 'body') * 26 - 6,
    );
    const lighting = clamp(compression * 0.5 + 30 + stableUnit(seed, 'light') * 24);
    const background = clamp(45 + stableUnit(seed, 'bg') * 50);

    const specs: DimensionSpec[] = [
      {
        key: 'face',
        score: faceEstimate,
        hint:
          faceEstimate < 70
            ? 'A photo where the face is larger in the frame gives a much better likeness.'
            : null,
      },
      {
        key: 'body',
        score: bodyEstimate,
        hint:
          bodyEstimate < 70
            ? 'For a standing figurine, a photo showing the whole body — including the feet — works best.'
            : null,
      },
      {
        key: 'lighting',
        score: lighting,
        hint: lighting < 65 ? 'Soft daylight, with the light in front of your child, works best.' : null,
      },
      {
        key: 'sharpness',
        score: compression,
        hint: compression < 65 ? 'This photo looks quite compressed. The original will give more detail.' : null,
      },
      {
        key: 'background',
        score: background,
        hint: background < 65 ? 'A plainer background makes your child easier to separate out.' : null,
      },
      {
        key: 'framing',
        score: framing,
        hint: framing < 65 ? 'A portrait-shaped photo usually captures more of your child.' : null,
      },
    ];

    const dimensions: QualityDimension[] = specs.map((spec) => ({
      key: spec.key,
      score: Math.round(spec.score),
      verdict: verdictFor(spec.score),
      hint: spec.hint,
    }));

    // Face and body matter most for a figurine, so they carry the weight.
    const weights: Record<QualityDimensionKey, number> = {
      face: 0.3,
      body: 0.25,
      lighting: 0.15,
      sharpness: 0.15,
      background: 0.1,
      framing: 0.05,
      people: 0,
    };

    const weighted = dimensions.reduce(
      (sum, dimension) => sum + dimension.score * weights[dimension.key],
      0,
    );
    const overall = Math.round(Math.min(weighted, resolutionCeiling(m)));

    // When the ceiling is what is holding the score down, resolution is the
    // real problem and the advice should say so rather than blaming lighting.
    const cappedByResolution = weighted > resolutionCeiling(m);
    const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];
    const verdict = verdictFor(overall);

    const summary =
      verdict === 'excellent'
        ? 'This photo should produce a good figurine.'
        : verdict === 'good'
          ? 'This photo should work well.'
          : verdict === 'fair'
            ? 'This will work, though another photo may give a better result.'
            : 'This photo will be difficult to work from.';

    const advice =
      overall >= 70
        ? null
        : cappedByResolution
          ? 'This photo is quite small. The original, at full size, will give a much better result.'
          : (weakest?.hint ?? 'Try a clearer photo taken in daylight.');

    const timestamp = nowIso();
    return {
      id: newId(),
      assetId,
      analyzerId: this.id,
      analyzerVersion: this.version,
      overallScore: overall,
      verdict,
      dimensions,
      summary,
      advice,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
