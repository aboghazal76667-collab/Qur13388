import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEMO_ORDERS } from '@dd/data/demo';
import { ENV } from '@dd/config/env';
import { advanceOrder } from '@dd/engine/orders';
import type { Alteration, Order, OrderStatus, OrderStatusEvent } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import { createStorage } from './persist';

type OrdersState = {
  orders: Order[];
  alterations: Alteration[];

  addOrder: (order: Order) => void;
  advance: (orderId: string, by?: string | null) => void;
  setStatus: (orderId: string, status: OrderStatus, by?: string | null, note?: string) => void;
  cancel: (orderId: string) => void;
  requestAlteration: (input: Omit<Alteration, 'id' | 'createdAt' | 'status' | 'appliedToMeasurementProfileId'>) => Alteration;
  markAlterationApplied: (alterationId: string, measurementProfileId: string) => void;
  resetToDemo: () => void;
};

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: ENV.DEMO_MODE ? DEMO_ORDERS : [],
      alterations: [],

      addOrder: (order) => set({ orders: [order, ...get().orders] }),

      advance: (orderId, by = null) =>
        set({
          orders: get().orders.map((o) => (o.id === orderId ? advanceOrder(o, by) : o)),
        }),

      setStatus: (orderId, status, by = null, note) =>
        set({
          orders: get().orders.map((o) => {
            if (o.id !== orderId) return o;
            const event: OrderStatusEvent = { status, at: nowIso(), by, note: note ?? null };
            return { ...o, status, history: [...o.history, event], updatedAt: event.at };
          }),
        }),

      cancel: (orderId) => get().setStatus(orderId, 'cancelled', null, 'cancelled'),

      requestAlteration: (input) => {
        const alteration: Alteration = {
          ...input,
          id: uuid(),
          status: 'requested',
          // Never set implicitly: the customer must approve the profile update.
          appliedToMeasurementProfileId: null,
          createdAt: nowIso(),
        };
        set({ alterations: [alteration, ...get().alterations] });
        return alteration;
      },

      markAlterationApplied: (alterationId, measurementProfileId) =>
        set({
          alterations: get().alterations.map((a) =>
            a.id === alterationId
              ? { ...a, appliedToMeasurementProfileId: measurementProfileId, status: 'completed' }
              : a,
          ),
        }),

      resetToDemo: () => set({ orders: ENV.DEMO_MODE ? DEMO_ORDERS : [], alterations: [] }),
    }),
    { name: 'orders', storage: createStorage<OrdersState>() },
  ),
);
