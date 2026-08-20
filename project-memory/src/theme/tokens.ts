/**
 * Project Memory — design tokens.
 *
 * The design language is warm, premium and quiet. Parents are the paying
 * customers, so the product should read as a keepsake, not as a toy and not
 * as a developer dashboard. Everything visual in the app resolves through
 * these tokens; no screen should hard-code a colour or a spacing value.
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  /** Page background — warm paper, never pure white. */
  background: string;
  /** Slightly recessed background for grouped sections. */
  backgroundAlt: string;
  /** Cards and sheets. */
  surface: string;
  /** Card resting on top of another card. */
  surfaceRaised: string;
  /** Hairlines and dividers. */
  border: string;
  borderStrong: string;

  /** Primary body text. */
  text: string;
  /** Secondary text — captions, helper copy. */
  textMuted: string;
  /** Tertiary text — timestamps, disabled. */
  textFaint: string;
  /** Text drawn on top of `primary`. */
  onPrimary: string;

  /** Warm clay — the brand action colour. */
  primary: string;
  primaryPressed: string;
  /** Tinted primary background for chips and soft buttons. */
  primarySoft: string;

  /** Soft gold — reserved for milestones and premium moments. */
  accent: string;
  accentSoft: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;

  /** Neutral scrim behind modals and over photography. */
  scrim: string;
  /** Placeholder fill while an image loads. */
  placeholder: string;
}

const lightPalette: Palette = {
  background: '#FAF6F1',
  backgroundAlt: '#F3EDE5',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFDFB',
  border: '#E8DFD4',
  borderStrong: '#D6C8B8',

  text: '#241D18',
  textMuted: '#6F6258',
  textFaint: '#9C8E82',
  onPrimary: '#FFFFFF',

  primary: '#9C5B45',
  primaryPressed: '#844B38',
  primarySoft: '#F3E5DE',

  accent: '#B08D46',
  accentSoft: '#F6EEDC',

  success: '#4F7A5B',
  successSoft: '#E4EEE6',
  warning: '#A9762A',
  warningSoft: '#F7EBD8',
  danger: '#A4453C',
  dangerSoft: '#F6E2DF',

  scrim: 'rgba(36, 29, 24, 0.45)',
  placeholder: '#EDE4D9',
};

const darkPalette: Palette = {
  background: '#17120F',
  backgroundAlt: '#1F1915',
  surface: '#231C18',
  surfaceRaised: '#2B231E',
  border: '#3A3029',
  borderStrong: '#4C4038',

  text: '#F4EDE6',
  textMuted: '#B7A99C',
  textFaint: '#8A7C70',
  onPrimary: '#FFFFFF',

  primary: '#C2765B',
  primaryPressed: '#A9634B',
  primarySoft: '#3A2A23',

  accent: '#CDA96A',
  accentSoft: '#392F1F',

  success: '#7BA987',
  successSoft: '#25322A',
  warning: '#D2A45C',
  warningSoft: '#352A1B',
  danger: '#D3776C',
  dangerSoft: '#3A2320',

  scrim: 'rgba(0, 0, 0, 0.6)',
  placeholder: '#2E2621',
};

export const palettes: Record<ColorScheme, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** 4pt rhythm. Screens breathe — generous spacing is part of the brand. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

/**
 * Type scale. `display` is used sparingly — onboarding and empty states —
 * because large warm serif-weight type is what makes the product feel like a
 * keepsake rather than an app.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 26, lineHeight: 33, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  subheading: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0 },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '600' as const, letterSpacing: 0.3 },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const, letterSpacing: 0.6 },
} as const;

export type TypographyToken = keyof typeof typography;

/**
 * Minimum hit target. Accessibility guidelines put this at 44pt; we never go
 * below it for anything interactive.
 */
export const minTouchTarget = 48;

export const elevation = {
  none: {},
  card: {
    shadowColor: '#2A1D14',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#2A1D14',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  /** Emotional beats (onboarding fades, generation stages) run slower. */
  storytelling: 700,
} as const;
