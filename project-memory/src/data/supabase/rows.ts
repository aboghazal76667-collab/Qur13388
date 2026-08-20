import type {
  Asset,
  ChildTrait,
  AuditEvent,
  CapsuleMessage,
  Child,
  Family,
  Memory,
  PhotoQualityReport,
  PrintabilityReport,
  Profile,
  ProviderCall,
  QaReview,
  QualityDimension,
  ThreeDJob,
  ThreeDModel,
} from '@/domain';

/**
 * Row shapes and mappers.
 *
 * Postgres uses snake_case; the app uses camelCase. Doing the translation in
 * one file (rather than sprinkling `row.first_name` through components) is
 * what keeps the domain model independent of the database that happens to be
 * behind it today.
 */

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  language: string;
  is_staff: boolean;
  allows_model_training: boolean;
  created_at: string;
  updated_at: string;
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    language: row.language === 'ar' ? 'ar' : 'en',
    isStaff: row.is_staff,
    allowsModelTraining: row.allows_model_training,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FamilyRow {
  id: string;
  name: string;
  created_by: string;
  occasion_keys: string[] | null;
  created_at: string;
  updated_at: string;
}

export function toFamily(row: FamilyRow): Family {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    occasionKeys: row.occasion_keys ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChildRow {
  id: string;
  family_id: string;
  first_name: string;
  nickname: string | null;
  date_of_birth: string;
  avatar_asset_id: string | null;
  interests: string[] | null;
  created_at: string;
  updated_at: string;
}

export function toChild(row: ChildRow): Child {
  return {
    id: row.id,
    familyId: row.family_id,
    firstName: row.first_name,
    nickname: row.nickname,
    dateOfBirth: row.date_of_birth,
    avatarAssetId: row.avatar_asset_id,
    interests: row.interests ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface MemoryRow {
  id: string;
  family_id: string;
  child_id: string;
  kind: string;
  title: string;
  occurred_on: string;
  note: string | null;
  future_message: string | null;
  cover_asset_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    kind: row.kind as Memory['kind'],
    title: row.title,
    occurredOn: row.occurred_on,
    note: row.note,
    futureMessage: row.future_message,
    coverAssetId: row.cover_asset_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AssetRow {
  id: string;
  family_id: string;
  child_id: string | null;
  memory_id: string | null;
  kind: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  duration_ms: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    memoryId: row.memory_id,
    kind: row.kind as Asset['kind'],
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    durationMs: row.duration_ms,
    meta: row.meta ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface QualityReportRow {
  id: string;
  asset_id: string;
  analyzer_id: string;
  analyzer_version: string;
  overall_score: number;
  verdict: string;
  dimensions: QualityDimension[] | null;
  summary: string;
  advice: string | null;
  created_at: string;
  updated_at: string;
}

export function toQualityReport(row: QualityReportRow): PhotoQualityReport {
  return {
    id: row.id,
    assetId: row.asset_id,
    analyzerId: row.analyzer_id,
    analyzerVersion: row.analyzer_version,
    overallScore: row.overall_score,
    verdict: row.verdict as PhotoQualityReport['verdict'],
    dimensions: row.dimensions ?? [],
    summary: row.summary,
    advice: row.advice,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface JobRow {
  id: string;
  family_id: string;
  child_id: string;
  memory_id: string;
  requested_by: string;
  status: string;
  provider_key: string | null;
  provider_job_id: string | null;
  source_asset_ids: string[] | null;
  progress: number;
  stage_index: number;
  error_code: string | null;
  retry_of_job_id: string | null;
  attempt: number;
  params: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toJob(row: JobRow): ThreeDJob {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    memoryId: row.memory_id,
    requestedBy: row.requested_by,
    status: row.status as ThreeDJob['status'],
    providerKey: row.provider_key,
    providerJobId: row.provider_job_id,
    sourceAssetIds: row.source_asset_ids ?? [],
    progress: Number(row.progress ?? 0),
    stageIndex: row.stage_index ?? 0,
    errorCode: row.error_code,
    retryOfJobId: row.retry_of_job_id,
    attempt: row.attempt ?? 1,
    params: row.params ?? {},
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ModelRow {
  id: string;
  job_id: string;
  family_id: string;
  child_id: string;
  memory_id: string;
  format: string;
  asset_id: string | null;
  preview_asset_id: string | null;
  turntable_asset_ids: string[] | null;
  polycount: number | null;
  printability: PrintabilityReport | null;
  is_print_ready: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function toModel(row: ModelRow): ThreeDModel {
  return {
    id: row.id,
    jobId: row.job_id,
    familyId: row.family_id,
    childId: row.child_id,
    memoryId: row.memory_id,
    format: row.format as ThreeDModel['format'],
    assetId: row.asset_id,
    previewAssetId: row.preview_asset_id,
    turntableAssetIds: row.turntable_asset_ids ?? [],
    polycount: row.polycount,
    printability: row.printability,
    isPrintReady: row.is_print_ready,
    meta: row.meta ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProviderCallRow {
  id: string;
  job_id: string;
  provider_key: string;
  model: string | null;
  operation: string;
  duration_ms: number;
  success: boolean;
  http_status: number | null;
  credits_used: number | null;
  estimated_cost_usd: number | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export function toProviderCall(row: ProviderCallRow): ProviderCall {
  return {
    id: row.id,
    jobId: row.job_id,
    providerKey: row.provider_key,
    model: row.model,
    operation: row.operation as ProviderCall['operation'],
    durationMs: row.duration_ms,
    success: row.success,
    httpStatus: row.http_status,
    creditsUsed: row.credits_used,
    estimatedCostUsd: row.estimated_cost_usd,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface QaReviewRow {
  id: string;
  job_id: string;
  model_id: string | null;
  reviewer_id: string;
  decision: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function toQaReview(row: QaReviewRow): QaReview {
  return {
    id: row.id,
    jobId: row.job_id,
    modelId: row.model_id,
    reviewerId: row.reviewer_id,
    decision: row.decision as QaReview['decision'],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CapsuleRow {
  id: string;
  family_id: string;
  child_id: string;
  author_id: string;
  format: string;
  body: string | null;
  asset_id: string | null;
  deliver_at: string | null;
  unlocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toCapsule(row: CapsuleRow): CapsuleMessage {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    authorId: row.author_id,
    format: row.format as CapsuleMessage['format'],
    body: row.body,
    assetId: row.asset_id,
    deliverAt: row.deliver_at,
    unlockedAt: row.unlocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export function toAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    meta: row.meta ?? {},
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export interface ChildTraitRow {
  id: string;
  family_id: string;
  child_id: string;
  category: string;
  value: string;
  value_key: string;
  custom_label: string | null;
  source: string;
  confirmed_at: string | null;
  is_current: boolean;
  observed_from: string;
  observed_to: string | null;
  age_months_at_record: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function toChildTrait(row: ChildTraitRow): ChildTrait {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    category: row.category as ChildTrait['category'],
    value: row.value,
    valueKey: row.value_key,
    customLabel: row.custom_label,
    source: row.source === 'suggested' ? 'suggested' : 'parent',
    confirmedAt: row.confirmed_at,
    isCurrent: row.is_current,
    observedFrom: row.observed_from,
    observedTo: row.observed_to,
    ageMonthsAtRecord: row.age_months_at_record,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
