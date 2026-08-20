import type { PhotoSignals, ViewRole } from '@/services/readiness/types';

import type {
  Asset,
  AuditEvent,
  ChildTrait,
  LikenessAspect,
  LikenessFeedback,
  LikenessVerdict,
  CapsuleMessage,
  Child,
  Family,
  IsoDate,
  Memory,
  MemoryKind,
  Profile,
  ProviderCall,
  QaDecision,
  QaReview,
  ThreeDJob,
  ThreeDModel,
  TraitCategory,
  TraitSource,
  UUID,
} from '@/domain';

/**
 * The seam between the product and its storage.
 *
 * Every screen talks to this interface and nothing else. Two implementations
 * ship today — `LocalBackend` (device storage, works with no account setup)
 * and `SupabaseBackend` — and a third could be written without touching a
 * single component. This is what "Supabase is replaceable" means in practice.
 */

export interface AuthSession {
  profile: Profile;
  familyId: UUID;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  familyName: string;
  language: 'en' | 'ar';
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthGateway {
  getSession(): Promise<AuthSession | null>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'language' | 'allowsModelTraining'>>): Promise<Profile>;
  /** Removes the profile, the family and every asset it owns. */
  deleteAccount(): Promise<void>;
  /** Social sign-in is architected but not credentialed yet. */
  isSocialAvailable(provider: 'apple' | 'google'): boolean;
  signInWithProvider(provider: 'apple' | 'google'): Promise<AuthSession>;
}

export interface RecordTraitInput {
  childId: UUID;
  category: TraitCategory;
  value: string;
  customLabel?: string | null;
  note?: string | null;
  /** Defaults to `parent`; only a confirmed suggestion should pass anything else. */
  source?: TraitSource;
}

/**
 * Traits are an archive, not a settings screen.
 *
 * There is deliberately no `update(value)`: changing what a child loves means
 * closing one period and opening another, so the history survives. `retire`
 * and `record` are the only two verbs, which makes it structurally impossible
 * to overwrite what she loved when she was five.
 */
export interface TraitRepository {
  listForChild(childId: UUID): Promise<ChildTrait[]>;
  record(input: RecordTraitInput): Promise<ChildTrait>;
  /** Closes an open period — the child has moved on. */
  retire(traitId: UUID): Promise<ChildTrait>;
  /** Reopens a retired trait, for when a parent closed one by mistake. */
  restore(traitId: UUID): Promise<ChildTrait>;
  /** Removes a trait outright. For corrections, not for change over time. */
  remove(traitId: UUID): Promise<void>;
  /** Accepts a suggestion, making it parent-authoritative. */
  confirm(traitId: UUID): Promise<ChildTrait>;
}

export interface CreateChildInput {
  firstName: string;
  nickname?: string | null;
  dateOfBirth: IsoDate;
  /** Local file URI; the backend is responsible for storing it privately. */
  avatarUri?: string | null;
}

export interface ChildRepository {
  list(): Promise<Child[]>;
  get(childId: UUID): Promise<Child | null>;
  create(input: CreateChildInput): Promise<Child>;
  update(childId: UUID, patch: Partial<Pick<Child, 'firstName' | 'nickname' | 'dateOfBirth' | 'interests'>>): Promise<Child>;
  setAvatar(childId: UUID, localUri: string): Promise<Child>;
  /** Removes the child, their memories and every stored file. */
  remove(childId: UUID): Promise<void>;
}

/**
 * A photo on its way into a memory.
 *
 * The quality report travels with the photo rather than being saved separately
 * afterwards, because only the backend knows what asset id the file ends up
 * with. Zipping two lists by position outside that boundary would work right
 * up until two uploads finished in the same millisecond.
 */
export interface MemoryPhotoInput {
  /** Local file URI. */
  uri: string;
  /**
   * What this photo is for in a reconstruction, as declared by the parent.
   *
   * Declared rather than detected: the analyser cannot classify a viewing
   * angle, and asking is both honest and better product — a parent knows at a
   * glance which picture shows their child's face.
   */
  role?: ViewRole;
  /**
   * Measurements taken from the photo's actual pixels before upload.
   *
   * Stored on the asset's `meta` rather than in a new table. That bag exists
   * precisely so new per-asset information costs no migration, and readiness
   * is the first thing to use it for real.
   */
  signals?: PhotoSignals | null;
}

export interface CreateMemoryInput {
  childId: UUID;
  kind: MemoryKind;
  title: string;
  occurredOn: IsoDate;
  note?: string | null;
  futureMessage?: string | null;
  photos: MemoryPhotoInput[];
}

export interface MemoryWithAssets {
  memory: Memory;
  assets: Asset[];
  /** Latest 3D job for the memory, when one exists. */
  job: ThreeDJob | null;
  model: ThreeDModel | null;
}

export interface MemoryRepository {
  listForChild(childId: UUID): Promise<Memory[]>;
  listForFamily(): Promise<Memory[]>;
  get(memoryId: UUID): Promise<MemoryWithAssets | null>;
  create(input: CreateMemoryInput): Promise<Memory>;
  update(
    memoryId: UUID,
    patch: Partial<Pick<Memory, 'title' | 'note' | 'futureMessage' | 'occurredOn' | 'kind'>>,
  ): Promise<Memory>;
  remove(memoryId: UUID): Promise<void>;
}

export interface AssetRepository {
  get(assetId: UUID): Promise<Asset | null>;
  listForMemory(memoryId: UUID): Promise<Asset[]>;
  addPhotos(memoryId: UUID, photos: MemoryPhotoInput[]): Promise<Asset[]>;
  remove(assetId: UUID): Promise<void>;
  /**
   * A time-limited, viewer-scoped URL. Callers must never persist the result:
   * it expires, and that is the point.
   */
  resolveUrl(asset: Asset | null | undefined): Promise<string | null>;
}

export interface StartGenerationInput {
  memoryId: UUID;
  sourceAssetIds: UUID[];
  /** Set when this is a retry, so the chain stays traceable. */
  retryOfJobId?: UUID | null;
}

export interface ThreeDGateway {
  start(input: StartGenerationInput): Promise<ThreeDJob>;
  get(jobId: UUID): Promise<ThreeDJob | null>;
  /** Polled by the progress screen; providers are asynchronous by nature. */
  refresh(jobId: UUID): Promise<ThreeDJob>;
  getModel(jobId: UUID): Promise<ThreeDModel | null>;
  listForFamily(): Promise<ThreeDJob[]>;
  retry(jobId: UUID): Promise<ThreeDJob>;
  cancel(jobId: UUID): Promise<void>;
}

export interface SubmitLikenessInput {
  jobId: UUID;
  verdict: LikenessVerdict;
  aspects?: LikenessAspect[];
  note?: string | null;
  readinessScore?: number | null;
}

export interface LikenessGateway {
  submit(input: SubmitLikenessInput): Promise<LikenessFeedback>;
  forJob(jobId: UUID): Promise<LikenessFeedback | null>;
}

export interface AdminOverview {
  families: number;
  children: number;
  memories: number;
  jobsByStatus: Record<string, number>;
  failedJobs: number;
  estimatedSpendUsd: number;
}

export interface AdminJobRow {
  job: ThreeDJob;
  childFirstName: string;
  memoryTitle: string;
  calls: ProviderCall[];
  review: QaReview | null;
}

export interface AdminGateway {
  isAvailable(): boolean;
  overview(): Promise<AdminOverview>;
  listJobs(filter?: { status?: string; onlyFailed?: boolean }): Promise<AdminJobRow[]>;
  qaQueue(): Promise<AdminJobRow[]>;
  submitReview(jobId: UUID, decision: QaDecision, notes: string | null): Promise<QaReview>;
  recentAudit(): Promise<AuditEvent[]>;
}

export interface CapsuleGateway {
  listForChild(childId: UUID): Promise<CapsuleMessage[]>;
}

export interface FamilyGateway {
  get(): Promise<Family | null>;
  rename(name: string): Promise<Family>;
  setOccasions(occasionKeys: string[]): Promise<Family>;
  /** Everything the family owns, as JSON. Backs the data-export control. */
  exportAll(): Promise<Record<string, unknown>>;
  /** Deletes every child, memory and file but keeps the account. */
  deleteAllContent(): Promise<void>;
}

export interface MemoryBackend {
  /** Identifies the implementation in settings and logs. */
  readonly key: 'local' | 'supabase';
  readonly auth: AuthGateway;
  readonly family: FamilyGateway;
  readonly children: ChildRepository;
  readonly traits: TraitRepository;
  readonly memories: MemoryRepository;
  readonly assets: AssetRepository;
  readonly threeD: ThreeDGateway;
  readonly likeness: LikenessGateway;
  readonly admin: AdminGateway;
  readonly capsule: CapsuleGateway;
}


