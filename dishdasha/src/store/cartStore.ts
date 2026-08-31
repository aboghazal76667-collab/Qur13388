import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { hashConfig, normalizeConfig } from '@dd/engine/design';
import type { CartItem, DesignConfig, FulfilmentMethod } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import { createStorage } from './persist';

export type DiscountCode = { code: string; kind: 'percent' | 'amount'; value: number };

/**
 * Demo discount codes. In production these are merchant-owned rows with
 * validity windows and usage limits — the shape is already compatible.
 */
export const DEMO_DISCOUNTS: DiscountCode[] = [
  { code: 'EID10', kind: 'percent', value: 0.1 },
  { code: 'WELCOME2', kind: 'amount', value: 2 },
];

type CartState = {
  items: CartItem[];
  fulfilment: FulfilmentMethod;
  addressId: string | null;
  tailorBusinessId: string | null;
  discount: DiscountCode | null;
  discountError: string | null;

  add: (config: DesignConfig, options?: Partial<CartItem>) => CartItem;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  setFulfilment: (method: FulfilmentMethod) => void;
  setAddress: (id: string | null) => void;
  setTailor: (id: string | null) => void;
  applyDiscount: (code: string) => boolean;
  clearDiscount: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      fulfilment: 'pickup',
      addressId: null,
      tailorBusinessId: null,
      discount: null,
      discountError: null,

      add: (config, options) => {
        const normalized = normalizeConfig(config);
        const hash = hashConfig(normalized);
        // The same configuration twice is a quantity change, not a second line.
        const existing = get().items.find(
          (i) =>
            i.configHash === hash &&
            i.measurementProfileId === (options?.measurementProfileId ?? null),
        );
        if (existing) {
          const updated = { ...existing, quantity: existing.quantity + (options?.quantity ?? 1) };
          set({ items: get().items.map((i) => (i.id === existing.id ? updated : i)) });
          return updated;
        }
        const item: CartItem = {
          id: uuid(),
          designId: options?.designId ?? null,
          config: normalized,
          configHash: hash,
          quantity: options?.quantity ?? 1,
          measurementProfileId: options?.measurementProfileId ?? null,
          tailorBusinessId: options?.tailorBusinessId ?? get().tailorBusinessId,
          notes: options?.notes ?? null,
          addedAt: nowIso(),
        };
        set({
          items: [...get().items, item],
          tailorBusinessId: get().tailorBusinessId ?? item.tailorBusinessId,
        });
        return item;
      },

      updateItem: (id, patch) =>
        set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),

      setQuantity: (id, quantity) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, quantity: Math.max(1, Math.min(20, quantity)) } : i,
          ),
        }),

      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

      clear: () => set({ items: [], discount: null, discountError: null }),

      setFulfilment: (fulfilment) => set({ fulfilment }),
      setAddress: (addressId) => set({ addressId }),
      setTailor: (tailorBusinessId) => set({ tailorBusinessId }),

      applyDiscount: (code) => {
        const match = DEMO_DISCOUNTS.find(
          (d) => d.code.toLowerCase() === code.trim().toLowerCase(),
        );
        if (!match) {
          set({ discount: null, discountError: 'invalid' });
          return false;
        }
        set({ discount: match, discountError: null });
        return true;
      },

      clearDiscount: () => set({ discount: null, discountError: null }),
    }),
    { name: 'cart', storage: createStorage<CartState>() },
  ),
);

export const cartCount = (items: CartItem[]) =>
  items.reduce((n, item) => n + item.quantity, 0);
