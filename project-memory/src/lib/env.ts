import Constants from 'expo-constants';

/**
 * Configuration, resolved once.
 *
 * Everything here comes from `EXPO_PUBLIC_*` variables, which means everything
 * here is public by definition. That is why the only credentials present are
 * the Supabase URL and anon key — values designed to sit in a client and be
 * constrained by row-level security. Provider API keys (Meshy, Tripo) live on
 * the server and never appear in this file or in the bundle.
 */

export type BackendMode = 'local' | 'supabase';

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = extra?.[key];
  return typeof fromExtra === 'string' && fromExtra.trim().length > 0 ? fromExtra.trim() : undefined;
}

const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

/**
 * Supabase is used when it is configured, and the device-local backend is used
 * when it is not. The app is fully functional either way — which is what lets
 * the founder run it before setting up any cloud account.
 */
export const backendMode: BackendMode = supabaseUrl && supabaseAnonKey ? 'supabase' : 'local';

export const env = {
  backendMode,
  supabaseUrl,
  supabaseAnonKey,
  /**
   * Our own backend (the AI router). When absent, 3D generation runs against
   * the in-app mock simulator so the whole flow still works end to end.
   */
  apiBaseUrl: readEnv('EXPO_PUBLIC_API_BASE_URL'),
  appVersion: (Constants.expoConfig?.version as string | undefined) ?? '0.0.0',
  /** Seeds the demo family on first launch of the local backend. */
  seedDemoData: readEnv('EXPO_PUBLIC_SEED_DEMO') !== 'false',
} as const;

export const isThreeDBackendConfigured = Boolean(env.apiBaseUrl);
