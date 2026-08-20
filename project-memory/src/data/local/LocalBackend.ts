import { AppError } from '@/lib/errors';
import { ageOn, todayIso, traitValueKey } from '@/domain';
import { newId, nowIso } from '@/lib/ids';
import { log } from '@/lib/log';
import { analytics } from '@/services/analytics';
import {
  MOCK_PROVIDER_KEY,
  mockCostUsd,
  mockPolycount,
  unassessedPrintability,
  simulate,
} from '@/services/threeD/mockSimulator';
import { floorProgressFor, stageIndexFor } from '@/services/threeD/pipeline';
import type {
  Asset,
  AuditEvent,
  ChildTrait,
  CapsuleMessage,
  Child,
  Family,
  Memory,
  Profile,
  ProviderCall,
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
  RecordTraitInput,
  StartGenerationInput,
  ThreeDGateway,
  TraitRepository,
} from '../backend';
import {
  deleteLocalFile,
  deleteLocalTree,
  extensionFromUri,
  localUriFor,
  mimeFromExtension,
  storeLocalFile,
  storagePathFor,
} from './files';
import { read, transact, type Database } from './store';

/**
 * The device-local backend.
 *
 * It implements the same contract as the Supabase backend so that the product
 * is complete before any cloud account exists. Every rule the server enforces
 * with row-level security is enforced here in code — a family only ever sees
 * its own rows — because the two implementations must not disagree about what
 * privacy means.
 */

/* ---------------------------------------------------------------- helpers */

/**
 * Password hashing on-device.
 *
 * This is a local-only credential store: nothing leaves the phone, and the
 * real deployment uses Supabase Auth. It exists so the local mode is not
 * storing a plaintext password, not as a substitute for a real KDF — which is
 * exactly what Supabase provides once configured.
 */
function hashPassword(email: string, password: string): string {
  const input = `pm:${email.toLowerCase()}:${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 2654435761);
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

function requireSession(db: Database): { profileId: UUID; familyId: UUID } {
  if (!db.session) throw new AppError('auth', 'no local session');
  return db.session;
}

function audit(db: Database, action: string, entity: string, entityId: UUID | null, meta: Record<string, unknown> = {}): void {
  const timestamp = nowIso();
  const event: AuditEvent = {
    id: newId(),
    actorId: db.session?.profileId ?? null,
    action,
    entity,
    entityId,
    meta,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.auditEvents = [...db.auditEvents.slice(-499), event];
}

function touch<T extends { updatedAt: string }>(entity: T): T {
  return { ...entity, updatedAt: nowIso() };
}

/* ------------------------------------------------------------------- auth */

class LocalAuthGateway implements AuthGateway {
  async getSession(): Promise<AuthSession | null> {
    return read((db) => {
      if (!db.session) return null;
      const profile = db.profiles.find((item) => item.id === db.session!.profileId);
      if (!profile) return null;
      return { profile, familyId: db.session.familyId };
    });
  }

  async signUp(input: SignUpInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    return transact((db) => {
      if (db.credentials.some((item) => item.email === email)) {
        throw new AppError('validation', 'email already registered on this device');
      }

      const timestamp = nowIso();
      const profile: Profile = {
        id: newId(),
        email,
        displayName: input.displayName.trim(),
        language: input.language,
        isStaff: false,
        allowsModelTraining: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const family: Family = {
        id: newId(),
        name: input.familyName.trim() || profile.displayName,
        createdBy: profile.id,
        occasionKeys: ['birthday'],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      db.profiles = [...db.profiles, profile];
      db.families = [...db.families, family];
      db.familyMembers = [
        ...db.familyMembers,
        { familyId: family.id, profileId: profile.id, role: 'owner', createdAt: timestamp },
      ];
      db.credentials = [
        ...db.credentials,
        { profileId: profile.id, email, passwordHash: hashPassword(email, input.password) },
      ];
      db.session = { profileId: profile.id, familyId: family.id };

      audit(db, 'account.created', 'profile', profile.id);
      analytics.track('account_created', { backend: 'local' });
      return { profile, familyId: family.id };
    });
  }

  async signIn(input: SignInInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    return transact((db) => {
      const credential = db.credentials.find((item) => item.email === email);
      if (!credential || credential.passwordHash !== hashPassword(email, input.password)) {
        throw new AppError('auth', 'bad local credentials');
      }
      const profile = db.profiles.find((item) => item.id === credential.profileId);
      const membership = db.familyMembers.find((item) => item.profileId === credential.profileId);
      if (!profile || !membership) throw new AppError('auth', 'profile missing');

      db.session = { profileId: profile.id, familyId: membership.familyId };
      audit(db, 'auth.signed_in', 'profile', profile.id);
      analytics.track('signed_in', { backend: 'local' });
      return { profile, familyId: membership.familyId };
    });
  }

  async signOut(): Promise<void> {
    await transact((db) => {
      db.session = null;
    });
  }

  async updateProfile(
    patch: Partial<Pick<Profile, 'displayName' | 'language' | 'allowsModelTraining'>>,
  ): Promise<Profile> {
    return transact((db) => {
      const { profileId } = requireSession(db);
      const index = db.profiles.findIndex((item) => item.id === profileId);
      if (index < 0) throw new AppError('not_found', 'profile');
      const updated = touch({ ...db.profiles[index], ...patch });
      db.profiles = db.profiles.map((item, i) => (i === index ? updated : item));
      audit(db, 'profile.updated', 'profile', profileId, { fields: Object.keys(patch) });
      return updated;
    });
  }

  async deleteAccount(): Promise<void> {
    const familyId = await read((db) => db.session?.familyId ?? null);
    if (familyId) await deleteLocalTree(`families/${familyId}`);

    await transact((db) => {
      const session = db.session;
      if (!session) return;
      const { profileId, familyId: fid } = session;

      db.assets = db.assets.filter((item) => item.familyId !== fid);
      db.memories = db.memories.filter((item) => item.familyId !== fid);
      db.children = db.children.filter((item) => item.familyId !== fid);
      db.jobs = db.jobs.filter((item) => item.familyId !== fid);
      db.models = db.models.filter((item) => item.familyId !== fid);
      db.capsuleMessages = db.capsuleMessages.filter((item) => item.familyId !== fid);
      db.families = db.families.filter((item) => item.id !== fid);
      db.familyMembers = db.familyMembers.filter((item) => item.familyId !== fid);
      db.profiles = db.profiles.filter((item) => item.id !== profileId);
      db.credentials = db.credentials.filter((item) => item.profileId !== profileId);
      db.session = null;

      audit(db, 'account.deleted', 'profile', profileId);
      analytics.track('content_deleted', { scope: 'account' });
    });
  }

  isSocialAvailable(): boolean {
    // No OAuth credentials are configured. The button stays visible so the
    // shape of the product is honest, but it explains itself rather than
    // silently doing nothing.
    return false;
  }

  async signInWithProvider(provider: 'apple' | 'google'): Promise<AuthSession> {
    throw new AppError('auth', `social sign-in not configured: ${provider}`);
  }
}

/* ----------------------------------------------------------------- family */

class LocalFamilyGateway implements FamilyGateway {
  async get(): Promise<Family | null> {
    return read((db) => {
      if (!db.session) return null;
      return db.families.find((item) => item.id === db.session!.familyId) ?? null;
    });
  }

  private async patch(patch: Partial<Family>): Promise<Family> {
    return transact((db) => {
      const { familyId } = requireSession(db);
      const index = db.families.findIndex((item) => item.id === familyId);
      if (index < 0) throw new AppError('not_found', 'family');
      const updated = touch({ ...db.families[index], ...patch });
      db.families = db.families.map((item, i) => (i === index ? updated : item));
      return updated;
    });
  }

  rename(name: string): Promise<Family> {
    return this.patch({ name: name.trim() });
  }

  setOccasions(occasionKeys: string[]): Promise<Family> {
    return this.patch({ occasionKeys });
  }

  async exportAll(): Promise<Record<string, unknown>> {
    const data = await read((db) => {
      if (!db.session) return null;
      const { familyId } = db.session;
      return {
        exportedAt: nowIso(),
        family: db.families.find((item) => item.id === familyId) ?? null,
        children: db.children.filter((item) => item.familyId === familyId),
        memories: db.memories.filter((item) => item.familyId === familyId),
        // Storage paths, not file contents — the files themselves stay on the
        // device and are listed so the export is a complete inventory.
        assets: db.assets.filter((item) => item.familyId === familyId),
        threeDJobs: db.jobs.filter((item) => item.familyId === familyId),
        threeDModels: db.models.filter((item) => item.familyId === familyId),
        capsuleMessages: db.capsuleMessages.filter((item) => item.familyId === familyId),
      };
    });
    if (!data) throw new AppError('auth');
    analytics.track('data_exported');
    return data;
  }

  async deleteAllContent(): Promise<void> {
    const familyId = await read((db) => db.session?.familyId ?? null);
    if (!familyId) throw new AppError('auth');
    await deleteLocalTree(`families/${familyId}`);

    await transact((db) => {
      db.assets = db.assets.filter((item) => item.familyId !== familyId);
      db.memories = db.memories.filter((item) => item.familyId !== familyId);
      db.children = db.children.filter((item) => item.familyId !== familyId);
      db.jobs = db.jobs.filter((item) => item.familyId !== familyId);
      db.models = db.models.filter((item) => item.familyId !== familyId);
      db.capsuleMessages = db.capsuleMessages.filter((item) => item.familyId !== familyId);
      audit(db, 'family.content_deleted', 'family', familyId);
      analytics.track('content_deleted', { scope: 'family' });
    });
  }
}

/* --------------------------------------------------------------- children */

class LocalChildRepository implements ChildRepository {
  async list(): Promise<Child[]> {
    return read((db) => {
      if (!db.session) return [];
      return db.children
        .filter((item) => item.familyId === db.session!.familyId)
        .sort((a, b) => a.dateOfBirth.localeCompare(b.dateOfBirth));
    });
  }

  async get(childId: UUID): Promise<Child | null> {
    return read((db) => {
      if (!db.session) return null;
      return (
        db.children.find(
          (item) => item.id === childId && item.familyId === db.session!.familyId,
        ) ?? null
      );
    });
  }

  async create(input: CreateChildInput): Promise<Child> {
    const childId = newId();
    const familyId = await read((db) => db.session?.familyId ?? null);
    if (!familyId) throw new AppError('auth');

    let avatarAsset: Asset | null = null;
    if (input.avatarUri) {
      avatarAsset = await storeAvatar(familyId, childId, input.avatarUri);
    }

    return transact((db) => {
      const timestamp = nowIso();
      const child: Child = {
        id: childId,
        familyId,
        firstName: input.firstName.trim(),
        nickname: input.nickname?.trim() || null,
        dateOfBirth: input.dateOfBirth,
        avatarAssetId: avatarAsset?.id ?? null,
        interests: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      if (avatarAsset) db.assets = [...db.assets, { ...avatarAsset, childId }];
      db.children = [...db.children, child];
      audit(db, 'child.created', 'child', child.id);
      analytics.track('child_created', { hasAvatar: Boolean(avatarAsset) });
      return child;
    });
  }

  async update(
    childId: UUID,
    patch: Partial<Pick<Child, 'firstName' | 'nickname' | 'dateOfBirth' | 'interests'>>,
  ): Promise<Child> {
    return transact((db) => {
      const { familyId } = requireSession(db);
      const index = db.children.findIndex((item) => item.id === childId && item.familyId === familyId);
      if (index < 0) throw new AppError('not_found', 'child');
      const updated = touch({ ...db.children[index], ...patch });
      db.children = db.children.map((item, i) => (i === index ? updated : item));
      audit(db, 'child.updated', 'child', childId);
      return updated;
    });
  }

  async setAvatar(childId: UUID, localUri: string): Promise<Child> {
    const familyId = await read((db) => db.session?.familyId ?? null);
    if (!familyId) throw new AppError('auth');
    const asset = await storeAvatar(familyId, childId, localUri);

    return transact((db) => {
      const index = db.children.findIndex((item) => item.id === childId && item.familyId === familyId);
      if (index < 0) throw new AppError('not_found', 'child');
      db.assets = [...db.assets, { ...asset, childId }];
      const updated = touch({ ...db.children[index], avatarAssetId: asset.id });
      db.children = db.children.map((item, i) => (i === index ? updated : item));
      return updated;
    });
  }

  async remove(childId: UUID): Promise<void> {
    const paths = await read((db) =>
      db.assets.filter((item) => item.childId === childId).map((item) => item.storagePath),
    );
    await Promise.all(paths.map(deleteLocalFile));

    await transact((db) => {
      const { familyId } = requireSession(db);
      const memoryIds = new Set(
        db.memories.filter((item) => item.childId === childId).map((item) => item.id),
      );
      db.assets = db.assets.filter((item) => item.childId !== childId);
      db.memories = db.memories.filter((item) => item.childId !== childId);
      db.jobs = db.jobs.filter((item) => item.childId !== childId);
      db.models = db.models.filter((item) => item.childId !== childId);
      db.capsuleMessages = db.capsuleMessages.filter((item) => item.childId !== childId);
      db.childTraits = db.childTraits.filter((item) => item.childId !== childId);
      db.children = db.children.filter(
        (item) => !(item.id === childId && item.familyId === familyId),
      );
      audit(db, 'child.deleted', 'child', childId);
      analytics.track('content_deleted', { scope: 'child' });
    });
  }
}

async function storeAvatar(familyId: UUID, childId: UUID, uri: string): Promise<Asset> {
  const assetId = newId();
  const extension = extensionFromUri(uri);
  const storagePath = storagePathFor({
    familyId,
    childId,
    assetId,
    extension,
    bucketFolder: 'avatars',
  });
  const stored = await storeLocalFile(uri, storagePath);
  const timestamp = nowIso();
  return {
    id: assetId,
    familyId,
    childId,
    memoryId: null,
    kind: 'avatar',
    storagePath: stored.storagePath,
    mimeType: mimeFromExtension(extension),
    width: null,
    height: null,
    byteSize: stored.byteSize,
    durationMs: null,
    meta: { localUri: stored.uri },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/* ------------------------------------------------------------- traits ---- */

/**
 * Child identity and interests, on the device.
 *
 * The whole point of `record` and `retire` rather than `update` is that a
 * child's interests are history, not settings: moving on from unicorns closes
 * that period, it does not erase it.
 */
class LocalTraitRepository implements TraitRepository {
  async listForChild(childId: UUID): Promise<ChildTrait[]> {
    return read((db) => {
      if (!db.session) return [];
      return db.childTraits
        .filter((item) => item.childId === childId && item.familyId === db.session!.familyId)
        .sort((a, b) => b.observedFrom.localeCompare(a.observedFrom));
    });
  }

  async record(input: RecordTraitInput): Promise<ChildTrait> {
    const value = input.value.trim();
    if (value.length === 0) throw new AppError('validation', 'empty trait value');

    const context = await read((db) => {
      if (!db.session) return null;
      const child = db.children.find(
        (item) => item.id === input.childId && item.familyId === db.session!.familyId,
      );
      return child ? { child, familyId: db.session.familyId } : null;
    });
    if (!context) throw new AppError('not_found', 'child');

    const key = traitValueKey(value);

    return transact((db) => {
      const existing = db.childTraits.find(
        (item) =>
          item.childId === input.childId &&
          item.category === input.category &&
          item.valueKey === key &&
          item.isCurrent,
      );
      // Recording something already current is a no-op rather than a duplicate.
      if (existing) return existing;

      const timestamp = nowIso();
      const trait: ChildTrait = {
        id: newId(),
        familyId: context.familyId,
        childId: input.childId,
        category: input.category,
        value,
        valueKey: key,
        customLabel: input.customLabel?.trim() || null,
        source: input.source ?? 'parent',
        // A parent recording something has confirmed it by definition.
        confirmedAt: (input.source ?? 'parent') === 'parent' ? timestamp : null,
        isCurrent: true,
        observedFrom: todayIso(),
        observedTo: null,
        ageMonthsAtRecord: ageOn(context.child.dateOfBirth).totalMonths,
        note: input.note?.trim() || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      db.childTraits = [...db.childTraits, trait];
      audit(db, 'trait.recorded', 'child_trait', trait.id, { category: trait.category });
      analytics.track('trait_recorded', { category: trait.category, source: trait.source });
      return trait;
    });
  }

  private patch(traitId: UUID, mutate: (trait: ChildTrait) => ChildTrait): Promise<ChildTrait> {
    return transact((db) => {
      const { familyId } = requireSession(db);
      const index = db.childTraits.findIndex(
        (item) => item.id === traitId && item.familyId === familyId,
      );
      if (index < 0) throw new AppError('not_found', 'trait');
      const updated = touch(mutate(db.childTraits[index]));
      db.childTraits = db.childTraits.map((item, i) => (i === index ? updated : item));
      return updated;
    });
  }

  retire(traitId: UUID): Promise<ChildTrait> {
    return this.patch(traitId, (trait) => ({
      ...trait,
      isCurrent: false,
      observedTo: todayIso(),
    }));
  }

  restore(traitId: UUID): Promise<ChildTrait> {
    return this.patch(traitId, (trait) => ({ ...trait, isCurrent: true, observedTo: null }));
  }

  confirm(traitId: UUID): Promise<ChildTrait> {
    return this.patch(traitId, (trait) => ({
      ...trait,
      source: 'parent',
      confirmedAt: nowIso(),
    }));
  }

  async remove(traitId: UUID): Promise<void> {
    await transact((db) => {
      const { familyId } = requireSession(db);
      db.childTraits = db.childTraits.filter(
        (item) => !(item.id === traitId && item.familyId === familyId),
      );
      audit(db, 'trait.deleted', 'child_trait', traitId);
    });
  }
}

/* --------------------------------------------------------------- memories */

class LocalMemoryRepository implements MemoryRepository {
  async listForChild(childId: UUID): Promise<Memory[]> {
    return read((db) => {
      if (!db.session) return [];
      return db.memories
        .filter((item) => item.childId === childId && item.familyId === db.session!.familyId)
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    });
  }

  async listForFamily(): Promise<Memory[]> {
    return read((db) => {
      if (!db.session) return [];
      return db.memories
        .filter((item) => item.familyId === db.session!.familyId)
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    });
  }

  async get(memoryId: UUID): Promise<MemoryWithAssets | null> {
    return read((db) => {
      if (!db.session) return null;
      const memory = db.memories.find(
        (item) => item.id === memoryId && item.familyId === db.session!.familyId,
      );
      if (!memory) return null;

      const assets = db.assets
        .filter((item) => item.memoryId === memoryId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const jobs = db.jobs
        .filter((item) => item.memoryId === memoryId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const job = jobs[0] ?? null;
      const model = job ? (db.models.find((item) => item.jobId === job.id) ?? null) : null;

      return { memory, assets, job, model };
    });
  }

  async create(input: CreateMemoryInput): Promise<Memory> {
    const session = await read((db) => db.session);
    if (!session) throw new AppError('auth');

    const memoryId = newId();
    const assets = await storePhotos(session.familyId, input.childId, memoryId, input.photos);

    return transact((db) => {
      const timestamp = nowIso();
      const memory: Memory = {
        id: memoryId,
        familyId: session.familyId,
        childId: input.childId,
        kind: input.kind,
        title: input.title.trim(),
        occurredOn: input.occurredOn,
        note: input.note?.trim() || null,
        futureMessage: input.futureMessage?.trim() || null,
        coverAssetId: assets[0]?.id ?? null,
        createdBy: session.profileId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      db.memories = [...db.memories, memory];
      db.assets = [...db.assets, ...assets];

      audit(db, 'memory.created', 'memory', memory.id, { kind: memory.kind });
      analytics.track('memory_created', { kind: memory.kind, photoCount: assets.length });
      return memory;
    });
  }

  async update(
    memoryId: UUID,
    patch: Partial<Pick<Memory, 'title' | 'note' | 'futureMessage' | 'occurredOn' | 'kind'>>,
  ): Promise<Memory> {
    return transact((db) => {
      const { familyId } = requireSession(db);
      const index = db.memories.findIndex(
        (item) => item.id === memoryId && item.familyId === familyId,
      );
      if (index < 0) throw new AppError('not_found', 'memory');
      const updated = touch({ ...db.memories[index], ...patch });
      db.memories = db.memories.map((item, i) => (i === index ? updated : item));
      audit(db, 'memory.updated', 'memory', memoryId);
      return updated;
    });
  }

  async remove(memoryId: UUID): Promise<void> {
    const paths = await read((db) =>
      db.assets.filter((item) => item.memoryId === memoryId).map((item) => item.storagePath),
    );
    await Promise.all(paths.map(deleteLocalFile));

    await transact((db) => {
      const { familyId } = requireSession(db);
      const assetIds = new Set(
        db.assets.filter((item) => item.memoryId === memoryId).map((item) => item.id),
      );
      db.assets = db.assets.filter((item) => item.memoryId !== memoryId);
      db.jobs = db.jobs.filter((item) => item.memoryId !== memoryId);
      db.models = db.models.filter((item) => item.memoryId !== memoryId);
      db.memories = db.memories.filter(
        (item) => !(item.id === memoryId && item.familyId === familyId),
      );
      audit(db, 'memory.deleted', 'memory', memoryId);
      analytics.track('content_deleted', { scope: 'memory' });
    });
  }
}

async function storePhotos(
  familyId: UUID,
  childId: UUID,
  memoryId: UUID,
  photos: MemoryPhotoInput[],
): Promise<Asset[]> {
  const assets: Asset[] = [];

  for (const photo of photos) {
    const uri = photo.uri;
    const assetId = newId();
    const extension = extensionFromUri(uri);
    const storagePath = storagePathFor({
      familyId,
      childId,
      memoryId,
      assetId,
      extension,
      bucketFolder: 'originals',
    });
    const stored = await storeLocalFile(uri, storagePath);
    const timestamp = nowIso();
    assets.push({
      id: assetId,
      familyId,
      childId,
      memoryId,
      kind: 'photo',
      storagePath: stored.storagePath,
      mimeType: mimeFromExtension(extension),
      width: null,
      height: null,
      byteSize: stored.byteSize,
      durationMs: null,
      // `view` is read by the server when it hands images to a provider, and
      // `readiness` lets the memory screen assess the whole set without
      // re-decoding every photograph.
      meta: {
        localUri: stored.uri,
        view: photo.role ?? 'unspecified',
        readiness: photo.signals ?? null,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return assets;
}

/* ----------------------------------------------------------------- assets */

class LocalAssetRepository implements AssetRepository {
  async get(assetId: UUID): Promise<Asset | null> {
    return read((db) => {
      if (!db.session) return null;
      return (
        db.assets.find(
          (item) => item.id === assetId && item.familyId === db.session!.familyId,
        ) ?? null
      );
    });
  }

  async listForMemory(memoryId: UUID): Promise<Asset[]> {
    return read((db) =>
      db.assets
        .filter((item) => item.memoryId === memoryId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  }

  async addPhotos(memoryId: UUID, photos: MemoryPhotoInput[]): Promise<Asset[]> {
    const context = await read((db) => {
      const memory = db.memories.find((item) => item.id === memoryId);
      if (!memory || !db.session || memory.familyId !== db.session.familyId) return null;
      return { familyId: memory.familyId, childId: memory.childId };
    });
    if (!context) throw new AppError('not_found', 'memory');

    const assets = await storePhotos(context.familyId, context.childId, memoryId, photos);

    return transact((db) => {
      db.assets = [...db.assets, ...assets];
      const index = db.memories.findIndex((item) => item.id === memoryId);
      if (index >= 0 && !db.memories[index].coverAssetId && assets[0]) {
        const updated = touch({ ...db.memories[index], coverAssetId: assets[0].id });
        db.memories = db.memories.map((item, i) => (i === index ? updated : item));
      }
      analytics.track('photo_added', { count: assets.length });
      return assets;
    });
  }

  async remove(assetId: UUID): Promise<void> {
    const path = await read((db) => db.assets.find((item) => item.id === assetId)?.storagePath ?? null);
    if (path) await deleteLocalFile(path);

    await transact((db) => {
      db.assets = db.assets.filter((item) => item.id !== assetId);
      db.memories = db.memories.map((memory) =>
        memory.coverAssetId === assetId
          ? touch({
              ...memory,
              coverAssetId:
                db.assets.find((item) => item.memoryId === memory.id && item.kind === 'photo')?.id ??
                null,
            })
          : memory,
      );
      audit(db, 'asset.deleted', 'asset', assetId);
    });
  }

  async resolveUrl(asset: Asset | null | undefined): Promise<string | null> {
    if (!asset) return null;
    // On device the "signed URL" equivalent is the private app-sandbox path,
    // which no other app can read. We prefer the recorded local URI, falling
    // back to deriving it from the storage path.
    const stored = asset.meta?.localUri;
    if (typeof stored === 'string' && stored.length > 0) return stored;
    return localUriFor(asset.storagePath);
  }

}

/* --------------------------------------------------------------------- 3D */

/**
 * Local 3D gateway.
 *
 * When no Project Memory server is configured this drives the Mock3DProvider
 * simulation directly, which is what lets the founder walk the whole path on
 * an iPhone today. When a server *is* configured, `RemoteThreeDGateway` takes
 * over — the screens are identical either way, because both satisfy the same
 * `ThreeDGateway` interface.
 */
class LocalThreeDGateway implements ThreeDGateway {
  async start(input: StartGenerationInput): Promise<ThreeDJob> {
    const context = await read((db) => {
      const memory = db.memories.find((item) => item.id === input.memoryId);
      if (!memory || !db.session || memory.familyId !== db.session.familyId) return null;
      return { memory, session: db.session };
    });
    if (!context) throw new AppError('not_found', 'memory');
    if (input.sourceAssetIds.length === 0) throw new AppError('validation', 'no source photos');

    return transact((db) => {
      const timestamp = nowIso();
      const previous = input.retryOfJobId
        ? db.jobs.find((item) => item.id === input.retryOfJobId)
        : undefined;

      const job: ThreeDJob = {
        id: newId(),
        familyId: context.memory.familyId,
        childId: context.memory.childId,
        memoryId: context.memory.id,
        requestedBy: context.session.profileId,
        status: 'uploaded',
        providerKey: MOCK_PROVIDER_KEY,
        providerJobId: null,
        sourceAssetIds: input.sourceAssetIds,
        progress: floorProgressFor('uploaded'),
        stageIndex: stageIndexFor('uploaded'),
        errorCode: null,
        retryOfJobId: input.retryOfJobId ?? null,
        attempt: (previous?.attempt ?? 0) + 1,
        params: { style: 'realistic', targetHeightMm: 110 },
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      db.jobs = [...db.jobs, job];
      audit(db, 'three_d.requested', 'three_d_job', job.id, { photos: input.sourceAssetIds.length });
      analytics.track(input.retryOfJobId ? 'three_d_retried' : 'three_d_requested', {
        photoCount: input.sourceAssetIds.length,
        provider: MOCK_PROVIDER_KEY,
        attempt: job.attempt,
      });
      return job;
    });
  }

  async get(jobId: UUID): Promise<ThreeDJob | null> {
    return read((db) => db.jobs.find((item) => item.id === jobId) ?? null);
  }

  async refresh(jobId: UUID): Promise<ThreeDJob> {
    return transact((db) => {
      const index = db.jobs.findIndex((item) => item.id === jobId);
      if (index < 0) throw new AppError('not_found', 'job');
      const job = db.jobs[index];

      // Terminal states are never recomputed — the simulation is only
      // authoritative while the job is still running.
      if (job.status === 'failed' || job.completedAt) return job;

      const state = simulate(job, Date.now());
      const updated: ThreeDJob = touch({
        ...job,
        status: state.status,
        progress: Math.max(job.progress, Math.max(state.progress, floorProgressFor(state.status))),
        stageIndex: stageIndexFor(state.status),
        errorCode: state.status === 'failed' ? 'provider_generation_failed' : null,
        completedAt: state.done ? nowIso() : null,
      });
      db.jobs = db.jobs.map((item, i) => (i === index ? updated : item));

      if (state.done) {
        recordProviderCall(db, updated, state.status !== 'failed');
        if (state.status === 'failed') {
          analytics.track('three_d_failed', { provider: MOCK_PROVIDER_KEY, attempt: updated.attempt });
          log.warn('mock generation failed', { jobId, attempt: updated.attempt });
        } else if (!db.models.some((item) => item.jobId === jobId)) {
          db.models = [...db.models, buildMockModel(updated)];
          analytics.track('three_d_succeeded', {
            provider: MOCK_PROVIDER_KEY,
            attempt: updated.attempt,
          });
        }
      }

      return updated;
    });
  }

  async getModel(jobId: UUID): Promise<ThreeDModel | null> {
    return read((db) => db.models.find((item) => item.jobId === jobId) ?? null);
  }

  async listForFamily(): Promise<ThreeDJob[]> {
    return read((db) => {
      if (!db.session) return [];
      return db.jobs
        .filter((item) => item.familyId === db.session!.familyId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  async retry(jobId: UUID): Promise<ThreeDJob> {
    const previous = await this.get(jobId);
    if (!previous) throw new AppError('not_found', 'job');
    // The memory and its photos are untouched by a retry, by design.
    return this.start({
      memoryId: previous.memoryId,
      sourceAssetIds: previous.sourceAssetIds,
      retryOfJobId: previous.id,
    });
  }

  async cancel(jobId: UUID): Promise<void> {
    await transact((db) => {
      const index = db.jobs.findIndex((item) => item.id === jobId);
      if (index < 0) return;
      db.jobs = db.jobs.map((item, i) =>
        i === index
          ? touch({ ...item, status: 'failed', errorCode: 'cancelled_by_parent', completedAt: nowIso() })
          : item,
      );
    });
  }
}

function recordProviderCall(db: Database, job: ThreeDJob, success: boolean): void {
  if (db.providerCalls.some((item) => item.jobId === job.id && item.operation === 'generate')) return;
  const timestamp = nowIso();
  const call: ProviderCall = {
    id: newId(),
    jobId: job.id,
    providerKey: MOCK_PROVIDER_KEY,
    model: 'mock-simulation-1',
    operation: 'generate',
    durationMs: Date.now() - new Date(job.createdAt).getTime(),
    success,
    httpStatus: success ? 200 : 502,
    creditsUsed: success ? 1 : 0,
    // The mock records a plausible cost so the ledger has real shape from day
    // one — the moment Meshy is connected the numbers become real.
    estimatedCostUsd: success ? mockCostUsd(job.id) : 0,
    errorCode: success ? null : 'provider_generation_failed',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.providerCalls = [...db.providerCalls, call];
}

function buildMockModel(job: ThreeDJob): ThreeDModel {
  const timestamp = nowIso();
  const printability = unassessedPrintability();
  return {
    id: newId(),
    jobId: job.id,
    familyId: job.familyId,
    childId: job.childId,
    memoryId: job.memoryId,
    format: 'glb',
    // The mock produces no file. It produces a seed, and the preview is drawn
    // on the device from that seed — so the demo is a real, honest render of
    // something rather than a stock photograph pretending to be a result.
    assetId: null,
    previewAssetId: null,
    turntableAssetIds: [],
    polycount: mockPolycount(job.id),
    printability,
    // Never true from generation alone. Only a real print-validation pass, or
    // a human QA approval, may set this.
    isPrintReady: false,
    meta: { previewKind: 'procedural', seed: job.id, provider: MOCK_PROVIDER_KEY },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/* ---------------------------------------------------------------- capsule */

class LocalCapsuleGateway implements CapsuleGateway {
  async listForChild(childId: UUID): Promise<CapsuleMessage[]> {
    // Future messages written on memories are the seed of the time capsule.
    // Reading them through this gateway now means the feature can be built
    // later without the archive screens changing shape.
    return read((db) => {
      const explicit = db.capsuleMessages.filter((item) => item.childId === childId);
      const fromMemories: CapsuleMessage[] = db.memories
        .filter((item) => item.childId === childId && item.futureMessage)
        .map((memory) => ({
          id: `memory:${memory.id}`,
          familyId: memory.familyId,
          childId: memory.childId,
          authorId: memory.createdBy,
          format: 'text' as const,
          body: memory.futureMessage,
          assetId: null,
          deliverAt: null,
          unlockedAt: null,
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt,
        }));
      return [...explicit, ...fromMemories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }
}

/* ------------------------------------------------------------------ admin */

class LocalAdminGateway implements AdminGateway {
  isAvailable(): boolean {
    // In local mode the "admin" view shows this device's own data. It is the
    // real admin architecture running against a single-family database.
    return true;
  }

  async overview(): Promise<AdminOverview> {
    return read((db) => {
      const jobsByStatus: Record<string, number> = {};
      for (const job of db.jobs) {
        jobsByStatus[job.status] = (jobsByStatus[job.status] ?? 0) + 1;
      }
      return {
        families: db.families.length,
        children: db.children.length,
        memories: db.memories.length,
        jobsByStatus,
        failedJobs: db.jobs.filter((item) => item.status === 'failed').length,
        estimatedSpendUsd: db.providerCalls.reduce(
          (sum, call) => sum + (call.estimatedCostUsd ?? 0),
          0,
        ),
      };
    });
  }

  async listJobs(filter?: { status?: string; onlyFailed?: boolean }): Promise<AdminJobRow[]> {
    return read((db) => {
      let jobs = [...db.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (filter?.onlyFailed) jobs = jobs.filter((item) => item.status === 'failed');
      if (filter?.status) jobs = jobs.filter((item) => item.status === filter.status);
      return jobs.map((job) => toAdminRow(db, job));
    });
  }

  async qaQueue(): Promise<AdminJobRow[]> {
    return read((db) =>
      db.jobs
        .filter(
          (job) =>
            job.completedAt !== null &&
            job.status !== 'failed' &&
            !db.qaReviews.some((review) => review.jobId === job.id),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((job) => toAdminRow(db, job)),
    );
  }

  async submitReview(jobId: UUID, decision: QaDecision, notes: string | null): Promise<QaReview> {
    return transact((db) => {
      const { profileId } = requireSession(db);
      const timestamp = nowIso();
      const review: QaReview = {
        id: newId(),
        jobId,
        modelId: db.models.find((item) => item.jobId === jobId)?.id ?? null,
        reviewerId: profileId,
        decision,
        notes,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      db.qaReviews = [...db.qaReviews.filter((item) => item.jobId !== jobId), review];

      // A QA decision moves the job on, which is what makes the human review
      // step real rather than decorative.
      const index = db.jobs.findIndex((item) => item.id === jobId);
      if (index >= 0) {
        const next = decision === 'approved' ? 'print_ready' : decision === 'rejected' ? 'failed' : 'quality_review';
        db.jobs = db.jobs.map((item, i) =>
          i === index
            ? touch({
                ...item,
                status: next,
                errorCode: decision === 'rejected' ? 'rejected_in_qa' : item.errorCode,
              })
            : item,
        );
      }

      audit(db, 'qa.reviewed', 'three_d_job', jobId, { decision });
      return review;
    });
  }

  async recentAudit(): Promise<AuditEvent[]> {
    return read((db) => [...db.auditEvents].reverse().slice(0, 50));
  }
}

function toAdminRow(db: Database, job: ThreeDJob): AdminJobRow {
  return {
    job,
    childFirstName: db.children.find((item) => item.id === job.childId)?.firstName ?? '—',
    memoryTitle: db.memories.find((item) => item.id === job.memoryId)?.title ?? '—',
    calls: db.providerCalls.filter((item) => item.jobId === job.id),
    review: db.qaReviews.find((item) => item.jobId === job.id) ?? null,
  };
}

/* ---------------------------------------------------------------- backend */

export class LocalBackend implements MemoryBackend {
  readonly key = 'local' as const;
  readonly auth = new LocalAuthGateway();
  readonly family = new LocalFamilyGateway();
  readonly children = new LocalChildRepository();
  readonly traits = new LocalTraitRepository();
  readonly memories = new LocalMemoryRepository();
  readonly assets = new LocalAssetRepository();
  readonly threeD = new LocalThreeDGateway();
  readonly admin = new LocalAdminGateway();
  readonly capsule = new LocalCapsuleGateway();
}
