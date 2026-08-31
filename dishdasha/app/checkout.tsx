import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { TailorCard, configSummary } from '@dd/components/cards';
import { Badge, Button, Card, Chip, Notice, Row, Section, StickyBar, T } from '@dd/components/ui';
import { ENV } from '@dd/config/env';
import { ACTIVE_MARKET } from '@dd/config/market';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import { activeTailors, getTailor } from '@dd/data/tailors';
import type { OrderItem, PriceBreakdown } from '@dd/domain/types';
import { hashConfig, validateConfig } from '@dd/engine/design';
import { addMoney, formatMoney } from '@dd/engine/money';
import { createOrder } from '@dd/engine/orders';
import { calculatePrice } from '@dd/engine/pricing';
import { statusConfidence } from '@dd/engine/measurements';
import { useI18n, type StringKey } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { paymentProvider, paymentFromOutcome } from '@dd/services/payment';
import { useCartStore } from '@dd/store/cartStore';
import { activeMeasurements, useProfileStore } from '@dd/store/profileStore';
import { useOrdersStore } from '@dd/store/ordersStore';
import { theme } from '@dd/theme/tokens';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';

const LINE_LABEL: Record<string, StringKey> = {
  fabric: 'checkout.fabricCost',
  tailoring: 'checkout.tailoringCost',
  embroidery: 'checkout.embroideryCost',
  extras: 'checkout.extras',
  delivery: 'checkout.deliveryFee',
  discount: 'checkout.discountLine',
  tax: 'checkout.tax',
};

/**
 * CHECKOUT.
 *
 * The order is created only after the payment provider reports success. On a
 * simulated failure nothing is created and nothing is charged — that path is
 * reachable on purpose so it can be demonstrated rather than assumed.
 */
export default function Checkout() {
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const items = useCartStore((s) => s.items);
  const fulfilment = useCartStore((s) => s.fulfilment);
  const setFulfilment = useCartStore((s) => s.setFulfilment);
  const cartTailorId = useCartStore((s) => s.tailorBusinessId);
  const setTailor = useCartStore((s) => s.setTailor);
  const addressId = useCartStore((s) => s.addressId);
  const setAddress = useCartStore((s) => s.setAddress);
  const discount = useCartStore((s) => s.discount);
  const discountError = useCartStore((s) => s.discountError);
  const applyDiscount = useCartStore((s) => s.applyDiscount);
  const clearCart = useCartStore((s) => s.clear);

  const customer = useProfileStore((s) => s.customer);
  const measurements = useProfileStore((s) => s.measurements);
  const selectedMeasurementId = useProfileStore((s) => s.selectedMeasurementId);
  const selectMeasurement = useProfileStore((s) => s.selectMeasurement);
  const addresses = useProfileStore((s) => s.addresses);
  const addOrder = useOrdersStore((s) => s.addOrder);

  const [code, setCode] = useState('');
  const [paying, setPaying] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const tailorId = cartTailorId ?? customer.favoriteTailorId ?? activeTailors()[0]?.id ?? null;
  const tailor = getTailor(tailorId);
  const availableMeasurements = useMemo(() => activeMeasurements(measurements), [measurements]);
  const measurement = availableMeasurements.find((m) => m.id === selectedMeasurementId) ?? availableMeasurements[0];
  const address = addresses.find((a) => a.id === addressId) ?? addresses.find((a) => a.isDefault) ?? null;

  const linePrices = useMemo(
    () =>
      items.map((item) =>
        calculatePrice({
          config: item.config,
          fabric: getFabric(item.config.fabricId),
          pattern: getPattern(item.config.embroideryPatternId),
          tailor,
          quantity: item.quantity,
          fulfilment,
          discount: null,
        }),
      ),
    [items, tailor, fulfilment],
  );

  /** Order-level total: items, then delivery and discount applied once. */
  const orderPrice: PriceBreakdown = useMemo(() => {
    const goods = addMoney(linePrices.map((p) => p.subtotal));
    const merged = calculatePrice({
      config: items[0]?.config ?? { garmentTypeId: 'OMANI_DISHDASHA', fabricId: '', baseColorId: '', embroideryPatternId: null, threadColorIds: [], furakhaColorId: '', componentOptions: {} },
      fabric: undefined,
      pattern: undefined,
      tailor,
      quantity: 0,
      fulfilment,
      discount,
    });
    // `merged` only supplies the delivery/discount/tax mechanics; the goods
    // total comes from the per-item calculations above.
    const deliveryLine = merged.lines.find((l) => l.key === 'delivery');
    const deliveryFee =
      fulfilment === 'delivery' && tailor?.offersDelivery
        ? tailor.freeDeliveryOver !== null && goods >= tailor.freeDeliveryOver
          ? 0
          : tailor.deliveryFee
        : deliveryLine?.amount ?? 0;
    const discountAmount = discount
      ? discount.kind === 'percent'
        ? addMoney([goods * discount.value])
        : Math.min(discount.value, goods)
      : 0;
    const taxable = addMoney([goods, deliveryFee, -discountAmount]);
    const taxRate = ACTIVE_MARKET.taxRate;
    const taxAmount = taxRate ? addMoney([taxable * taxRate]) : 0;

    return {
      currency: ACTIVE_MARKET.currency,
      lines: [
        ...linePrices.flatMap((p) => p.lines.filter((l) => ['fabric', 'tailoring', 'embroidery', 'extras'].includes(l.key))),
        ...(deliveryFee > 0 ? [{ key: 'delivery' as const, amount: deliveryFee }] : []),
        ...(discountAmount > 0 ? [{ key: 'discount' as const, amount: -discountAmount }] : []),
        ...(taxAmount > 0 ? [{ key: 'tax' as const, amount: taxAmount }] : []),
      ],
      subtotal: goods,
      total: addMoney([taxable, taxAmount]),
      taxRate,
      quantity: items.reduce((n, i) => n + i.quantity, 0),
      computedAt: nowIso(),
    };
  }, [linePrices, items, tailor, fulfilment, discount]);

  const blocked =
    items.length === 0 ||
    !tailor ||
    !measurement ||
    (fulfilment === 'delivery' && !address) ||
    items.some((i) => validateConfig(i.config).length > 0);

  const pay = async (simulate: 'success' | 'failure') => {
    if (!tailor || !measurement) return;
    setPaying(true);
    setFailure(null);
    try {
      const session = await paymentProvider.createSession({
        orderDraftId: uuid(),
        amount: orderPrice.total,
        currency: orderPrice.currency,
        customerRef: customer.id,
        description: `${items.length} x custom dishdasha`,
      });
      const outcome = await paymentProvider.confirm(session.id, simulate);

      if (outcome.status !== 'paid') {
        // No order is created on failure: the cart survives untouched.
        setFailure(outcome.message ?? t('checkout.paymentFailed'));
        track('payment_failed', { provider: session.provider, amount: orderPrice.total });
        return;
      }

      const orderItems: OrderItem[] = items.map((item, index) => ({
        id: uuid(),
        config: item.config,
        configHash: hashConfig(item.config),
        quantity: item.quantity,
        measurementProfileId: measurement.id,
        // Frozen so a later measurement edit cannot rewrite production history.
        measurementSnapshot: measurement,
        price: linePrices[index],
        notes: item.notes,
      }));

      const order = createOrder({
        customerId: customer.id,
        tailor,
        branchId: tailor.branches[0]?.id ?? null,
        items: orderItems,
        fulfilment,
        addressId: fulfilment === 'delivery' ? (address?.id ?? null) : null,
        addressSnapshot: fulfilment === 'delivery' ? address : null,
        price: orderPrice,
        payment: null,
      });
      order.payment = paymentFromOutcome(order.id, session, outcome, nowIso());

      addOrder(order);
      clearCart();
      track('payment_success', { provider: session.provider, amount: orderPrice.total, simulated: session.isSimulated });
      track('order_created', { orderId: order.id, items: orderItems.length, total: orderPrice.total });
      router.replace(`/order/${order.id}`);
    } catch {
      setFailure(t('checkout.paymentFailed'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('checkout.title') }} />
      <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxl }}>
          {/* measurement */}
          <Section title={t('checkout.measurement')} action={{ label: t('common.edit'), onPress: () => router.push('/measurements') }}>
            {availableMeasurements.length === 0 ? (
              <Notice text={t('measure.customerWarn')} tone="warning" />
            ) : (
              <View style={{ gap: theme.space.sm }}>
                {availableMeasurements.map((m) => {
                  const selected = m.id === (measurement?.id ?? null);
                  return (
                    <Card
                      key={m.id}
                      onPress={() => selectMeasurement(m.id)}
                      style={{ borderColor: selected ? theme.color.accent : theme.color.border, borderWidth: selected ? 2 : 1 }}
                    >
                      <Row justify="space-between">
                        <View style={{ gap: 3 }}>
                          <T variant="small" weight="700">
                            {m.name}
                          </T>
                          <T variant="tiny" color={theme.color.textMuted}>
                            {t(`measure.status.${m.status}` as StringKey)} · {Math.round(statusConfidence(m.status) * 100)}%
                          </T>
                        </View>
                        {m.status === 'tailor_verified' ? <Badge label={t('measure.status.tailor_verified')} tone="success" /> : null}
                      </Row>
                    </Card>
                  );
                })}
                {measurement && measurement.status === 'customer_entered' ? (
                  <Notice text={t('measure.customerWarn')} tone="warning" />
                ) : null}
              </View>
            )}
          </Section>

          {/* tailor */}
          <Section title={t('checkout.tailor')}>
            <View style={{ gap: theme.space.sm }}>
              {activeTailors().map((candidate) => (
                <TailorCard
                  key={candidate.id}
                  tailor={candidate}
                  selected={candidate.id === tailorId}
                  onPress={() => setTailor(candidate.id)}
                />
              ))}
            </View>
          </Section>

          {/* fulfilment */}
          <Section title={t('checkout.delivery')}>
            <Row gap={theme.space.sm} wrap>
              <Chip label={t('checkout.pickup')} selected={fulfilment === 'pickup'} onPress={() => setFulfilment('pickup')} />
              {tailor?.offersDelivery ? (
                <Chip label={t('checkout.homeDelivery')} selected={fulfilment === 'delivery'} onPress={() => setFulfilment('delivery')} />
              ) : null}
            </Row>
            {fulfilment === 'delivery' ? (
              <View style={{ gap: theme.space.sm, marginTop: theme.space.sm }}>
                {addresses.map((a) => (
                  <Card
                    key={a.id}
                    onPress={() => setAddress(a.id)}
                    style={{ borderColor: a.id === address?.id ? theme.color.accent : theme.color.border, borderWidth: a.id === address?.id ? 2 : 1 }}
                  >
                    <T variant="small" weight="700">
                      {L(a.label)}
                    </T>
                    <T variant="tiny" color={theme.color.textMuted}>
                      {a.line1} · {a.area} · {a.city}
                    </T>
                  </Card>
                ))}
                {addresses.length === 0 ? <Notice text={t('checkout.addAddress')} tone="warning" /> : null}
              </View>
            ) : null}
          </Section>

          {/* discount */}
          <Section title={t('checkout.discount')}>
            <Row gap={theme.space.sm}>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                placeholder="EID10"
                placeholderTextColor={theme.color.textFaint}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.color.border,
                  borderRadius: theme.radius.sm,
                  padding: theme.space.md,
                  minHeight: theme.hit,
                  color: theme.color.text,
                  textAlign: lang === 'ar' ? 'right' : 'left',
                }}
              />
              <Button label={t('common.apply')} onPress={() => applyDiscount(code)} variant="secondary" />
            </Row>
            {discountError ? (
              <T variant="tiny" color={theme.color.danger}>
                {L({ ar: 'كود غير صالح', en: 'Invalid code' })}
              </T>
            ) : null}
            {discount ? (
              <T variant="tiny" color={theme.color.success}>
                {discount.code}
              </T>
            ) : null}
          </Section>

          {/* summary */}
          <Section title={t('checkout.summary')}>
            <Card>
              <View style={{ gap: theme.space.sm }}>
                {items.map((item, i) => (
                  <Row key={item.id} justify="space-between">
                    <T variant="tiny" color={theme.color.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                      {item.quantity} × {configSummary(item.config, L)}
                    </T>
                    <T variant="tiny">{formatMoney(linePrices[i].total, lang)}</T>
                  </Row>
                ))}
                <View style={{ height: 1, backgroundColor: theme.color.border, marginVertical: 4 }} />
                {orderPrice.lines
                  .filter((l) => ['delivery', 'discount', 'tax'].includes(l.key))
                  .map((line, i) => (
                    <Row key={`${line.key}-${i}`} justify="space-between">
                      <T variant="small" color={theme.color.textMuted}>
                        {t(LINE_LABEL[line.key])}
                      </T>
                      <T variant="small">{formatMoney(line.amount, lang)}</T>
                    </Row>
                  ))}
                <Row justify="space-between">
                  <T variant="heading">{t('checkout.total')}</T>
                  <T variant="heading" color={theme.color.accent}>
                    {formatMoney(orderPrice.total, lang)}
                  </T>
                </Row>
                {orderPrice.taxRate === null ? (
                  <T variant="tiny" color={theme.color.textFaint}>
                    {t('checkout.taxNotConfigured')}
                  </T>
                ) : null}
              </View>
            </Card>
            <Notice text={t('checkout.colorDisclaimer')} tone="info" />
            <Notice text={t('checkout.customMadeNote')} tone="warning" />
          </Section>

          {failure ? <Notice title={t('checkout.paymentFailed')} text={`${failure} — ${t('checkout.paymentFailedHint')}`} tone="danger" /> : null}
        </ScrollView>

        <StickyBar>
          {ENV.MOCK_PAYMENT_MODE ? <Notice text={t('checkout.mockNote')} tone="warning" /> : null}
          <Row justify="space-between">
            <T variant="body" color={theme.color.textMuted}>
              {t('checkout.total')}
            </T>
            <T variant="title" color={theme.color.accent}>
              {formatMoney(orderPrice.total, lang)}
            </T>
          </Row>
          {ENV.MOCK_PAYMENT_MODE ? (
            <Row gap={theme.space.sm}>
              <Button label={t('checkout.payDemoSuccess')} onPress={() => pay('success')} loading={paying} disabled={blocked} style={{ flex: 1 }} />
              <Button label={t('checkout.payDemoFailure')} variant="danger" onPress={() => pay('failure')} disabled={blocked || paying} style={{ flex: 1 }} />
            </Row>
          ) : (
            <Button label={t('checkout.pay')} onPress={() => pay('success')} loading={paying} disabled={blocked} full size="lg" />
          )}
        </StickyBar>
      </View>
    </>
  );
}
