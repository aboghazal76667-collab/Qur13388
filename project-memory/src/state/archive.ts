import { create } from 'zustand';

import { getBackend, type CreateChildInput, type CreateMemoryInput, type MemoryWithAssets } from '@/data';
import { toAppError } from '@/lib/errors';
import type { Child, Family, Memory, UUID } from '@/domain';

/**
 * The family archive.
 *
 * A small cache in front of the backend so the dashboard and the timeline do
 * not re-fetch on every navigation. Writes go straight through and then
 * refresh — optimistic updates are not worth the risk of a parent believing a
 * memory was saved when it was not.
 */
interface ArchiveState {
  family: Family | null;
  children: Child[];
  memoriesByChild: Record<UUID, Memory[]>;
  loading: boolean;
  error: unknown;

  load: () => Promise<void>;
  loadChild: (childId: UUID) => Promise<void>;
  addChild: (input: CreateChildInput) => Promise<Child>;
  removeChild: (childId: UUID) => Promise<void>;
  addMemory: (input: CreateMemoryInput) => Promise<Memory>;
  removeMemory: (memoryId: UUID, childId: UUID) => Promise<void>;
  getMemory: (memoryId: UUID) => Promise<MemoryWithAssets | null>;
  setOccasions: (keys: string[]) => Promise<void>;
  clear: () => void;
}

export const useArchive = create<ArchiveState>((set, get) => ({
  family: null,
  children: [],
  memoriesByChild: {},
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const backend = getBackend();
      const [family, children] = await Promise.all([
        backend.family.get(),
        backend.children.list(),
      ]);

      // Counts on the dashboard have to be right, so memories load with the
      // children rather than trickling in per card.
      const entries = await Promise.all(
        children.map(async (child) => [child.id, await backend.memories.listForChild(child.id)] as const),
      );

      set({
        family,
        children,
        memoriesByChild: Object.fromEntries(entries),
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: toAppError(error) });
    }
  },

  loadChild: async (childId) => {
    try {
      const memories = await getBackend().memories.listForChild(childId);
      set({ memoriesByChild: { ...get().memoriesByChild, [childId]: memories } });
    } catch (error) {
      set({ error: toAppError(error) });
    }
  },

  addChild: async (input) => {
    const child = await getBackend().children.create(input);
    set({
      children: [...get().children, child].sort((a, b) => a.dateOfBirth.localeCompare(b.dateOfBirth)),
      memoriesByChild: { ...get().memoriesByChild, [child.id]: [] },
    });
    return child;
  },

  removeChild: async (childId) => {
    await getBackend().children.remove(childId);
    const { [childId]: _removed, ...rest } = get().memoriesByChild;
    set({ children: get().children.filter((item) => item.id !== childId), memoriesByChild: rest });
  },

  addMemory: async (input) => {
    const memory = await getBackend().memories.create(input);
    const existing = get().memoriesByChild[input.childId] ?? [];
    set({
      memoriesByChild: {
        ...get().memoriesByChild,
        [input.childId]: [memory, ...existing].sort((a, b) =>
          b.occurredOn.localeCompare(a.occurredOn),
        ),
      },
    });
    return memory;
  },

  removeMemory: async (memoryId, childId) => {
    await getBackend().memories.remove(memoryId);
    const existing = get().memoriesByChild[childId] ?? [];
    set({
      memoriesByChild: {
        ...get().memoriesByChild,
        [childId]: existing.filter((item) => item.id !== memoryId),
      },
    });
  },

  getMemory: (memoryId) => getBackend().memories.get(memoryId),

  setOccasions: async (keys) => {
    const family = await getBackend().family.setOccasions(keys);
    set({ family });
  },

  clear: () => set({ family: null, children: [], memoriesByChild: {}, error: null }),
}));
