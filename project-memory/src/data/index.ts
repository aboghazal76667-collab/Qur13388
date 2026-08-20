import { env } from '@/lib/env';
import { log } from '@/lib/log';

import type { MemoryBackend } from './backend';
import { LocalBackend } from './local/LocalBackend';
import { seedDemoDataIfEmpty } from './local/seed';
import { SupabaseBackend } from './supabase/SupabaseBackend';

export * from './backend';

/**
 * Backend selection.
 *
 * One line decides whether the app runs against the device or against
 * Supabase, and nothing above this file knows which. Adding a third backend
 * later means adding a case here — not touching a screen.
 */
let backend: MemoryBackend | null = null;

export function getBackend(): MemoryBackend {
  if (backend) return backend;
  backend =
    env.backendMode === 'supabase' && env.supabaseUrl && env.supabaseAnonKey
      ? new SupabaseBackend(env.supabaseUrl, env.supabaseAnonKey)
      : new LocalBackend();
  log.debug('backend selected', { key: backend.key });
  return backend;
}

/** Test seam: lets a test install a fake backend. */
export function setBackend(next: MemoryBackend | null): void {
  backend = next;
}

/** Runs once at startup. Only the local backend seeds demo content. */
export async function prepareBackend(): Promise<void> {
  const active = getBackend();
  if (active.key === 'local' && env.seedDemoData) {
    await seedDemoDataIfEmpty();
  }
}
