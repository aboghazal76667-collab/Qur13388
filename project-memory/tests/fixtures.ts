/**
 * Synthetic images with known optical properties.
 *
 * The point of these is to prove the signal measurements actually respond to
 * what they claim to measure. A blurred image must score lower on sharpness
 * than the same image sharp; a dark image must read as dark. Nothing here uses
 * a real photograph — no child's picture belongs in a repository, and these
 * cases are more precise anyway because the ground truth is known exactly.
 */
import type { Bitmap } from '../src/services/readiness/signals';

export function blank(width: number, height: number, fill = 128): Bitmap {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill;
    data[i + 1] = fill;
    data[i + 2] = fill;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function setPixel(bitmap: Bitmap, x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return;
  const i = (y * bitmap.width + x) * 4;
  bitmap.data[i] = r;
  bitmap.data[i + 1] = g;
  bitmap.data[i + 2] = b;
  bitmap.data[i + 3] = 255;
}

/** Hard checkerboard: maximum high-frequency detail. */
export function sharpDetail(width = 64, height = 64, cell = 2): Bitmap {
  const bitmap = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const v = on ? 235 : 20;
      setPixel(bitmap, x, y, v, v, v);
    }
  }
  return bitmap;
}

/** Box blur, so "the same image but softer" is a real, controlled comparison. */
export function blur(source: Bitmap, radius = 2): Bitmap {
  const out = blank(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sx = Math.min(source.width - 1, Math.max(0, x + dx));
          const sy = Math.min(source.height - 1, Math.max(0, y + dy));
          const i = (sy * source.width + sx) * 4;
          r += source.data[i];
          g += source.data[i + 1];
          b += source.data[i + 2];
          n += 1;
        }
      }
      setPixel(out, x, y, r / n, g / n, b / n);
    }
  }
  return out;
}

/** A detailed blob centred in a plain frame — the "good portrait" shape. */
export function centredSubject(width = 64, height = 64, radiusFraction = 0.34): Bitmap {
  const bitmap = blank(width, height, 210);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * radiusFraction;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 < radius * radius) {
        const v = (x + y) % 3 === 0 ? 40 : 120;
        setPixel(bitmap, x, y, v, v, v);
      }
    }
  }
  return bitmap;
}

/** A small subject lost in a busy scene — the "too far away" shape. */
export function distantSubject(width = 64, height = 64): Bitmap {
  const bitmap = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = ((x * 7 + y * 13) % 5) * 50;
      setPixel(bitmap, x, y, v, v, v);
    }
  }
  const cx = width / 2;
  const cy = height / 2;
  for (let y = cy - 3; y < cy + 3; y += 1) {
    for (let x = cx - 3; x < cx + 3; x += 1) setPixel(bitmap, x, y, 255, 255, 255);
  }
  return bitmap;
}

export function uniform(width: number, height: number, level: number): Bitmap {
  return blank(width, height, level);
}

/** Strong colour cast, for the white-balance signal. */
export function tinted(width = 32, height = 32, r = 220, g = 90, b = 60): Bitmap {
  const bitmap = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) setPixel(bitmap, x, y, r, g, b);
  }
  return bitmap;
}

/** Shifts an image, producing a near-duplicate rather than an identical copy. */
export function shifted(source: Bitmap, dx: number, dy: number): Bitmap {
  const out = blank(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sx = Math.min(source.width - 1, Math.max(0, x - dx));
      const sy = Math.min(source.height - 1, Math.max(0, y - dy));
      const i = (sy * source.width + sx) * 4;
      setPixel(out, x, y, source.data[i], source.data[i + 1], source.data[i + 2]);
    }
  }
  return out;
}
