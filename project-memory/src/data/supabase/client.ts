import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client.
 *
 * The anon key is a public value by design — every table is protected by
 * row-level security, so possessing the key grants nothing on its own. Service
 * keys and provider API keys never appear in this bundle; they live on the
 * server described in AI_PROVIDERS.md.
 */
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar for Supabase to parse a session out of.
      detectSessionInUrl: false,
    },
  });
}

/** Private bucket. There is no public bucket in this product, deliberately. */
export const PRIVATE_BUCKET = 'family-media';

/** How long a minted media URL stays valid. Short, because these are photos of children. */
export const SIGNED_URL_TTL_SECONDS = 60 * 30;
