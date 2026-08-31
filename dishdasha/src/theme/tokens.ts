/**
 * Design tokens. Premium, calm, Omani — sand, ink, and a restrained
 * heritage green. Deliberately avoids the gold-gradient cliché: the luxury
 * cue is whitespace, typography and material, not decoration.
 */
export const palette = {
  sand50: '#FCFAF6',
  sand100: '#F6F1E9',
  sand200: '#EDE5D8',
  sand300: '#DED2BF',
  sand400: '#C4B49B',
  ink900: '#16130F',
  ink800: '#241F19',
  ink700: '#3A3229',
  ink500: '#6B6055',
  ink400: '#8C8175',
  ink300: '#B0A79B',
  green900: '#0E2A22',
  green700: '#174A3B',
  green500: '#2C6B57',
  green300: '#7BA898',
  green100: '#DCE9E3',
  clay600: '#8A4B32',
  clay400: '#B87A5C',
  white: '#FFFFFF',
  danger: '#9B2C2C',
  dangerBg: '#FBEAEA',
  warning: '#8A6100',
  warningBg: '#FCF3DC',
  success: '#1F6B45',
  successBg: '#E3F1E9',
  info: '#1F4E79',
  infoBg: '#E6EEF6',
} as const;

export const theme = {
  color: {
    bg: palette.sand100,
    bgElevated: palette.white,
    bgSunken: palette.sand200,
    surface: palette.white,
    border: palette.sand300,
    borderStrong: palette.sand400,
    text: palette.ink900,
    textMuted: palette.ink500,
    textFaint: palette.ink400,
    accent: palette.green700,
    accentSoft: palette.green100,
    accentText: palette.white,
    onDark: palette.sand100,
    dark: palette.green900,
    danger: palette.danger,
    dangerBg: palette.dangerBg,
    warning: palette.warning,
    warningBg: palette.warningBg,
    success: palette.success,
    successBg: palette.successBg,
    info: palette.info,
    infoBg: palette.infoBg,
  },
  radius: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  font: {
    display: 34,
    title: 24,
    heading: 19,
    body: 15,
    small: 13,
    tiny: 11,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  shadow: {
    card: {
      shadowColor: '#241F19',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    lifted: {
      shadowColor: '#241F19',
      shadowOpacity: 0.12,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
  },
  /** Minimum accessible touch target. */
  hit: 44,
} as const;

export type Theme = typeof theme;
