import { Platform } from 'react-native';

import { hexToHsl, normalizeHex, rgbToHex } from '@dd/engine/color';
import type {
  ColorExtractionService,
  ExtractedPalette,
  ProviderInfo,
} from './types';
import { withTelemetry } from './telemetry';

/**
 * KUMMA / MUSSAR COLOUR EXTRACTION.
 *
 * Two implementations behind one interface:
 *
 *  - Web: genuine extraction. The image is drawn to an offscreen canvas and
 *    quantised, so the colours really do come from the photo.
 *  - Native (Expo Go): no canvas and no pixel access without a native module,
 *    so this returns a deterministic simulated palette. It is flagged
 *    `isSimulated` and the UI labels it. We do not claim to have read the
 *    photo when we have not.
 *
 * Either way the image never leaves the device in this build.
 */

const quantise = (r: number, g: number, b: number): string =>
  rgbToHex({
    r: Math.round(r / 24) * 24,
    g: Math.round(g / 24) * 24,
    b: Math.round(b / 24) * 24,
  });

const rankByCoverage = (samples: string[]): string[] => {
  const counts = new Map<string, number>();
  for (const s of samples) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    // Near-white and near-black usually come from the background or shadow.
    .filter((hex) => {
      const { l, s } = hexToHsl(hex);
      return l > 8 && l < 96 && (s > 6 || (l > 25 && l < 80));
    });
};

const extractOnWeb = (imageUri: string): Promise<ExtractedPalette> =>
  new Promise((resolve, reject) => {
    const g = globalThis as unknown as {
      document?: Document;
      Image?: { new (): HTMLImageElement };
    };
    if (!g.document || !g.Image) {
      reject(new Error('canvas unavailable'));
      return;
    }
    const img = new g.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 48;
        const canvas = g.document!.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const samples: string[] = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          samples.push(quantise(data[i], data[i + 1], data[i + 2]));
        }
        const ranked = rankByCoverage(samples);
        if (ranked.length === 0) throw new Error('no usable colours');
        resolve({
          hexes: ranked.slice(0, 5),
          dominant: ranked[0],
          isSimulated: false,
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('extraction failed'));
      }
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = imageUri;
  });

/**
 * Deterministic stand-in for native. Derived from the URI so the same photo
 * always yields the same palette within a session, drawn from tones that
 * actually occur on Omani kummas rather than random RGB.
 */
const KUMMA_TONES = [
  ['#F4EFE3', '#2C4A3B', '#B08E62', '#6B4F3A', '#1E3A31'],
  ['#EDE5D8', '#22354C', '#C39B4A', '#8A5A3B', '#585A5C'],
  ['#E8E1D2', '#6B2F38', '#D9C7A7', '#4E2027', '#A9673F'],
  ['#F2EDE3', '#2A6D6B', '#BFC4C7', '#333F4C', '#787A4F'],
  ['#EFE6D2', '#523A5C', '#B7B3AC', '#2C5686', '#9C7A3C'],
];

const extractSimulated = (imageUri: string): ExtractedPalette => {
  let h = 0;
  for (let i = 0; i < imageUri.length; i++) h = (h * 31 + imageUri.charCodeAt(i)) >>> 0;
  const set = KUMMA_TONES[h % KUMMA_TONES.length].map(normalizeHex);
  const rotation = h % set.length;
  const rotated = [...set.slice(rotation), ...set.slice(0, rotation)];
  return { hexes: rotated, dominant: rotated[0], isSimulated: true };
};

export class LocalColorExtractionService implements ColorExtractionService {
  readonly info: ProviderInfo = {
    name: Platform.OS === 'web' ? 'canvas-extraction' : 'simulated-extraction',
    model: 'quantise-v1',
    isLive: Platform.OS === 'web',
  };

  async extract(imageUri: string): Promise<ExtractedPalette> {
    return withTelemetry(
      {
        kind: 'color_extraction',
        provider: this.info.name,
        model: this.info.model,
        // The photo URI is private; only its length is telemetry-safe.
        inputHash: `photo:${imageUri.length}`,
        estimatedCost: 0,
      },
      async () => {
        if (Platform.OS === 'web') {
          try {
            return await extractOnWeb(imageUri);
          } catch {
            // Fall through to the simulated palette rather than failing the flow.
            return extractSimulated(imageUri);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        return extractSimulated(imageUri);
      },
    );
  }
}
