import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

import { log } from '@/lib/log';

import { measure, type Bitmap } from './signals';
import { pixelAnalyzerCapabilities } from './types';
import type { AnalysedPhoto, ReadinessAnalyzer, ViewRole } from './types';

/**
 * The on-device pixel analyser.
 *
 * It genuinely decodes the image and measures it. That is the whole point of
 * this class existing: the system it replaces inferred "quality" from file
 * size and aspect ratio and then reported the result as though something had
 * looked at the photograph.
 *
 * What it does not do is just as important, and is declared rather than
 * implied. It cannot see a person, a face, a body or a viewing angle. Those
 * need a vision model, which belongs on the server — see `capabilities` below
 * and PART 9 of AI_PROVIDERS.md.
 */

/**
 * Analysis runs on a downscaled copy.
 *
 * 160px is enough for every statistic measured here — blur, exposure, framing
 * and hashing are all scale-tolerant — and keeps a 12-megapixel phone photo
 * from costing seconds of main-thread work on an older device.
 */
const ANALYSIS_WIDTH = 160;

function toBitmap(decoded: { width: number; height: number; data: Uint8Array }): Bitmap {
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

function base64ToBytes(base64: string): Uint8Array {
  // `atob` exists in Hermes and on web. The manual fallback keeps the analyser
  // working in the Node test harness, where it does not.
  const globalAtob = (globalThis as { atob?: (input: string) => string }).atob;
  if (globalAtob) {
    const binary = globalAtob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byte = 0;
  let bits = 0;
  let out = 0;
  for (const character of clean) {
    byte = (byte << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out] = (byte >> bits) & 0xff;
      out += 1;
    }
  }
  return bytes.subarray(0, out);
}

export class PixelReadinessAnalyzer implements ReadinessAnalyzer {
  readonly id = 'on-device-pixels';
  readonly version = '1.0.0';
  readonly capabilities = pixelAnalyzerCapabilities;

  async analyze(uri: string, photoId: string, role: ViewRole): Promise<AnalysedPhoto> {
    // Resize to a JPEG we can decode. The manipulator handles HEIC, PNG and
    // orientation, which a raw decoder would not.
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: ANALYSIS_WIDTH } }],
      { base64: true, compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
    );

    if (!resized.base64) throw new Error('image manipulator returned no data');

    const decoded = jpeg.decode(base64ToBytes(resized.base64), { useTArray: true });
    const signals = measure(toBitmap(decoded));

    // The downscale loses the true resolution, which is one of the things we
    // most need to know, so it is taken from the manipulator's own report of
    // the original rather than from the analysis copy.
    const original = await this.originalDimensions(uri, resized.width, resized.height);
    const corrected = {
      ...signals,
      width: original.width,
      height: original.height,
      megapixels: (original.width * original.height) / 1_000_000,
    };

    log.debug('photo analysed', {
      photoId,
      megapixels: corrected.megapixels.toFixed(2),
      sharpness: corrected.sharpness.toFixed(3),
    });

    return { photoId, role, signals: corrected };
  }

  /**
   * True pixel dimensions of the source.
   *
   * A no-op manipulation is the cheapest way to ask the platform, and it
   * avoids trusting a picker that sometimes reports nothing.
   */
  private async originalDimensions(
    uri: string,
    fallbackWidth: number,
    fallbackHeight: number,
  ): Promise<{ width: number; height: number }> {
    try {
      const probe = await ImageManipulator.manipulateAsync(uri, [], { compress: 1 });
      if (probe.width > 0 && probe.height > 0) {
        return { width: probe.width, height: probe.height };
      }
    } catch (error) {
      log.warn('could not read original dimensions', { error: String(error) });
    }
    return { width: fallbackWidth, height: fallbackHeight };
  }
}
