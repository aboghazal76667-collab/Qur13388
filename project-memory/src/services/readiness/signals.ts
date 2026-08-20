/**
 * Real measurements taken from real pixels.
 *
 * Every function here reads an actual decoded image. Nothing infers quality
 * from a file name, a byte count or an aspect ratio — that was the previous
 * approach and it was wrong: it let the app report "Face: Excellent" about an
 * image nothing had looked at.
 *
 * Kept free of any React Native import so it can be tested in plain Node
 * against generated images with known properties, which is the only way to
 * show the numbers mean what they claim.
 *
 * What is measured here is optical, not semantic: how sharp, how well exposed,
 * how busy the background, how much of the frame the subject probably occupies.
 * Whether the image contains a *child* is a question no code in this file can
 * answer, and none of it pretends to.
 */

/** Decoded image: 8-bit RGBA, row-major. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface PhotoSignals {
  width: number;
  height: number;
  megapixels: number;

  /** Laplacian variance, normalised to 0–1. Higher is sharper. */
  sharpness: number;
  /** Mean luma, 0–255. */
  brightness: number;
  /** Fraction of pixels crushed to black. */
  clippedShadows: number;
  /** Fraction of pixels blown to white. */
  clippedHighlights: number;
  /** Luma standard deviation, normalised to 0–1. */
  contrast: number;
  /**
   * Edge energy in the central region relative to the whole frame. High values
   * mean detail is concentrated where a subject usually is; low values mean the
   * frame is mostly context. A proxy for subject size, not a detector.
   */
  subjectProminence: number;
  /** Edge density around the frame border. High means a busy background. */
  backgroundBusyness: number;
  /** Largest deviation between channel means, 0–1. Detects colour casts. */
  colourCast: number;
  /** 64-bit difference hash, hex. Near-identical photos share it. */
  dHash: string;
  /** Coarse 4×4×4 RGB histogram, normalised. Used to compare two photos. */
  histogram: number[];
}

function luma(data: Bitmap['data'], index: number): number {
  return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
}

/** Luma plane, so the neighbourhood operators below stay readable. */
function lumaPlane(bitmap: Bitmap): Float32Array {
  const { width, height, data } = bitmap;
  const plane = new Float32Array(width * height);
  for (let i = 0, p = 0; p < plane.length; i += 4, p += 1) {
    plane[p] = luma(data, i);
  }
  return plane;
}

/**
 * Variance of the Laplacian — the standard blur measure.
 *
 * A sharp image has strong second derivatives at edges and therefore high
 * variance; a blurred one has almost none. Normalised against 2000, which sits
 * around the boundary between visibly soft and acceptably sharp for photos
 * downscaled to the size we analyse.
 */
export function sharpnessOf(bitmap: Bitmap): number {
  const { width, height } = bitmap;
  if (width < 3 || height < 3) return 0;

  const plane = lumaPlane(bitmap);
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      const value =
        -4 * plane[p] + plane[p - 1] + plane[p + 1] + plane[p - width] + plane[p + width];
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, Math.min(1, variance / 2000));
}

export interface ExposureSignals {
  brightness: number;
  clippedShadows: number;
  clippedHighlights: number;
  contrast: number;
}

export function exposureOf(bitmap: Bitmap): ExposureSignals {
  const plane = lumaPlane(bitmap);
  let sum = 0;
  let shadows = 0;
  let highlights = 0;

  for (let i = 0; i < plane.length; i += 1) {
    const value = plane[i];
    sum += value;
    if (value <= 8) shadows += 1;
    if (value >= 247) highlights += 1;
  }

  const mean = sum / plane.length;
  let variance = 0;
  for (let i = 0; i < plane.length; i += 1) variance += (plane[i] - mean) ** 2;
  variance /= plane.length;

  return {
    brightness: mean,
    clippedShadows: shadows / plane.length,
    clippedHighlights: highlights / plane.length,
    // 64 is roughly the standard deviation of a well-spread photograph.
    contrast: Math.max(0, Math.min(1, Math.sqrt(variance) / 64)),
  };
}

/** Mean absolute gradient over a rectangle — how much detail lives there. */
function edgeEnergy(
  plane: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let total = 0;
  let count = 0;
  for (let y = Math.max(1, y0); y < Math.min(height - 1, y1); y += 1) {
    for (let x = Math.max(1, x0); x < Math.min(width - 1, x1); x += 1) {
      const p = y * width + x;
      const gx = plane[p + 1] - plane[p - 1];
      const gy = plane[p + width] - plane[p - width];
      total += Math.abs(gx) + Math.abs(gy);
      count += 1;
    }
  }
  return count === 0 ? 0 : total / count;
}

/**
 * How concentrated detail is in the middle of the frame.
 *
 * A portrait filling the frame puts most of its structure centrally against a
 * comparatively plain surround. A child standing far away in a busy room does
 * the opposite. This is a proxy for "is the subject big enough to reconstruct
 * from" — it is not, and must never be described as, subject detection.
 */
export function subjectProminenceOf(bitmap: Bitmap): { prominence: number; backgroundBusyness: number } {
  const { width, height } = bitmap;
  if (width < 8 || height < 8) return { prominence: 0.5, backgroundBusyness: 0.5 };

  const plane = lumaPlane(bitmap);
  const cx0 = Math.floor(width * 0.25);
  const cx1 = Math.ceil(width * 0.75);
  const cy0 = Math.floor(height * 0.2);
  const cy1 = Math.ceil(height * 0.85);

  const centre = edgeEnergy(plane, width, height, cx0, cy0, cx1, cy1);
  const whole = edgeEnergy(plane, width, height, 0, 0, width, height);

  // Border strips, sampled separately so a busy backdrop is visible even when
  // the centre is also detailed.
  const border =
    (edgeEnergy(plane, width, height, 0, 0, width, Math.floor(height * 0.15)) +
      edgeEnergy(plane, width, height, 0, Math.ceil(height * 0.85), width, height) +
      edgeEnergy(plane, width, height, 0, 0, Math.floor(width * 0.15), height) +
      edgeEnergy(plane, width, height, Math.ceil(width * 0.85), 0, width, height)) /
    4;

  const prominence = whole <= 0.0001 ? 0 : Math.max(0, Math.min(1, centre / (whole * 1.6)));
  return {
    prominence,
    // 24 is roughly the mean gradient of a visually busy background.
    backgroundBusyness: Math.max(0, Math.min(1, border / 24)),
  };
}

export function colourCastOf(bitmap: Bitmap): number {
  const { data } = bitmap;
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r /= pixels;
  g /= pixels;
  b /= pixels;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return Math.max(0, Math.min(1, spread / 96));
}

/**
 * Difference hash.
 *
 * Downsamples to 9×8 luma and records whether each pixel is brighter than its
 * right-hand neighbour. Two photographs of the same moment produce hashes a
 * few bits apart; unrelated ones are far apart. This is what lets the app spot
 * a parent adding the same picture twice.
 */
export function dHashOf(bitmap: Bitmap): string {
  const size = 8;
  const plane = lumaPlane(bitmap);
  const { width, height } = bitmap;

  const sample = (gx: number, gy: number): number => {
    const x = Math.min(width - 1, Math.floor(((gx + 0.5) / (size + 1)) * width));
    const y = Math.min(height - 1, Math.floor(((gy + 0.5) / size) * height));
    return plane[y * width + x];
  };

  let bits = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      bits += sample(x, y) > sample(x + 1, y) ? '1' : '0';
    }
  }

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Bits that differ between two hashes. 0 means visually identical. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    let diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}

/** Coarse 4×4×4 RGB histogram, normalised so photos of any size compare. */
export function histogramOf(bitmap: Bitmap): number[] {
  const bins = new Array(64).fill(0);
  const { data } = bitmap;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] >> 6;
    const g = data[i + 1] >> 6;
    const b = data[i + 2] >> 6;
    bins[r * 16 + g * 4 + b] += 1;
  }
  const total = data.length / 4;
  return bins.map((count) => count / total);
}

/** 0 (identical) to 1 (nothing in common). */
export function histogramDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return Math.min(1, sum / 2);
}

/** Every measurement, in one pass over the decoded image. */
export function measure(bitmap: Bitmap): PhotoSignals {
  const exposure = exposureOf(bitmap);
  const { prominence, backgroundBusyness } = subjectProminenceOf(bitmap);

  return {
    width: bitmap.width,
    height: bitmap.height,
    megapixels: (bitmap.width * bitmap.height) / 1_000_000,
    sharpness: sharpnessOf(bitmap),
    brightness: exposure.brightness,
    clippedShadows: exposure.clippedShadows,
    clippedHighlights: exposure.clippedHighlights,
    contrast: exposure.contrast,
    subjectProminence: prominence,
    backgroundBusyness,
    colourCast: colourCastOf(bitmap),
    dHash: dHashOf(bitmap),
    histogram: histogramOf(bitmap),
  };
}
