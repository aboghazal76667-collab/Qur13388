import { useMemo } from 'react';

import { getTailor } from '@dd/data/tailors';
import { calculatePrice } from '@dd/engine/pricing';
import type { DesignConfig, PriceBreakdown } from '@dd/domain/types';
import { useCatalogStore } from '@dd/store/catalogStore';

/**
 * Live price for a configuration, recomputed from the catalogue (including any
 * admin price overrides) rather than from a stored snapshot — so a merchant
 * price change is reflected in the studio immediately.
 */
export const usePricing = (
  config: DesignConfig,
  options?: {
    quantity?: number;
    tailorId?: string | null;
    fulfilment?: 'pickup' | 'delivery';
    discount?: { kind: 'percent' | 'amount'; value: number } | null;
  },
): PriceBreakdown => {
  const fabrics = useCatalogStore((s) => s.fabrics);
  const patterns = useCatalogStore((s) => s.patterns);

  return useMemo(() => {
    const fabric = fabrics.find((f) => f.id === config.fabricId);
    const pattern = patterns.find((p) => p.id === config.embroideryPatternId);
    return calculatePrice({
      config,
      fabric,
      pattern,
      tailor: getTailor(options?.tailorId ?? null),
      quantity: options?.quantity ?? 1,
      fulfilment: options?.fulfilment ?? 'pickup',
      discount: options?.discount ?? null,
    });
  }, [
    config,
    fabrics,
    patterns,
    options?.quantity,
    options?.tailorId,
    options?.fulfilment,
    options?.discount,
  ]);
};
