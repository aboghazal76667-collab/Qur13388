import { useEffect, useState } from 'react';

import { getBackend } from '@/data';
import type { UUID } from '@/domain';

/**
 * Resolves a child's avatar to a displayable URL.
 *
 * Two hops — asset row, then a viewer-scoped link — wrapped up so the cards
 * that need an avatar do not each re-implement the dance, and so the link is
 * requested fresh when the component mounts rather than being cached past its
 * expiry.
 */
export function useAvatarUri(avatarAssetId: UUID | null): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    if (!avatarAssetId) return undefined;

    const backend = getBackend();
    backend.assets
      .get(avatarAssetId)
      .then((asset) => backend.assets.resolveUrl(asset))
      .then((resolved) => {
        if (!cancelled) setUri(resolved);
      })
      .catch(() => {
        // A missing avatar falls back to the initial. Not worth an error state.
      });

    return () => {
      cancelled = true;
    };
  }, [avatarAssetId]);

  return uri;
}
