/**
 * Market configuration. Oman first; the shape is deliberately generic so a
 * second GCC market is a data addition, not a code change.
 */
export type CurrencyCode = 'OMR' | 'AED' | 'SAR' | 'KWD' | 'QAR' | 'BHD';

export type MarketConfig = {
  country: string;
  currency: CurrencyCode;
  /** OMR and KWD/BHD are 3-decimal currencies. */
  currencyDecimals: number;
  currencySymbol: { ar: string; en: string };
  defaultMeasurementUnit: 'cm' | 'in';
  defaultLanguage: 'ar' | 'en';
  /**
   * Tax is merchant/admin controlled — never assume a rate in code.
   * `null` means "no tax configured for this market yet".
   */
  taxRate: number | null;
  taxLabel: { ar: string; en: string };
  phoneCode: string;
};

export const MARKETS: Record<string, MarketConfig> = {
  OM: {
    country: 'OM',
    currency: 'OMR',
    currencyDecimals: 3,
    currencySymbol: { ar: 'ر.ع', en: 'OMR' },
    defaultMeasurementUnit: 'cm',
    defaultLanguage: 'ar',
    taxRate: null, // TBD — set by merchant configuration after legal review.
    taxLabel: { ar: 'ضريبة القيمة المضافة', en: 'VAT' },
    phoneCode: '+968',
  },
};

export const ACTIVE_MARKET: MarketConfig = MARKETS.OM;
