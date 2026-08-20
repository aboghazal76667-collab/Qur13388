import { newId, nowIso } from '@/lib/ids';
import { log } from '@/lib/log';
import type { Child, Family, Memory, Profile } from '@/domain';

import { transact } from './store';

/**
 * Demo family — Ghazal and Aya.
 *
 * Seeded once, only into the device-local backend, and only when no account
 * exists yet. There are deliberately no photographs here: real children's
 * photographs must never live in a repository, so the demo profiles carry
 * initials and the parent adds their own images.
 */

export const DEMO_EMAIL = 'demo@projectmemory.app';
export const DEMO_PASSWORD = 'memories2026';

function isoYearsAgo(years: number, month: number, day: number): string {
  const year = new Date().getUTCFullYear() - years;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Local-mode password hash. Mirrors `LocalBackend.hashPassword` — kept in step
 * by the `demo account can sign in` test rather than by a shared import, so
 * the auth gateway stays self-contained.
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

export async function seedDemoDataIfEmpty(): Promise<void> {
  await transact((db) => {
    if (db.seededDemo || db.profiles.length > 0) return;

    const timestamp = nowIso();
    const profile: Profile = {
      id: newId(),
      email: DEMO_EMAIL,
      displayName: 'Demo Parent',
      language: 'en',
      // The demo account can open the admin area, because that is the only way
      // the founder can see the internal tools without a second account.
      isStaff: true,
      allowsModelTraining: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const family: Family = {
      id: newId(),
      name: 'Demo Family',
      createdBy: profile.id,
      occasionKeys: ['birthday', 'eid_al_fitr', 'first_day_school'],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const ghazal: Child = {
      id: newId(),
      familyId: family.id,
      firstName: 'Ghazal',
      nickname: null,
      dateOfBirth: isoYearsAgo(5, 4, 12),
      avatarAssetId: null,
      interests: ['unicorns', 'purple', 'the beach'],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const aya: Child = {
      id: newId(),
      familyId: family.id,
      firstName: 'Aya',
      nickname: null,
      dateOfBirth: isoYearsAgo(2, 9, 3),
      avatarAssetId: null,
      interests: ['cats', 'music'],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const memories: Memory[] = [
      {
        id: newId(),
        familyId: family.id,
        childId: ghazal.id,
        kind: 'first_day',
        title: 'Her first day at school',
        occurredOn: isoYearsAgo(1, 9, 8),
        note: 'She held my hand all the way to the gate, then let go and did not look back.',
        futureMessage: 'You were braver than I was that morning.',
        coverAssetId: null,
        createdBy: profile.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: newId(),
        familyId: family.id,
        childId: ghazal.id,
        kind: 'birthday',
        title: 'Turning five',
        occurredOn: isoYearsAgo(0, 4, 12),
        note: 'Purple cake, exactly as requested.',
        futureMessage: null,
        coverAssetId: null,
        createdBy: profile.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: newId(),
        familyId: family.id,
        childId: aya.id,
        kind: 'family_moment',
        title: 'A morning at the beach',
        occurredOn: isoYearsAgo(0, 6, 21),
        note: 'She was not sure about the sea until her sister took her in.',
        futureMessage: null,
        coverAssetId: null,
        createdBy: profile.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];

    db.profiles = [profile];
    db.families = [family];
    db.familyMembers = [
      { familyId: family.id, profileId: profile.id, role: 'owner', createdAt: timestamp },
    ];
    db.children = [ghazal, aya];
    db.memories = memories;
    db.credentials = [
      { profileId: profile.id, email: DEMO_EMAIL, passwordHash: hashPassword(DEMO_EMAIL, DEMO_PASSWORD) },
    ];
    db.seededDemo = true;

    log.debug('seeded demo family', { children: db.children.length, memories: memories.length });
  });
}
