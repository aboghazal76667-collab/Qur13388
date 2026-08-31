/**
 * SINGLE SOURCE OF BRAND TRUTH.
 *
 * The commercial brand name is not final. Every user-visible occurrence of the
 * product name, tagline, legal entity and support contact must come from here
 * so a rename is a one-file change. Never hardcode the brand anywhere else.
 */
export const BRAND = {
  /** Internal codename. Replace with the commercial brand when decided. */
  codename: 'OMANI DISHDASHA AI',
  name: { ar: 'دشداشة', en: 'Dishdasha' },
  nameSuffix: { ar: 'الذكية', en: 'AI' },
  tagline: {
    ar: 'خياطة عُمانية أصيلة، بذكاء رقمي',
    en: 'Authentic Omani tailoring, digitally intelligent',
  },
  legalEntity: 'TBD — Company registration pending',
  supportEmail: 'support@example.om',
  supportPhone: '+968 0000 0000',
  country: 'OM',
} as const;

export const fullBrandName = (lang: 'ar' | 'en') =>
  `${BRAND.name[lang]} ${BRAND.nameSuffix[lang]}`;
