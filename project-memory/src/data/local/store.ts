import AsyncStorage from '@react-native-async-storage/async-storage';

import { log } from '@/lib/log';
import type {
  Asset,
  AuditEvent,
  CapsuleMessage,
  Child,
  ChildTrait,
  Family,
  FamilyMember,
  Memory,
  PhotoQualityReport,
  Profile,
  ProviderCall,
  QaReview,
  ThreeDJob,
  ThreeDModel,
} from '@/domain';

/**
 * The device-local database.
 *
 * A single JSON document in AsyncStorage, shaped exactly like the SQL schema
 * so that the two backends stay conceptually identical. This is what lets the
 * founder run the whole product before creating a Supabase project — and it is
 * the offline story too: everything a parent adds is on their phone first.
 */

export const STORAGE_KEY = 'project-memory:db:v1';

export interface Database {
  version: 1;
  profiles: Profile[];
  families: Family[];
  familyMembers: FamilyMember[];
  children: Child[];
  childTraits: ChildTrait[];
  memories: Memory[];
  assets: Asset[];
  qualityReports: PhotoQualityReport[];
  jobs: ThreeDJob[];
  models: ThreeDModel[];
  providerCalls: ProviderCall[];
  qaReviews: QaReview[];
  capsuleMessages: CapsuleMessage[];
  auditEvents: AuditEvent[];
  /** Credentials never leave the device in local mode. Hashed, not stored raw. */
  credentials: { profileId: string; email: string; passwordHash: string }[];
  session: { profileId: string; familyId: string } | null;
  seededDemo: boolean;
}

export function emptyDatabase(): Database {
  return {
    version: 1,
    profiles: [],
    families: [],
    familyMembers: [],
    children: [],
    childTraits: [],
    memories: [],
    assets: [],
    qualityReports: [],
    jobs: [],
    models: [],
    providerCalls: [],
    qaReviews: [],
    capsuleMessages: [],
    auditEvents: [],
    credentials: [],
    session: null,
    seededDemo: false,
  };
}

/**
 * Reads and writes are serialised through one promise chain. Two screens
 * saving at once would otherwise interleave read-modify-write cycles and lose
 * a memory — the one bug this product can least afford.
 */
let queue: Promise<unknown> = Promise.resolve();
let cache: Database | null = null;

async function readRaw(): Promise<Database> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = emptyDatabase();
      return cache;
    }
    const parsed = JSON.parse(raw) as Database;
    cache = { ...emptyDatabase(), ...parsed };
    return cache;
  } catch (error) {
    log.error('local store read failed, starting empty', { error: String(error) });
    cache = emptyDatabase();
    return cache;
  }
}

/**
 * True until a write to device storage fails.
 *
 * Some contexts refuse storage outright — a sandboxed browser frame, private
 * browsing, a full disk. The app keeps working from the in-memory cache, but a
 * parent must never be left believing a memory was saved when it was not, so
 * the failure is recorded and surfaced rather than swallowed.
 */
let persistenceHealthy = true;

export function isPersistenceHealthy(): boolean {
  return persistenceHealthy;
}

async function writeRaw(db: Database): Promise<void> {
  // The cache is updated first and unconditionally: losing the write to disk
  // is recoverable, losing it from the session as well is not.
  cache = db;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    persistenceHealthy = true;
  } catch (error) {
    persistenceHealthy = false;
    log.error('device storage write failed — data is session-only', { error: String(error) });
  }
}

/** Runs `mutator` against the database and persists the result atomically. */
export function transact<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const db = await readRaw();
    // Shallow clone so a throwing mutator cannot leave a half-applied cache.
    const draft: Database = { ...db };
    const result = await mutator(draft);
    await writeRaw(draft);
    return result;
  });
  queue = next.catch(() => undefined);
  return next;
}

/** Read-only access; does not take the write lock. */
export async function read<T>(selector: (db: Database) => T): Promise<T> {
  const db = await readRaw();
  return selector(db);
}
