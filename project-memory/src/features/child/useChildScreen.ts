import { useCallback, useEffect, useState } from 'react';

import { getBackend } from '@/data';
import type { Asset, Memory, UUID } from '@/domain';

/**
 * Loads the cover photo for each memory on a timeline.
 *
 * Timelines are read far more often than they are written, so covers are
 * fetched in one pass per child rather than one request per card — the
 * difference is visible on a slow connection with a few years of memories.
 */
export function useMemoryCovers(memories: Memory[]): Record<UUID, Asset | null> {
  const [covers, setCovers] = useState<Record<UUID, Asset | null>>({});

  const key = memories.map((memory) => `${memory.id}:${memory.coverAssetId ?? ''}`).join('|');

  const load = useCallback(async () => {
    const backend = getBackend();
    const entries = await Promise.all(
      memories.map(async (memory) => {
        if (!memory.coverAssetId) return [memory.id, null] as const;
        const asset = await backend.assets.get(memory.coverAssetId).catch(() => null);
        return [memory.id, asset] as const;
      }),
    );
    setCovers(Object.fromEntries(entries));
    // `key` is the dependency that actually matters; `memories` is a new array
    // identity on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    load().catch(() => {
      if (!cancelled) setCovers({});
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return covers;
}
