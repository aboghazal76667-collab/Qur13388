import { useMemo } from 'react';

import { buildStyleMemory, usualConfig } from '@dd/engine/styleMemory';
import { useDesignStore, visibleDesigns } from '@dd/store/designStore';
import { useOrdersStore } from '@dd/store/ordersStore';
import { useProfileStore } from '@dd/store/profileStore';

/** Derived customer style memory — recomputed from orders and saved designs. */
export const useStyleMemory = () => {
  const customerId = useProfileStore((s) => s.customer.id);
  const orders = useOrdersStore((s) => s.orders);
  const designs = useDesignStore((s) => s.savedDesigns);

  return useMemo(
    () => buildStyleMemory(customerId, orders, visibleDesigns(designs)),
    [customerId, orders, designs],
  );
};

/** The configuration behind "order my usual dishdasha". */
export const useUsualConfig = () => {
  const orders = useOrdersStore((s) => s.orders);
  const designs = useDesignStore((s) => s.savedDesigns);
  return useMemo(() => usualConfig(orders, visibleDesigns(designs)), [orders, designs]);
};
