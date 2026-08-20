/**
 * Placeholder interpolation.
 *
 * Deliberately tiny, and kept free of React Native imports so it can be used
 * and tested anywhere. The alternative is a full ICU runtime, which is a lot of
 * bundle weight for the handful of substitutions this product has.
 */
export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
