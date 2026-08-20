/**
 * Project Memory — domain model.
 *
 * Design rule that governs this file: a family's archive is expected to live
 * for twenty years, so adding a new kind of memory content must never require
 * a table rewrite. That is why content is modelled as `Asset` rows with a
 * `kind` discriminator and a `meta` bag, rather than as columns on `Memory`.
 * Video, audio, stories, printed products and QR references all land as new
 * `AssetKind` values, not as migrations of existing rows.
 */

export type UUID = string;
/** ISO 8601 instant, e.g. `2026-04-20T17:00:00.000Z`. */
export type Timestamp = string;
/** ISO calendar date with no time component, e.g. `2021-04-12`. */
export type IsoDate = string;

export interface Entity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ------------------------------------------------------------------ people */

export interface Profile extends Entity {
  email: string;
  displayName: string;
  language: 'en' | 'ar';
  /** Internal staff flag. Never granted through the app UI. */
  isStaff: boolean;
  /** Off by default, and explicitly asked for. See PRIVACY.md. */
  allowsModelTraining: boolean;
}

export interface Family extends Entity {
  name: string;
  createdBy: UUID;
  /** Occasion keys the family opted into. Nothing is assumed. */
  occasionKeys: string[];
}

export type FamilyRole = 'owner' | 'parent' | 'guardian' | 'viewer';

export interface FamilyMember {
  familyId: UUID;
  profileId: UUID;
  role: FamilyRole;
  createdAt: Timestamp;
}

export interface Child extends Entity {
  familyId: UUID;
  /** First name only — we deliberately never ask for a surname. */
  firstName: string;
  nickname: string | null;
  dateOfBirth: IsoDate;
  avatarAssetId: UUID | null;
  /** Free-text interests, used later by the personalised story feature. */
  interests: string[];
}

/* ---------------------------------------------------------------- memories */

/**
 * Memory kinds are data, not a closed union in the database — the SQL column
 * is text with a check constraint we can extend. Keeping the TypeScript union
 * narrow gives us exhaustive switches in the UI today.
 */
export type MemoryKind =
  | 'birth'
  | 'birthday'
  | 'first_day'
  | 'family_moment'
  | 'holiday'
  | 'achievement'
  | 'milestone'
  | 'custom';

export const memoryKinds: readonly MemoryKind[] = [
  'birthday',
  'first_day',
  'family_moment',
  'holiday',
  'achievement',
  'custom',
];

export interface Memory extends Entity {
  familyId: UUID;
  childId: UUID;
  kind: MemoryKind;
  title: string;
  occurredOn: IsoDate;
  note: string | null;
  /** Held for the child to read when they are older. */
  futureMessage: string | null;
  coverAssetId: UUID | null;
  createdBy: UUID;
}

/* ------------------------------------------------------------------ assets */

export type AssetKind =
  | 'photo'
  | 'photo_processed'
  | 'avatar'
  | 'video'
  | 'audio'
  | 'document'
  | 'model_3d'
  | 'model_preview'
  | 'print_file'
  | 'story_page';

export interface Asset extends Entity {
  familyId: UUID;
  childId: UUID | null;
  memoryId: UUID | null;
  kind: AssetKind;
  /**
   * Path inside the private bucket, never a public URL:
   * `families/{familyId}/children/{childId}/memories/{memoryId}/{assetId}.jpg`
   * Readable URLs are minted on demand and expire.
   */
  storagePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  durationMs: number | null;
  /** Per-kind extras — no schema change needed to add a field. */
  meta: Record<string, unknown>;
}

/* ---------------------------------------------------------- photo quality */

export type QualityDimensionKey =
  | 'face'
  | 'body'
  | 'lighting'
  | 'sharpness'
  | 'background'
  | 'framing'
  | 'people';

export type QualityVerdict = 'excellent' | 'good' | 'fair' | 'poor';

export interface QualityDimension {
  key: QualityDimensionKey;
  score: number;
  verdict: QualityVerdict;
  /** Plain-language, parent-facing. Never mentions models or pipelines. */
  hint: string | null;
}

export interface PhotoQualityReport extends Entity {
  assetId: UUID;
  /** Which analyzer produced this, so results stay comparable over time. */
  analyzerId: string;
  analyzerVersion: string;
  overallScore: number;
  verdict: QualityVerdict;
  dimensions: QualityDimension[];
  /** Parent-facing summary sentence. */
  summary: string;
  /** Present when we would suggest a different photo. */
  advice: string | null;
}

/* ---------------------------------------------------------------------- 3D */

/**
 * The full lifecycle, including states only the manufacturing side reaches.
 * The app renders a simplified view of these; admin sees them all.
 */
export type ThreeDJobStatus =
  | 'uploaded'
  | 'image_checked'
  | 'generating'
  | 'raw_model_ready'
  | 'quality_review'
  | 'printability_check'
  | 'approved'
  | 'print_ready'
  | 'ordered'
  | 'printing'
  | 'shipped'
  | 'delivered'
  | 'failed';

export interface ThreeDJob extends Entity {
  familyId: UUID;
  childId: UUID;
  memoryId: UUID;
  requestedBy: UUID;
  status: ThreeDJobStatus;
  /** Which provider the router picked. Null until dispatch. */
  providerKey: string | null;
  providerJobId: string | null;
  /** 1–5 photos. Multi-view reconstruction is the intended direction. */
  sourceAssetIds: UUID[];
  /** 0–1. */
  progress: number;
  /** Index into the parent-facing stage copy. */
  stageIndex: number;
  /** Machine-readable failure reason; the UI maps it to friendly copy. */
  errorCode: string | null;
  /** Retry chain — a retry never destroys the memory or the photos. */
  retryOfJobId: UUID | null;
  attempt: number;
  params: Record<string, unknown>;
  completedAt: Timestamp | null;
}

export type ModelFormat = 'glb' | 'obj' | 'stl' | '3mf';

export interface PrintabilityReport {
  isWatertight: boolean;
  hasThinFeatures: boolean;
  estimatedHeightMm: number | null;
  wallThicknessMm: number | null;
  warnings: string[];
  score: number;
}

export interface ThreeDModel extends Entity {
  jobId: UUID;
  familyId: UUID;
  childId: UUID;
  memoryId: UUID;
  format: ModelFormat;
  /** The heavy source file. Never downloaded to the phone by default. */
  assetId: UUID | null;
  /** Lightweight preview the phone can show cheaply. */
  previewAssetId: UUID | null;
  /**
   * When the provider gives a turntable, these are the angle frames used by
   * the drag-to-rotate preview. Empty for providers that supply only a still.
   */
  turntableAssetIds: UUID[];
  polycount: number | null;
  printability: PrintabilityReport | null;
  isPrintReady: boolean;
  /**
   * Provider-specific extras. The mock provider records the seed for its
   * procedural preview here; a real provider records its own render metadata.
   * Same principle as `Asset.meta` — new information costs no migration.
   */
  meta: Record<string, unknown>;
}

/** One row per outbound provider call. This is our cost and reliability data. */
export interface ProviderCall extends Entity {
  jobId: UUID;
  providerKey: string;
  model: string | null;
  operation: 'generate' | 'status' | 'download' | 'printability';
  durationMs: number;
  success: boolean;
  httpStatus: number | null;
  creditsUsed: number | null;
  estimatedCostUsd: number | null;
  errorCode: string | null;
}

/**
 * What a parent said about the likeness.
 *
 * Coarse on purpose: a five-star scale invites precision nobody has, whereas
 * "the face needs work" is easy to give and directly actionable.
 */
export type LikenessVerdict = 'good' | 'needs_work';

export type LikenessAspect = 'face' | 'body' | 'clothes' | 'overall';

export interface LikenessFeedback extends Entity {
  familyId: UUID;
  jobId: UUID;
  modelId: UUID | null;
  childId: UUID;
  submittedBy: UUID;
  verdict: LikenessVerdict;
  /** Empty when the verdict is 'good'. */
  aspects: LikenessAspect[];
  note: string | null;
  /** Context, so a year of feedback stays interpretable as things change. */
  providerKey: string | null;
  sourcePhotoCount: number | null;
  /** Lets us learn whether our own readiness guidance predicts a good result. */
  readinessScore: number | null;
}

export type QaDecision = 'approved' | 'needs_regeneration' | 'needs_manual_adjustment' | 'rejected';

export interface QaReview extends Entity {
  jobId: UUID;
  modelId: UUID | null;
  reviewerId: UUID;
  decision: QaDecision;
  notes: string | null;
}

/* --------------------------------------------------- future feature hooks */

/** Personalised illustrated story. Architected now, built later. */
export interface Story extends Entity {
  familyId: UUID;
  childId: UUID;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  title: string | null;
  theme: string | null;
  interests: string[];
  values: string[];
  pageCount: number;
}

/** Time capsule. A future message on a memory is the seed of this. */
export interface CapsuleMessage extends Entity {
  familyId: UUID;
  childId: UUID;
  authorId: UUID;
  format: 'text' | 'audio' | 'video';
  body: string | null;
  assetId: UUID | null;
  /** Null means "part of the archive, no scheduled unlock". */
  deliverAt: Timestamp | null;
  unlockedAt: Timestamp | null;
}

/**
 * Occasions are opt-in per family. Nothing is treated as universal — a family
 * in Muscat and a family in Manchester should not see the same defaults.
 */
export interface Occasion {
  key: string;
  labelEn: string;
  labelAr: string;
  /** How the date is derived; the calendar engine is a later concern. */
  calendar: 'gregorian' | 'hijri' | 'derived' | 'custom';
}

export interface Reminder extends Entity {
  familyId: UUID;
  childId: UUID | null;
  occasionKey: string;
  /** Next scheduled date, recomputed by the calendar engine. */
  nextOccursOn: IsoDate | null;
  enabled: boolean;
}

export type PlanKey = 'free' | 'memory' | 'family' | 'legacy';

export interface Subscription extends Entity {
  familyId: UUID;
  plan: PlanKey;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  /** No payment provider is wired up yet; this is the seam for one. */
  externalRef: string | null;
  renewsOn: IsoDate | null;
}

export type OrderStatus = 'draft' | 'placed' | 'in_production' | 'shipped' | 'delivered' | 'cancelled';

export interface Order extends Entity {
  familyId: UUID;
  status: OrderStatus;
  currency: string;
  totalMinor: number;
}

export interface OrderItem extends Entity {
  orderId: UUID;
  modelId: UUID | null;
  memoryId: UUID | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
}

/* -------------------------------------------------------- instrumentation */

export interface AnalyticsEvent {
  id: UUID;
  name: string;
  /** Never contains a child's name, photo, or any free text a parent typed. */
  props: Record<string, string | number | boolean | null>;
  createdAt: Timestamp;
}

export interface AuditEvent extends Entity {
  actorId: UUID | null;
  action: string;
  entity: string;
  entityId: UUID | null;
  meta: Record<string, unknown>;
}
