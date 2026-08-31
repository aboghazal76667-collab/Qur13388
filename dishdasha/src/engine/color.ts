/**
 * Colour primitives.
 *
 * Colours are stored as HEX plus metadata everywhere in the domain; HSL is a
 * derived working space used by the harmony engine only. Nothing here talks to
 * an LLM — it is deterministic, cheap and testable.
 */
export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const normalizeHex = (hex: string): string => {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#000000';
  return '#' + h.toUpperCase();
};

export const hexToRgb = (hex: string): RGB => {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

export const rgbToHex = ({ r, g, b }: RGB): string =>
  '#' +
  [r, g, b]
    .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

export const rgbToHsl = ({ r, g, b }: RGB): HSL => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const hslToRgb = ({ h, s, l }: HSL): RGB => {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = ln - c / 2;
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
};

export const hexToHsl = (hex: string): HSL => rgbToHsl(hexToRgb(hex));
export const hslToHex = (hsl: HSL): string => rgbToHex(hslToRgb(hsl));

/** WCAG relative luminance. */
export const luminance = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio, 1..21. Used to keep embroidery legible on fabric. */
export const contrastRatio = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

export const isLight = (hex: string): boolean => luminance(hex) > 0.45;

/** Readable ink for a swatch label. */
export const readableInk = (hex: string): string => (isLight(hex) ? '#16130F' : '#FFFFFF');

export const mix = (a: string, b: string, weight: number): string => {
  const w = clamp(weight, 0, 1);
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * w,
    g: ca.g + (cb.g - ca.g) * w,
    b: ca.b + (cb.b - ca.b) * w,
  });
};

export const lighten = (hex: string, amount: number): string => {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(hsl.l + amount, 0, 100) });
};

export const darken = (hex: string, amount: number): string => lighten(hex, -amount);

export const withAlpha = (hex: string, alpha: number): string => {
  const a = clamp(Math.round(alpha * 255), 0, 255).toString(16).padStart(2, '0');
  return normalizeHex(hex) + a.toUpperCase();
};

/** Hue distance on the colour wheel, 0..180. */
export const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(((a % 360) + 360) % 360 - (((b % 360) + 360) % 360));
  return d > 180 ? 360 - d : d;
};

/**
 * Chroma (max channel − min channel), 0..100.
 *
 * Used instead of HSL saturation to judge neutrality: HSL reports a near-white
 * off-white like #F2EDE3 at ~37% saturation, which would classify the single
 * most common dishdasha colour in Oman as a strong hue. Chroma reports it at
 * ~6%, which matches what the eye sees.
 */
export const chroma = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex);
  return ((Math.max(r, g, b) - Math.min(r, g, b)) / 255) * 100;
};

export const isNeutral = (hex: string): boolean => chroma(hex) <= 12;

export const warmth = (hex: string): 'warm' | 'cool' | 'neutral' => {
  const { h } = hexToHsl(hex);
  if (isNeutral(hex)) return 'neutral';
  if (h < 60 || h >= 320) return 'warm';
  if (h >= 60 && h < 150) return 'neutral';
  return 'cool';
};
