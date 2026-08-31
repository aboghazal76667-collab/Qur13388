import { ACTIVE_MARKET } from '@dd/config/market';
import { getGarmentType } from '@dd/domain/garments';
import type {
  DesignConfig,
  Fabric,
  EmbroideryPattern,
  PriceBreakdown,
  PriceLine,
  TailorBusiness,
} from '@dd/domain/types';
import { addMoney, multiplyMoney, roundMoney } from './money';

export type PricingInput = {
  config: DesignConfig;
  fabric: Fabric | undefined;
  pattern: EmbroideryPattern | undefined;
  tailor: TailorBusiness | undefined;
  quantity: number;
  fulfilment?: 'pickup' | 'delivery';
  /** Percentage discount 0..1, or a fixed amount. Discount codes are data. */
  discount?: { kind: 'percent' | 'amount'; value: number } | null;
  /** Merchant-controlled. `null` means tax is not configured for this market. */
  taxRate?: number | null;
};

/**
 * Single source of price truth for studio, cart, checkout and orders.
 *
 * Deliberately explicit: every line is derived and labelled so the customer
 * sees exactly what they pay for, and the tailor dashboard can reconcile it.
 */
export const calculatePrice = (input: PricingInput): PriceBreakdown => {
  const {
    config,
    fabric,
    pattern,
    tailor,
    quantity,
    fulfilment = 'pickup',
    discount = null,
  } = input;

  const taxRate = input.taxRate === undefined ? ACTIVE_MARKET.taxRate : input.taxRate;
  const garment = getGarmentType(config.garmentTypeId);
  const lines: PriceLine[] = [];

  const fabricUnit = fabric?.pricePerGarment ?? 0;
  lines.push({ key: 'fabric', amount: multiplyMoney(fabricUnit, quantity) });

  // Tailoring labour: garment base, adjusted by the workshop's own positioning.
  const tailorFactor = tailor ? tailor.startingPrice / 14 : 1;
  const tailoringUnit = roundMoney(garment.baseTailoringPrice * tailorFactor);
  lines.push({ key: 'tailoring', amount: multiplyMoney(tailoringUnit, quantity) });

  const embroideryUnit = pattern?.surcharge ?? 0;
  if (embroideryUnit > 0) {
    lines.push({
      key: 'embroidery',
      amount: multiplyMoney(embroideryUnit, quantity),
      note: pattern?.name,
    });
  }

  // Component surcharges (piped collar, embroidered cuffs, long furakha…).
  let extrasUnit = 0;
  for (const component of garment.components) {
    const chosenId = config.componentOptions[component.id];
    const option = component.options.find((o) => o.id === chosenId);
    if (option && option.surcharge > 0) extrasUnit = addMoney([extrasUnit, option.surcharge]);
  }
  if (extrasUnit > 0) {
    lines.push({ key: 'extras', amount: multiplyMoney(extrasUnit, quantity) });
  }

  const goodsSubtotal = addMoney(lines.map((l) => l.amount));

  let deliveryFee = 0;
  if (fulfilment === 'delivery' && tailor?.offersDelivery) {
    const free =
      tailor.freeDeliveryOver !== null && goodsSubtotal >= tailor.freeDeliveryOver;
    deliveryFee = free ? 0 : tailor.deliveryFee;
    lines.push({ key: 'delivery', amount: deliveryFee });
  }

  let discountAmount = 0;
  if (discount) {
    discountAmount =
      discount.kind === 'percent'
        ? multiplyMoney(goodsSubtotal, Math.max(0, Math.min(1, discount.value)))
        : Math.min(discount.value, goodsSubtotal);
    if (discountAmount > 0) lines.push({ key: 'discount', amount: -discountAmount });
  }

  const taxableBase = addMoney([goodsSubtotal, deliveryFee, -discountAmount]);
  let taxAmount = 0;
  if (taxRate !== null && taxRate > 0) {
    taxAmount = multiplyMoney(taxableBase, taxRate);
    lines.push({ key: 'tax', amount: taxAmount });
  }

  return {
    currency: ACTIVE_MARKET.currency,
    lines,
    subtotal: goodsSubtotal,
    total: addMoney([taxableBase, taxAmount]),
    taxRate,
    quantity,
    computedAt: new Date().toISOString(),
  };
};

export const sumBreakdowns = (breakdowns: PriceBreakdown[]): number =>
  addMoney(breakdowns.map((b) => b.total));
