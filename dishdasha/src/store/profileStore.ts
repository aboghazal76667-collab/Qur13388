import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  DEMO_ADDRESSES,
  DEMO_CUSTOMER,
  DEMO_MEASUREMENTS,
  DEMO_NOTIFICATION_PREFS,
  DEMO_PRIVACY,
} from '@dd/data/demo';
import { ENV } from '@dd/config/env';
import type {
  Address,
  CustomerProfile,
  MeasurementProfile,
  NotificationPreferences,
  PrivacySettings,
} from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import { createStorage } from './persist';

type ProfileState = {
  customer: CustomerProfile;
  measurements: MeasurementProfile[];
  addresses: Address[];
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
  selectedMeasurementId: string | null;

  updateCustomer: (patch: Partial<CustomerProfile>) => void;
  upsertMeasurement: (profile: MeasurementProfile) => void;
  removeMeasurement: (id: string) => void;
  selectMeasurement: (id: string | null) => void;
  addAddress: (address: Omit<Address, 'id'>) => Address;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  setNotifications: (patch: Partial<NotificationPreferences>) => void;
  setPrivacy: (patch: Partial<PrivacySettings>) => void;
  resetToDemo: () => void;
};

const initial = () => ({
  customer: ENV.DEMO_MODE
    ? DEMO_CUSTOMER
    : {
        id: uuid(),
        name: '',
        phone: null,
        email: null,
        language: 'ar' as const,
        ageRange: null,
        favoriteTailorId: null,
        isDemo: false,
        createdAt: nowIso(),
      },
  measurements: ENV.DEMO_MODE ? DEMO_MEASUREMENTS : [],
  addresses: ENV.DEMO_MODE ? DEMO_ADDRESSES : [],
  notifications: DEMO_NOTIFICATION_PREFS,
  privacy: DEMO_PRIVACY,
  selectedMeasurementId: ENV.DEMO_MODE ? DEMO_MEASUREMENTS[0].id : null,
});

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...initial(),

      updateCustomer: (patch) => set({ customer: { ...get().customer, ...patch } }),

      upsertMeasurement: (profile) => {
        const existing = get().measurements;
        const index = existing.findIndex((m) => m.id === profile.id);
        const next = [...existing];
        if (index >= 0) next[index] = { ...profile, updatedAt: nowIso() };
        else next.push(profile);
        set({ measurements: next, selectedMeasurementId: profile.id });
      },

      // Soft delete: production history references these profiles, so a hard
      // delete would orphan an order's measurement snapshot.
      removeMeasurement: (id) =>
        set({
          measurements: get().measurements.map((m) =>
            m.id === id ? { ...m, deletedAt: nowIso() } : m,
          ),
          selectedMeasurementId:
            get().selectedMeasurementId === id ? null : get().selectedMeasurementId,
        }),

      selectMeasurement: (id) => set({ selectedMeasurementId: id }),

      addAddress: (address) => {
        const created: Address = { ...address, id: uuid() };
        const list = get().addresses.map((a) =>
          created.isDefault ? { ...a, isDefault: false } : a,
        );
        set({ addresses: [...list, created] });
        return created;
      },

      removeAddress: (id) => set({ addresses: get().addresses.filter((a) => a.id !== id) }),

      setDefaultAddress: (id) =>
        set({ addresses: get().addresses.map((a) => ({ ...a, isDefault: a.id === id })) }),

      setNotifications: (patch) => set({ notifications: { ...get().notifications, ...patch } }),

      setPrivacy: (patch) => set({ privacy: { ...get().privacy, ...patch } }),

      resetToDemo: () => set(initial()),
    }),
    { name: 'profile', storage: createStorage<ProfileState>() },
  ),
);

export const activeMeasurements = (list: MeasurementProfile[]) =>
  list.filter((m) => m.deletedAt === null);
