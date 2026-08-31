/**
 * Runtime configuration and development modes.
 *
 * The whole application must be usable with zero credentials. Each MOCK/DEMO
 * flag defaults to ON; turning one off swaps in the corresponding production
 * adapter (see src/services/*). Values come from EXPO_PUBLIC_* env vars, which
 * Metro inlines at build time — never place secret keys here, only public
 * anon-level configuration. Secrets belong on the server.
 */
const flag = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
};

export const ENV = {
  /** Loads the seeded demo world and the "try the app" instant login. */
  DEMO_MODE: flag(process.env.EXPO_PUBLIC_DEMO_MODE, true),
  /** AI services return deterministic simulated results, no API calls. */
  MOCK_AI_MODE: flag(process.env.EXPO_PUBLIC_MOCK_AI_MODE, true),
  /** Checkout uses the simulated payment provider with success/failure buttons. */
  MOCK_PAYMENT_MODE: flag(process.env.EXPO_PUBLIC_MOCK_PAYMENT_MODE, true),
  /** Shows the DEV role switcher (customer / tailor / admin) inside the app. */
  SHOW_ROLE_SWITCHER: flag(process.env.EXPO_PUBLIC_ROLE_SWITCHER, true),

  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** Our own backend (Edge Functions / Node) — holds every secret key. */
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
} as const;

export const hasSupabaseCredentials = () =>
  ENV.SUPABASE_URL.length > 0 && ENV.SUPABASE_ANON_KEY.length > 0;

/** True when nothing external is reachable and we run entirely on seed data. */
export const isFullyLocal = () => ENV.DEMO_MODE && !hasSupabaseCredentials();
