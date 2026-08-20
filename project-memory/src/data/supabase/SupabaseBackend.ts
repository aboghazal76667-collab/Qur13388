import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/lib/errors';
import { newId, nowIso } from '@/lib/ids';
import { log } from '@/lib/log';
import { env } from '@/lib/env';
import { analytics } from '@/services/analytics';
import { floorProgressFor, stageIndexFor } from '@/services/threeD/pipeline';
import type {
  Asset,
  AuditEvent,
  CapsuleMessage,
  Child,
  Family,
  Memory,
  PhotoQualityReport,
  Profile,
  QaDecision,
  QaReview,
  ThreeDJob,
  ThreeDModel,
  UUID,
} from '@/domain';

import type {
  AdminGateway,
  AdminJobRow,
  AdminOverview,
  AssetRepository,
  AuthGateway,
  AuthSession,
  CapsuleGateway,
  ChildRepository,
  CreateChildInput,
  CreateMemoryInput,
  FamilyGateway,
  MemoryBackend,
  MemoryPhotoInput,
  MemoryRepository,
  MemoryWithAssets,
  SignInInput,
  SignUpInput,
  StartGenerationInput,
  ThreeDGateway,
} from '../backend';
import { extensionFromUri, mimeFromExtension, storagePathFor } from '../local/files';
import { createSupabaseClient, PRIVATE_BUCKET, SIGNED_URL_TTL_SECONDS } from './client';
import {
  toAsset,
  toAudit,
  toCapsule,
  toChild,
  toFamily,
  toJob,
  toMemory,
  toModel,
  toProfile,
  toProviderCall,
  toQaReview,
  toQualityReport,
  type AssetRow,
  type AuditRow,
  type CapsuleRow,
  type ChildRow,
  type FamilyRow,
  type JobRow,
  type MemoryRow,
  type ModelRow,
  type ProfileRow,
  type ProviderCallRow,
  type QaReviewRow,
  type QualityReportRow,
} from './rows';

/**
 * The Supabase backend.
 *
 * Two things are worth knowing when reading this file.
 *
 * First, it never filters by `family_id` for security. Row-level security does
 * that in the database, where it cannot be forgotten. Where a filter appears
 * here it is for efficiency, not for access control — a client-side filter is
 * not a privacy boundary and this codebase does not pretend otherwise.
 *
 * Second, 3D generation is *not* called from here. The app posts a request to
 * our own server, which holds the provider credentials and runs the AI router.
 * No vendor API key can reach a phone through this path.
 */

function fail(context: string, error: { message: string; code?: string } | null): never {
  log.error(`supabase ${context} failed`, { message: error?.message, code: error?.code });
  if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
    throw new AppError('auth', error.message);
  }
  if (error?.code === '42501') throw new AppError('permission', error.message);
  throw new AppError('unknown', error?.message ?? context);
}

/* ------------------------------------------------------------------- auth */

class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  private async loadSession(userId: string): Promise<AuthSession> {
    const { data: profileRow, error: profileError } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();
    if (profileError) fail('load profile', profileError);
    if (!profileRow) throw new AppError('auth', 'profile row missing');

    const { data: membership, error: memberError } = await this.client
      .from('family_members')
      .select('family_id')
      .eq('profile_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ family_id: string }>();
    if (memberError) fail('load membership', memberError);
    if (!membership) throw new AppError('auth', 'no family membership');

    return { profile: toProfile(profileRow), familyId: membership.family_id };
  }

  async getSession(): Promise<AuthSession | null> {
    const { data } = await this.client.auth.getSession();
    if (!data.session?.user) return null;
    try {
      return await this.loadSession(data.session.user.id);
    } catch (error) {
      log.warn('stale supabase session', { error: String(error) });
      return null;
    }
  }

  async signUp(input: SignUpInput): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        // Consumed by the `handle_new_user` trigger, which creates the profile
        // and the family in one transaction. Doing it in SQL means a signup can
        // never leave a user without a family.
        data: {
          display_name: input.displayName.trim(),
          family_name: input.familyName.trim() || input.displayName.trim(),
          language: input.language,
        },
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes('password')) {
        throw new AppError('validation', error.message);
      }
      fail('sign up', error);
    }
    if (!data.user) throw new AppError('auth', 'sign up returned no user');

    analytics.track('account_created', { backend: 'supabase' });
    return this.loadSession(data.user.id);
  }

  async signIn(input: SignInInput): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (error) throw new AppError('auth', error.message);
    if (!data.user) throw new AppError('auth', 'sign in returned no user');

    analytics.track('signed_in', { backend: 'supabase' });
    return this.loadSession(data.user.id);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async updateProfile(
    patch: Partial<Pick<Profile, 'displayName' | 'language' | 'allowsModelTraining'>>,
  ): Promise<Profile> {
    const { data: session } = await this.client.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw new AppError('auth');

    const row: Record<string, unknown> = { updated_at: nowIso() };
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.language !== undefined) row.language = patch.language;
    if (patch.allowsModelTraining !== undefined) row.allows_model_training = patch.allowsModelTraining;

    const { data, error } = await this.client
      .from('profiles')
      .update(row)
      .eq('id', userId)
      .select('*')
      .single<ProfileRow>();
    if (error) fail('update profile', error);
    return toProfile(data);
  }

  async deleteAccount(): Promise<void> {
    // Deleting an auth user requires elevated privileges, so it runs in a
    // security-definer function that also removes every owned row and file.
    const { error } = await this.client.rpc('delete_my_account');
    if (error) fail('delete account', error);
    await this.client.auth.signOut();
    analytics.track('content_deleted', { scope: 'account' });
  }

  isSocialAvailable(): boolean {
    // Wiring is in place; credentials are not configured yet. The UI says so
    // rather than presenting a button that quietly fails.
    return false;
  }

  async signInWithProvider(provider: 'apple' | 'google'): Promise<AuthSession> {
    throw new AppError('auth', `social sign-in not configured: ${provider}`);
  }
}

/* ----------------------------------------------------------------- family */

class SupabaseFamilyGateway implements FamilyGateway {
  constructor(
    private readonly client: SupabaseClient,
    private readonly familyId: () => UUID,
  ) {}

  async get(): Promise<Family | null> {
    const { data, error } = await this.client
      .from('families')
      .select('*')
      .eq('id', this.familyId())
      .maybeSingle<FamilyRow>();
    if (error) fail('load family', error);
    return data ? toFamily(data) : null;
  }

  private async patch(patch: Record<string, unknown>): Promise<Family> {
    const { data, error } = await this.client
      .from('families')
      .update({ ...patch, updated_at: nowIso() })
      .eq('id', this.familyId())
      .select('*')
      .single<FamilyRow>();
    if (error) fail('update family', error);
    return toFamily(data);
  }

  rename(name: string): Promise<Family> {
    return this.patch({ name: name.trim() });
  }

  setOccasions(occasionKeys: string[]): Promise<Family> {
    return this.patch({ occasion_keys: occasionKeys });
  }

  async exportAll(): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.rpc('export_my_family');
    if (error) fail('export family', error);
    analytics.track('data_exported');
    return (data as Record<string, unknown>) ?? {};
  }

  async deleteAllContent(): Promise<void> {
    const { error } = await this.client.rpc('delete_family_content');
    if (error) fail('delete family content', error);
    analytics.track('content_deleted', { scope: 'family' });
  }
}

/* -------------------------------------------------------- storage upload */

/**
 * Uploads a local file into the private bucket.
 *
 * `fetch` on a file URI gives us a blob without pulling in a base64 round trip,
 * which matters on a phone: a 4 MB photo becomes 5.5 MB of string otherwise.
 */
async function uploadToBucket(
  client: SupabaseClient,
  localUri: string,
  storagePath: string,
  mimeType: string,
): Promise<number | null> {
  const response = await fetch(localUri);
  if (!response.ok) throw new AppError('upload', `could not read ${localUri}`);
  const blob = await response.blob();

  const { error } = await client.storage.from(PRIVATE_BUCKET).upload(storagePath, blob, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    log.error('storage upload failed', { message: error.message, storagePath });
    throw new AppError('upload', error.message);
  }
  return blob.size ?? null;
}

/* --------------------------------------------------------------- children */

class SupabaseChildRepository implements ChildRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly familyId: () => UUID,
  ) {}

  async list(): Promise<Child[]> {
    const { data, error } = await this.client
      .from('children')
      .select('*')
      .order('date_of_birth', { ascending: true })
      .returns<ChildRow[]>();
    if (error) fail('list children', error);
    return (data ?? []).map(toChild);
  }

  async get(childId: UUID): Promise<Child | null> {
    const { data, error } = await this.client
      .from('children')
      .select('*')
      .eq('id', childId)
      .maybeSingle<ChildRow>();
    if (error) fail('get child', error);
    return data ? toChild(data) : null;
  }

  private async storeAvatar(childId: UUID, localUri: string): Promise<Asset> {
    const familyId = this.familyId();
    const assetId = newId();
    const extension = extensionFromUri(localUri);
    const mimeType = mimeFromExtension(extension);
    const storagePath = storagePathFor({
      familyId,
      childId,
      assetId,
      extension,
      bucketFolder: 'avatars',
    });
    const byteSize = await uploadToBucket(this.client, localUri, storagePath, mimeType);

    const { data, error } = await this.client
      .from('assets')
      .insert({
        id: assetId,
        family_id: familyId,
        child_id: childId,
        memory_id: null,
        kind: 'avatar',
        storage_path: storagePath,
        mime_type: mimeType,
        byte_size: byteSize,
        meta: {},
      })
      .select('*')
      .single<AssetRow>();
    if (error) fail('insert avatar asset', error);
    return toAsset(data);
  }

  async create(input: CreateChildInput): Promise<Child> {
    const childId = newId();
    const { data, error } = await this.client
      .from('children')
      .insert({
        id: childId,
        family_id: this.familyId(),
        first_name: input.firstName.trim(),
        nickname: input.nickname?.trim() || null,
        date_of_birth: input.dateOfBirth,
        interests: [],
      })
      .select('*')
      .single<ChildRow>();
    if (error) fail('create child', error);

    if (input.avatarUri) {
      // The child row exists before the upload, so a failed upload costs the
      // avatar — never the profile the parent just created.
      try {
        const asset = await this.storeAvatar(childId, input.avatarUri);
        const { data: updated, error: updateError } = await this.client
          .from('children')
          .update({ avatar_asset_id: asset.id, updated_at: nowIso() })
          .eq('id', childId)
          .select('*')
          .single<ChildRow>();
        if (!updateError && updated) {
          analytics.track('child_created', { hasAvatar: true });
          return toChild(updated);
        }
      } catch (uploadError) {
        log.warn('avatar upload failed, child kept', { error: String(uploadError) });
      }
    }

    analytics.track('child_created', { hasAvatar: false });
    return toChild(data);
  }

  async update(
    childId: UUID,
    patch: Partial<Pick<Child, 'firstName' | 'nickname' | 'dateOfBirth' | 'interests'>>,
  ): Promise<Child> {
    const row: Record<string, unknown> = { updated_at: nowIso() };
    if (patch.firstName !== undefined) row.first_name = patch.firstName;
    if (patch.nickname !== undefined) row.nickname = patch.nickname;
    if (patch.dateOfBirth !== undefined) row.date_of_birth = patch.dateOfBirth;
    if (patch.interests !== undefined) row.interests = patch.interests;

    const { data, error } = await this.client
      .from('children')
      .update(row)
      .eq('id', childId)
      .select('*')
      .single<ChildRow>();
    if (error) fail('update child', error);
    return toChild(data);
  }

  async setAvatar(childId: UUID, localUri: string): Promise<Child> {
    const asset = await this.storeAvatar(childId, localUri);
    const { data, error } = await this.client
      .from('children')
      .update({ avatar_asset_id: asset.id, updated_at: nowIso() })
      .eq('id', childId)
      .select('*')
      .single<ChildRow>();
    if (error) fail('set avatar', error);
    return toChild(data);
  }

  async remove(childId: UUID): Promise<void> {
    // Files first: a deleted row with orphaned objects in the bucket would be
    // a privacy failure, whereas a deleted file with a surviving row is merely
    // a broken thumbnail we can clean up.
    const { data: assets } = await this.client
      .from('assets')
      .select('storage_path')
      .eq('child_id', childId)
      .returns<{ storage_path: string }[]>();
    const paths = (assets ?? []).map((row) => row.storage_path);
    if (paths.length > 0) {
      const { error } = await this.client.storage.from(PRIVATE_BUCKET).remove(paths);
      if (error) log.warn('could not remove child files', { message: error.message });
    }

    const { error } = await this.client.from('children').delete().eq('id', childId);
    if (error) fail('delete child', error);
    analytics.track('content_deleted', { scope: 'child' });
  }
}

/* --------------------------------------------------------------- memories */

async function uploadPhotos(
  client: SupabaseClient,
  familyId: UUID,
  childId: UUID,
  memoryId: UUID,
  photos: MemoryPhotoInput[],
): Promise<Asset[]> {
  const rows: Record<string, unknown>[] = [];
  const reportRows: Record<string, unknown>[] = [];

  for (const photo of photos) {
    const uri = photo.uri;
    const assetId = newId();
    const extension = extensionFromUri(uri);
    const mimeType = mimeFromExtension(extension);
    const storagePath = storagePathFor({
      familyId,
      childId,
      memoryId,
      assetId,
      extension,
      bucketFolder: 'originals',
    });
    const byteSize = await uploadToBucket(client, uri, storagePath, mimeType);
    rows.push({
      id: assetId,
      family_id: familyId,
      child_id: childId,
      memory_id: memoryId,
      kind: 'photo',
      storage_path: storagePath,
      mime_type: mimeType,
      byte_size: byteSize,
      meta: {},
    });

    if (photo.quality) {
      // Re-keyed to the id the file actually got, which is why the report
      // travels with the photo rather than being saved separately after.
      reportRows.push({
        asset_id: assetId,
        analyzer_id: photo.quality.analyzerId,
        analyzer_version: photo.quality.analyzerVersion,
        overall_score: photo.quality.overallScore,
        verdict: photo.quality.verdict,
        dimensions: photo.quality.dimensions,
        summary: photo.quality.summary,
        advice: photo.quality.advice,
      });
    }
  }

  if (rows.length === 0) return [];
  const { data, error } = await client.from('assets').insert(rows).select('*').returns<AssetRow[]>();
  if (error) fail('insert photo assets', error);

  if (reportRows.length > 0) {
    // A lost quality report costs a hint, not a photograph, so it must never
    // fail the upload.
    const { error: reportError } = await client
      .from('photo_quality_reports')
      .upsert(reportRows, { onConflict: 'asset_id' });
    if (reportError) log.warn('could not save quality reports', { message: reportError.message });
  }

  return (data ?? []).map(toAsset);
}

class SupabaseMemoryRepository implements MemoryRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly familyId: () => UUID,
  ) {}

  async listForChild(childId: UUID): Promise<Memory[]> {
    const { data, error } = await this.client
      .from('memories')
      .select('*')
      .eq('child_id', childId)
      .order('occurred_on', { ascending: false })
      .returns<MemoryRow[]>();
    if (error) fail('list memories', error);
    return (data ?? []).map(toMemory);
  }

  async listForFamily(): Promise<Memory[]> {
    const { data, error } = await this.client
      .from('memories')
      .select('*')
      .order('occurred_on', { ascending: false })
      .returns<MemoryRow[]>();
    if (error) fail('list family memories', error);
    return (data ?? []).map(toMemory);
  }

  async get(memoryId: UUID): Promise<MemoryWithAssets | null> {
    const { data: memoryRow, error } = await this.client
      .from('memories')
      .select('*')
      .eq('id', memoryId)
      .maybeSingle<MemoryRow>();
    if (error) fail('get memory', error);
    if (!memoryRow) return null;

    const [{ data: assetRows }, { data: jobRows }] = await Promise.all([
      this.client
        .from('assets')
        .select('*')
        .eq('memory_id', memoryId)
        .order('created_at', { ascending: true })
        .returns<AssetRow[]>(),
      this.client
        .from('three_d_jobs')
        .select('*')
        .eq('memory_id', memoryId)
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<JobRow[]>(),
    ]);

    const job = jobRows?.[0] ? toJob(jobRows[0]) : null;
    let model: ThreeDModel | null = null;
    if (job) {
      const { data: modelRow } = await this.client
        .from('three_d_models')
        .select('*')
        .eq('job_id', job.id)
        .maybeSingle<ModelRow>();
      model = modelRow ? toModel(modelRow) : null;
    }

    return { memory: toMemory(memoryRow), assets: (assetRows ?? []).map(toAsset), job, model };
  }

  async create(input: CreateMemoryInput): Promise<Memory> {
    const familyId = this.familyId();
    const memoryId = newId();
    const { data: userData } = await this.client.auth.getUser();
    const createdBy = userData.user?.id;
    if (!createdBy) throw new AppError('auth');

    // The memory row goes in first so that a photo upload failing part way
    // through never discards what the parent wrote.
    const { data, error } = await this.client
      .from('memories')
      .insert({
        id: memoryId,
        family_id: familyId,
        child_id: input.childId,
        kind: input.kind,
        title: input.title.trim(),
        occurred_on: input.occurredOn,
        note: input.note?.trim() || null,
        future_message: input.futureMessage?.trim() || null,
        created_by: createdBy,
      })
      .select('*')
      .single<MemoryRow>();
    if (error) fail('create memory', error);

    let assets: Asset[] = [];
    try {
      assets = await uploadPhotos(this.client, familyId, input.childId, memoryId, input.photos);
    } catch (uploadError) {
      log.warn('photo upload failed, memory kept', { error: String(uploadError) });
    }

    if (assets[0]) {
      const { data: updated } = await this.client
        .from('memories')
        .update({ cover_asset_id: assets[0].id, updated_at: nowIso() })
        .eq('id', memoryId)
        .select('*')
        .single<MemoryRow>();
      if (updated) {
        analytics.track('memory_created', { kind: input.kind, photoCount: assets.length });
        return toMemory(updated);
      }
    }

    analytics.track('memory_created', { kind: input.kind, photoCount: assets.length });
    return toMemory(data);
  }

  async update(
    memoryId: UUID,
    patch: Partial<Pick<Memory, 'title' | 'note' | 'futureMessage' | 'occurredOn' | 'kind'>>,
  ): Promise<Memory> {
    const row: Record<string, unknown> = { updated_at: nowIso() };
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.note !== undefined) row.note = patch.note;
    if (patch.futureMessage !== undefined) row.future_message = patch.futureMessage;
    if (patch.occurredOn !== undefined) row.occurred_on = patch.occurredOn;
    if (patch.kind !== undefined) row.kind = patch.kind;

    const { data, error } = await this.client
      .from('memories')
      .update(row)
      .eq('id', memoryId)
      .select('*')
      .single<MemoryRow>();
    if (error) fail('update memory', error);
    return toMemory(data);
  }

  async remove(memoryId: UUID): Promise<void> {
    const { data: assets } = await this.client
      .from('assets')
      .select('storage_path')
      .eq('memory_id', memoryId)
      .returns<{ storage_path: string }[]>();
    const paths = (assets ?? []).map((row) => row.storage_path);
    if (paths.length > 0) {
      const { error } = await this.client.storage.from(PRIVATE_BUCKET).remove(paths);
      if (error) log.warn('could not remove memory files', { message: error.message });
    }

    const { error } = await this.client.from('memories').delete().eq('id', memoryId);
    if (error) fail('delete memory', error);
    analytics.track('content_deleted', { scope: 'memory' });
  }
}

/* ----------------------------------------------------------------- assets */

class SupabaseAssetRepository implements AssetRepository {
  /** Signed URLs are short-lived, so we cache them only until they expire. */
  private urlCache = new Map<string, { url: string; expiresAt: number }>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly familyId: () => UUID,
  ) {}

  async get(assetId: UUID): Promise<Asset | null> {
    const { data, error } = await this.client
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle<AssetRow>();
    if (error) fail('get asset', error);
    return data ? toAsset(data) : null;
  }

  async listForMemory(memoryId: UUID): Promise<Asset[]> {
    const { data, error } = await this.client
      .from('assets')
      .select('*')
      .eq('memory_id', memoryId)
      .order('created_at', { ascending: true })
      .returns<AssetRow[]>();
    if (error) fail('list assets', error);
    return (data ?? []).map(toAsset);
  }

  async addPhotos(memoryId: UUID, photos: MemoryPhotoInput[]): Promise<Asset[]> {
    const { data: memoryRow, error } = await this.client
      .from('memories')
      .select('child_id')
      .eq('id', memoryId)
      .maybeSingle<{ child_id: string }>();
    if (error) fail('load memory for upload', error);
    if (!memoryRow) throw new AppError('not_found', 'memory');

    const assets = await uploadPhotos(
      this.client,
      this.familyId(),
      memoryRow.child_id,
      memoryId,
      photos,
    );
    analytics.track('photo_added', { count: assets.length });
    return assets;
  }

  async remove(assetId: UUID): Promise<void> {
    const { data: row } = await this.client
      .from('assets')
      .select('storage_path')
      .eq('id', assetId)
      .maybeSingle<{ storage_path: string }>();
    if (row) {
      this.urlCache.delete(row.storage_path);
      const { error } = await this.client.storage.from(PRIVATE_BUCKET).remove([row.storage_path]);
      if (error) log.warn('could not remove file', { message: error.message });
    }
    const { error } = await this.client.from('assets').delete().eq('id', assetId);
    if (error) fail('delete asset', error);
  }

  async resolveUrl(asset: Asset | null | undefined): Promise<string | null> {
    if (!asset) return null;

    const cached = this.urlCache.get(asset.storagePath);
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.url;

    const { data, error } = await this.client.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(asset.storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      log.warn('could not sign url', { message: error?.message, path: asset.storagePath });
      return null;
    }

    this.urlCache.set(asset.storagePath, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  }

  async saveQualityReport(report: PhotoQualityReport): Promise<PhotoQualityReport> {
    const { data, error } = await this.client
      .from('photo_quality_reports')
      .upsert(
        {
          id: report.id,
          asset_id: report.assetId,
          analyzer_id: report.analyzerId,
          analyzer_version: report.analyzerVersion,
          overall_score: report.overallScore,
          verdict: report.verdict,
          dimensions: report.dimensions,
          summary: report.summary,
          advice: report.advice,
        },
        { onConflict: 'asset_id' },
      )
      .select('*')
      .single<QualityReportRow>();
    if (error) fail('save quality report', error);

    analytics.track('photo_quality_checked', {
      score: report.overallScore,
      verdict: report.verdict,
      analyzer: report.analyzerId,
    });
    return toQualityReport(data);
  }

  async getQualityReport(assetId: UUID): Promise<PhotoQualityReport | null> {
    const { data, error } = await this.client
      .from('photo_quality_reports')
      .select('*')
      .eq('asset_id', assetId)
      .maybeSingle<QualityReportRow>();
    if (error) fail('get quality report', error);
    return data ? toQualityReport(data) : null;
  }

  async getQualityReports(assetIds: UUID[]): Promise<Record<UUID, PhotoQualityReport>> {
    if (assetIds.length === 0) return {};
    const { data, error } = await this.client
      .from('photo_quality_reports')
      .select('*')
      .in('asset_id', assetIds)
      .returns<QualityReportRow[]>();
    if (error) fail('get quality reports', error);
    return Object.fromEntries((data ?? []).map((row) => [row.asset_id, toQualityReport(row)]));
  }
}

/* --------------------------------------------------------------------- 3D */

/**
 * The 3D gateway in cloud mode.
 *
 * Requests go to our own server, which decides which provider to use and
 * holds the credentials. The client's job is to ask, and to read back rows
 * that row-level security has already scoped to this family.
 */
class SupabaseThreeDGateway implements ThreeDGateway {
  constructor(private readonly client: SupabaseClient) {}

  private async authorisedFetch(path: string, body: unknown): Promise<Record<string, unknown>> {
    if (!env.apiBaseUrl) {
      // A cloud database without our server means no route to a provider that
      // does not involve putting a vendor key on the phone. We refuse.
      throw new AppError('generation', 'no Project Memory API configured');
    }
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AppError('auth');

    let response: Response;
    try {
      response = await fetch(`${env.apiBaseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new AppError('network', String(error));
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      log.error('api call failed', { path, status: response.status, detail });
      throw new AppError('generation', `${response.status} ${detail}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async start(input: StartGenerationInput): Promise<ThreeDJob> {
    const payload = await this.authorisedFetch('/v1/three-d/jobs', {
      memoryId: input.memoryId,
      sourceAssetIds: input.sourceAssetIds,
      retryOfJobId: input.retryOfJobId ?? null,
    });
    analytics.track(input.retryOfJobId ? 'three_d_retried' : 'three_d_requested', {
      photoCount: input.sourceAssetIds.length,
      backend: 'supabase',
    });
    return toJob(payload.job as JobRow);
  }

  async get(jobId: UUID): Promise<ThreeDJob | null> {
    const { data, error } = await this.client
      .from('three_d_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle<JobRow>();
    if (error) fail('get job', error);
    return data ? toJob(data) : null;
  }

  async refresh(jobId: UUID): Promise<ThreeDJob> {
    // The server polls the provider and writes the row; we re-read it. Asking
    // the server to refresh first keeps a stalled provider from looking like a
    // stalled app.
    try {
      const payload = await this.authorisedFetch(`/v1/three-d/jobs/${jobId}/refresh`, {});
      const job = toJob(payload.job as JobRow);
      if (job.completedAt && job.status !== 'failed') {
        analytics.track('three_d_succeeded', { backend: 'supabase', attempt: job.attempt });
      } else if (job.status === 'failed') {
        analytics.track('three_d_failed', { backend: 'supabase', attempt: job.attempt });
      }
      return job;
    } catch (error) {
      // A refresh failure must not look like a generation failure: fall back
      // to whatever the database already knows.
      const existing = await this.get(jobId);
      if (existing) {
        log.warn('refresh failed, using stored job state', { jobId, error: String(error) });
        return existing;
      }
      throw error;
    }
  }

  async getModel(jobId: UUID): Promise<ThreeDModel | null> {
    const { data, error } = await this.client
      .from('three_d_models')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle<ModelRow>();
    if (error) fail('get model', error);
    return data ? toModel(data) : null;
  }

  async listForFamily(): Promise<ThreeDJob[]> {
    const { data, error } = await this.client
      .from('three_d_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<JobRow[]>();
    if (error) fail('list jobs', error);
    return (data ?? []).map(toJob);
  }

  async retry(jobId: UUID): Promise<ThreeDJob> {
    const previous = await this.get(jobId);
    if (!previous) throw new AppError('not_found', 'job');
    return this.start({
      memoryId: previous.memoryId,
      sourceAssetIds: previous.sourceAssetIds,
      retryOfJobId: previous.id,
    });
  }

  async cancel(jobId: UUID): Promise<void> {
    const { error } = await this.client
      .from('three_d_jobs')
      .update({
        status: 'failed',
        error_code: 'cancelled_by_parent',
        completed_at: nowIso(),
        progress: floorProgressFor('failed'),
        stage_index: stageIndexFor('failed'),
        updated_at: nowIso(),
      })
      .eq('id', jobId);
    if (error) fail('cancel job', error);
  }
}

/* ---------------------------------------------------------------- capsule */

class SupabaseCapsuleGateway implements CapsuleGateway {
  constructor(private readonly client: SupabaseClient) {}

  async listForChild(childId: UUID): Promise<CapsuleMessage[]> {
    const [{ data: explicit }, { data: memoryRows }] = await Promise.all([
      this.client
        .from('capsule_messages')
        .select('*')
        .eq('child_id', childId)
        .returns<CapsuleRow[]>(),
      this.client
        .from('memories')
        .select('*')
        .eq('child_id', childId)
        .not('future_message', 'is', null)
        .returns<MemoryRow[]>(),
    ]);

    const fromMemories: CapsuleMessage[] = (memoryRows ?? []).map((row) => ({
      id: `memory:${row.id}`,
      familyId: row.family_id,
      childId: row.child_id,
      authorId: row.created_by,
      format: 'text',
      body: row.future_message,
      assetId: null,
      deliverAt: null,
      unlockedAt: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return [...(explicit ?? []).map(toCapsule), ...fromMemories].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
}

/* ------------------------------------------------------------------ admin */

class SupabaseAdminGateway implements AdminGateway {
  constructor(
    private readonly client: SupabaseClient,
    private readonly isStaff: () => boolean,
  ) {}

  isAvailable(): boolean {
    // The flag only hides the UI. The database refuses staff queries from a
    // non-staff session regardless of what the client believes.
    return this.isStaff();
  }

  async overview(): Promise<AdminOverview> {
    const { data, error } = await this.client.rpc('admin_overview');
    if (error) fail('admin overview', error);
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      families: Number(row.families ?? 0),
      children: Number(row.children ?? 0),
      memories: Number(row.memories ?? 0),
      jobsByStatus: (row.jobs_by_status as Record<string, number>) ?? {},
      failedJobs: Number(row.failed_jobs ?? 0),
      estimatedSpendUsd: Number(row.estimated_spend_usd ?? 0),
    };
  }

  private async rows(jobs: ThreeDJob[]): Promise<AdminJobRow[]> {
    if (jobs.length === 0) return [];
    const jobIds = jobs.map((job) => job.id);
    const childIds = [...new Set(jobs.map((job) => job.childId))];
    const memoryIds = [...new Set(jobs.map((job) => job.memoryId))];

    const [{ data: children }, { data: memories }, { data: calls }, { data: reviews }] =
      await Promise.all([
        this.client.from('children').select('id, first_name').in('id', childIds).returns<{ id: string; first_name: string }[]>(),
        this.client.from('memories').select('id, title').in('id', memoryIds).returns<{ id: string; title: string }[]>(),
        this.client.from('provider_calls').select('*').in('job_id', jobIds).returns<ProviderCallRow[]>(),
        this.client.from('qa_reviews').select('*').in('job_id', jobIds).returns<QaReviewRow[]>(),
      ]);

    return jobs.map((job) => ({
      job,
      childFirstName: children?.find((row) => row.id === job.childId)?.first_name ?? '—',
      memoryTitle: memories?.find((row) => row.id === job.memoryId)?.title ?? '—',
      calls: (calls ?? []).filter((row) => row.job_id === job.id).map(toProviderCall),
      review: (() => {
        const found = (reviews ?? []).find((row) => row.job_id === job.id);
        return found ? toQaReview(found) : null;
      })(),
    }));
  }

  async listJobs(filter?: { status?: string; onlyFailed?: boolean }): Promise<AdminJobRow[]> {
    let query = this.client.from('three_d_jobs').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter?.onlyFailed) query = query.eq('status', 'failed');
    else if (filter?.status) query = query.eq('status', filter.status);

    const { data, error } = await query.returns<JobRow[]>();
    if (error) fail('admin list jobs', error);
    return this.rows((data ?? []).map(toJob));
  }

  async qaQueue(): Promise<AdminJobRow[]> {
    const { data, error } = await this.client
      .from('qa_queue')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
      .returns<JobRow[]>();
    if (error) fail('admin qa queue', error);
    return this.rows((data ?? []).map(toJob));
  }

  async submitReview(jobId: UUID, decision: QaDecision, notes: string | null): Promise<QaReview> {
    const { data, error } = await this.client.rpc('submit_qa_review', {
      p_job_id: jobId,
      p_decision: decision,
      p_notes: notes,
    });
    if (error) fail('submit qa review', error);
    return toQaReview(data as QaReviewRow);
  }

  async recentAudit(): Promise<AuditEvent[]> {
    const { data, error } = await this.client
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<AuditRow[]>();
    if (error) fail('admin audit', error);
    return (data ?? []).map(toAudit);
  }
}

/* ---------------------------------------------------------------- backend */

export class SupabaseBackend implements MemoryBackend {
  readonly key = 'supabase' as const;
  readonly auth: AuthGateway;
  readonly family: FamilyGateway;
  readonly children: ChildRepository;
  readonly memories: MemoryRepository;
  readonly assets: AssetRepository;
  readonly threeD: ThreeDGateway;
  readonly admin: AdminGateway;
  readonly capsule: CapsuleGateway;

  private readonly client: SupabaseClient;
  /**
   * Cached from the last successful session load, so repositories can build
   * storage paths without an await on every call. It is never a security
   * boundary — see the note at the top of this file.
   */
  private cachedFamilyId: UUID = '';
  private cachedIsStaff = false;

  constructor(url: string, anonKey: string) {
    this.client = createSupabaseClient(url, anonKey);

    const familyId = () => {
      if (!this.cachedFamilyId) throw new AppError('auth', 'no family in session');
      return this.cachedFamilyId;
    };

    const auth = new SupabaseAuthGateway(this.client);
    // Every path that establishes a session updates the cache, so the app
    // cannot end up building storage paths for a previous account.
    this.auth = {
      getSession: async () => {
        const session = await auth.getSession();
        this.remember(session);
        return session;
      },
      signUp: async (input) => {
        const session = await auth.signUp(input);
        this.remember(session);
        return session;
      },
      signIn: async (input) => {
        const session = await auth.signIn(input);
        this.remember(session);
        return session;
      },
      signOut: async () => {
        await auth.signOut();
        this.remember(null);
      },
      updateProfile: (patch) => auth.updateProfile(patch),
      deleteAccount: async () => {
        await auth.deleteAccount();
        this.remember(null);
      },
      isSocialAvailable: () => auth.isSocialAvailable(),
      signInWithProvider: (provider) => auth.signInWithProvider(provider),
    };

    this.family = new SupabaseFamilyGateway(this.client, familyId);
    this.children = new SupabaseChildRepository(this.client, familyId);
    this.memories = new SupabaseMemoryRepository(this.client, familyId);
    this.assets = new SupabaseAssetRepository(this.client, familyId);
    this.threeD = new SupabaseThreeDGateway(this.client);
    this.admin = new SupabaseAdminGateway(this.client, () => this.cachedIsStaff);
    this.capsule = new SupabaseCapsuleGateway(this.client);
  }

  private remember(session: AuthSession | null): void {
    this.cachedFamilyId = session?.familyId ?? '';
    this.cachedIsStaff = session?.profile.isStaff ?? false;
  }
}
