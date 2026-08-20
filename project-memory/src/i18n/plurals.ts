import { format } from './format';

/**
 * Plural selection.
 *
 * English needs two forms; Arabic needs four — singular, dual, a small plural
 * for 3–10, and a different one from 11 up. Getting this wrong is the kind of
 * mistake that makes a product feel translated rather than written, so the
 * rule lives here rather than being approximated at each call site.
 *
 * The catalogue supplies all four forms in both languages; English simply
 * repeats itself where it has no distinction.
 */
export interface PluralForms {
  one: string;
  two: string;
  few: string;
  many: string;
}

export function selectPlural(count: number, forms: PluralForms): string {
  const n = Math.abs(Math.round(count));
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return forms.few;
  return forms.many;
}

/** Selects the right form and fills in `{count}`. */
export function pluralise(
  count: number,
  forms: PluralForms,
  formatNumber: (value: number) => string,
): string {
  return format(selectPlural(count, forms), { count: formatNumber(Math.round(count)) });
}
