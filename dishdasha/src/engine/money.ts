import { ACTIVE_MARKET, type MarketConfig } from '@dd/config/market';

/**
 * OMR is a 3-decimal currency (1 rial = 1000 baisa). Floating point on
 * fractions of a baisa produces the classic 0.1+0.2 problem, so every amount
 * is normalised to integer minor units before arithmetic and rounded once.
 */
export const minorUnits = (amount: number, market: MarketConfig = ACTIVE_MARKET): number =>
  Math.round(amount * Math.pow(10, market.currencyDecimals));

export const fromMinorUnits = (units: number, market: MarketConfig = ACTIVE_MARKET): number =>
  units / Math.pow(10, market.currencyDecimals);

/** Rounds a raw number to the currency's precision. */
export const roundMoney = (amount: number, market: MarketConfig = ACTIVE_MARKET): number =>
  fromMinorUnits(minorUnits(amount, market), market);

export const addMoney = (
  values: number[],
  market: MarketConfig = ACTIVE_MARKET,
): number =>
  fromMinorUnits(
    values.reduce((sum, v) => sum + minorUnits(v, market), 0),
    market,
  );

export const multiplyMoney = (
  amount: number,
  factor: number,
  market: MarketConfig = ACTIVE_MARKET,
): number => fromMinorUnits(Math.round(minorUnits(amount, market) * factor), market);

/** Formats for display, e.g. "12.500 ر.ع". Arabic keeps western digits, which
 *  is what Omani price tags use. */
export const formatMoney = (
  amount: number,
  lang: 'ar' | 'en' = 'ar',
  market: MarketConfig = ACTIVE_MARKET,
): string => {
  const fixed = roundMoney(amount, market).toFixed(market.currencyDecimals);
  const symbol = market.currencySymbol[lang];
  return lang === 'ar' ? `${fixed} ${symbol}` : `${symbol} ${fixed}`;
};
