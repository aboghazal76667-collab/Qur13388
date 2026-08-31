/**
 * SUPABASE ADAPTER — wired but not enabled by default.
 *
 * The client is loaded through a runtime require rather than a static import,
 * so `@supabase/supabase-js` stays an OPTIONAL dependency. That is deliberate:
 * the promise of this build is that it runs in Expo Go with no credentials and
 * no extra native/polyfill setup, and a hard import would drag the SDK (and
 * its URL/stream shims) into every bundle whether or not anyone configured a
 * project.
 *
 * To enable:
 *   1. npm install @supabase/supabase-js react-native-url-polyfill
 *   2. set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   3. apply supabase/migrations/*.sql
 *
 * The anon key is publishable by design; every table is protected by the RLS
 * policies in 0002_rls.sql. Service-role keys must never appear in this app.
 *
 * STATUS: compiles and typechecks; NOT yet verified against a live project.
 */
import { ENV, hasSupabaseCredentials } from '@dd/config/env';

/** The narrow surface this app actually uses, typed locally so the optional
 *  dependency's types are not required at build time. */
type QueryResult<T> = { data: T | null; error: { message: string } | null };

export type SupabaseLike = {
  from(table: string): {
    select(columns?: string): {
      eq(column: string, value: unknown): Promise<QueryResult<unknown[]>>;
      is(column: string, value: unknown): Promise<QueryResult<unknown[]>>;
      then?: unknown;
    };
    insert(rows: unknown): Promise<QueryResult<unknown[]>>;
    update(values: unknown): { eq(column: string, value: unknown): Promise<QueryResult<unknown[]>> };
  };
  auth: {
    getSession(): Promise<QueryResult<unknown>>;
    signInWithOtp(credentials: { phone?: string; email?: string }): Promise<QueryResult<unknown>>;
    signOut(): Promise<{ error: { message: string } | null }>;
  };
};

let client: SupabaseLike | null = null;
let loadAttempted = false;

export const getSupabase = (): SupabaseLike | null => {
  if (!hasSupabaseCredentials()) return null;
  if (client || loadAttempted) return client;
  loadAttempted = true;
  try {
    // Runtime require: absent dependency degrades to local mode instead of a
    // bundling failure.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@supabase/supabase-js') as {
      createClient: (url: string, key: string, options?: unknown) => SupabaseLike;
    };
    client = mod.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  } catch {
    client = null;
  }
  return client;
};

export const supabaseAvailable = (): boolean => getSupabase() !== null;

/**
 * Why there is no `markOrderPaid` here: payment status is written by the
 * server after it verifies the gateway's webhook signature. Exposing it to the
 * client would let a tampered app mark any order paid, which is why the RLS
 * policies grant no client INSERT or UPDATE on `payments` at all.
 */
export const PRIVILEGED_OPERATIONS = [
  'payments.insert',
  'payments.update',
  'orders.status (server-confirmed transitions)',
  'catalogue writes for platform-owned rows',
] as const;
