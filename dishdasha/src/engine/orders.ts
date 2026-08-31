import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusEvent,
  TailorBusiness,
} from '@dd/domain/types';
import { addDays, nowIso } from '@dd/utils/date';
import { shortCode, uuid } from '@dd/utils/id';
import { addMoney } from './money';

/**
 * Production workflow. The sequence is configurable per tailor in principle —
 * this is the platform default, and every transition is timestamped so
 * fulfilment time becomes a measurable metric later.
 */
export const DEFAULT_STATUS_FLOW: OrderStatus[] = [
  'received',
  'confirmed',
  'fabric_allocated',
  'cutting',
  'stitching',
  'embroidery',
  'finishing',
  'quality_check',
  'ready',
  'out_for_delivery',
  'delivered',
];

/** The customer sees a friendly five-stage view of the eleven-stage reality. */
export type CustomerStage = 'placed' | 'inProduction' | 'ready' | 'onTheWay' | 'delivered';

export const customerStage = (status: OrderStatus): CustomerStage => {
  switch (status) {
    case 'received':
    case 'confirmed':
      return 'placed';
    case 'fabric_allocated':
    case 'cutting':
    case 'stitching':
    case 'embroidery':
    case 'finishing':
    case 'quality_check':
      return 'inProduction';
    case 'ready':
      return 'ready';
    case 'out_for_delivery':
      return 'onTheWay';
    case 'delivered':
      return 'delivered';
    default:
      return 'placed';
  }
};

export const CUSTOMER_STAGES: CustomerStage[] = [
  'placed',
  'inProduction',
  'ready',
  'onTheWay',
  'delivered',
];

export const nextStatus = (
  status: OrderStatus,
  fulfilment: 'pickup' | 'delivery',
): OrderStatus | null => {
  const flow = fulfilment === 'pickup'
    ? DEFAULT_STATUS_FLOW.filter((s) => s !== 'out_for_delivery')
    : DEFAULT_STATUS_FLOW;
  const i = flow.indexOf(status);
  if (i < 0 || i === flow.length - 1) return null;
  return flow[i + 1];
};

export const isTerminal = (status: OrderStatus): boolean =>
  status === 'delivered' || status === 'cancelled';

export const advanceOrder = (order: Order, by: string | null = null): Order => {
  const next = nextStatus(order.status, order.fulfilment);
  if (!next) return order;
  const event: OrderStatusEvent = { status: next, at: nowIso(), by, note: null };
  return {
    ...order,
    status: next,
    history: [...order.history, event],
    updatedAt: event.at,
  };
};

export const orderNumber = (): string => {
  const d = new Date();
  const ym = `${d.getFullYear().toString().slice(2)}${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  return `OD-${ym}-${shortCode(4)}`;
};

export type CreateOrderInput = {
  customerId: string;
  tailor: TailorBusiness;
  branchId: string | null;
  items: OrderItem[];
  fulfilment: 'pickup' | 'delivery';
  addressId: string | null;
  addressSnapshot: Order['addressSnapshot'];
  price: Order['price'];
  payment: Order['payment'];
};

export const createOrder = (input: CreateOrderInput): Order => {
  const at = nowIso();
  // Expected date uses the slower end of the workshop's range: under-promise.
  const expected = addDays(at, input.tailor.productionDays.max);
  return {
    id: uuid(),
    number: orderNumber(),
    customerId: input.customerId,
    tailorBusinessId: input.tailor.id,
    branchId: input.branchId,
    items: input.items,
    status: 'received',
    history: [{ status: 'received', at, by: null, note: null }],
    fulfilment: input.fulfilment,
    addressId: input.addressId,
    addressSnapshot: input.addressSnapshot,
    price: input.price,
    payment: input.payment,
    expectedReadyAt: expected,
    createdAt: at,
    updatedAt: at,
  };
};

export const orderTotalQuantity = (order: Order): number =>
  order.items.reduce((n, item) => n + item.quantity, 0);

export const ordersRevenue = (orders: Order[]): number =>
  addMoney(orders.map((o) => o.price.total));

export const activeOrders = (orders: Order[]): Order[] =>
  orders.filter((o) => !isTerminal(o.status));

export const pastOrders = (orders: Order[]): Order[] =>
  orders.filter((o) => isTerminal(o.status));
