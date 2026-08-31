/**
 * UUID v4 generation without a native dependency.
 *
 * `crypto.randomUUID` exists on modern web and on Hermes with a polyfill, but
 * not reliably in Expo Go across platforms — so we fall back to Math.random.
 * These ids are identifiers, never secrets or tokens.
 */
const RNG = (): number => Math.floor(Math.random() * 256);

export const uuid = (): string => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') {
    try {
      return g.crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const bytes = Array.from({ length: 16 }, RNG);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
};

/** Short human-facing id, e.g. for order numbers. */
export const shortCode = (length = 6): string => {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};
