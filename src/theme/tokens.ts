/**
 * Design tokens.
 *
 * Calm, low-chroma palette built for long reading sessions in Arabic. Both
 * themes are defined in full — neither is derived from the other — so contrast
 * is controlled rather than inherited.
 */

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  quran: string;
  quranHighlight: string;
  /** Evidence-directness tones, A → E. */
  strong: string;
  good: string;
  neutral: string;
  caution: string;
  external: string;
  danger: string;
  overlay: string;
}

export const lightPalette: Palette = {
  background: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EEE7',
  border: '#E3DED3',
  borderStrong: '#CFC7B7',
  text: '#1C201D',
  textMuted: '#5C635C',
  textFaint: '#8B918A',
  accent: '#2F6B52',
  accentSoft: '#E4EFE8',
  accentText: '#FFFFFF',
  quran: '#14261D',
  quranHighlight: '#D9E9DF',
  strong: '#2F6B52',
  good: '#4C7C5B',
  neutral: '#8A7C4E',
  caution: '#A66A2E',
  external: '#96534A',
  danger: '#9B3B32',
  overlay: 'rgba(20,26,22,0.35)',
};

export const darkPalette: Palette = {
  background: '#0F1512',
  surface: '#161D19',
  surfaceAlt: '#1D2622',
  border: '#28322C',
  borderStrong: '#3A463F',
  text: '#EDEFEA',
  textMuted: '#A3ADA5',
  textFaint: '#727C74',
  accent: '#79C79B',
  accentSoft: '#1E2E26',
  accentText: '#0F1512',
  quran: '#F2F5EF',
  quranHighlight: '#26382E',
  strong: '#79C79B',
  good: '#8FBF9C',
  neutral: '#C7B47A',
  caution: '#D79A62',
  external: '#D68C82',
  danger: '#E0736A',
  overlay: 'rgba(0,0,0,0.55)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const typography = {
  /**
   * System Arabic faces. Deliberately not a bundled font: the platform Arabic
   * stack (SF Arabic on iOS, Noto Naskh on Android) renders Quranic diacritics
   * correctly and carries no licensing question.
   */
  quran: 34,
  quranLineHeight: 2.05,
  title: 22,
  heading: 18,
  body: 16,
  bodyLineHeight: 1.85,
  small: 14,
  tiny: 12,
} as const;
