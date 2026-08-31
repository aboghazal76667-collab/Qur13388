import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { configSummary } from '@dd/components/cards';
import { Badge, Button, Card, EmptyState, Notice, Row, Section, T } from '@dd/components/ui';
import { getTailor } from '@dd/data/tailors';
import { CUSTOMER_STAGES, customerStage } from '@dd/engine/orders';
import { formatMoney } from '@dd/engine/money';
import { useI18n, type StringKey } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useCartStore } from '@dd/store/cartStore';
import { useOrdersStore } from '@dd/store/ordersStore';
import { theme } from '@dd/theme/tokens';
import { formatDate, formatDateTime } from '@dd/utils/date';

/**
 * CUSTOMER ORDER TRACKING.
 *
 * Deliberately the simplified five-stage view. The eleven operational statuses
 * belong to the workshop; showing "fabric allocated" to a customer is noise.
 */
export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const order = useOrdersStore((s) => s.orders.find((o) => o.id === id));
  const addToCart = useCartStore((s) => s.add);

  const stageIndex = useMemo(
    () => (order ? CUSTOMER_STAGES.indexOf(customerStage(order.status)) : -1),
    [order],
  );

  if (!order) {
    return (
      <>
        <Stack.Screen options={{ title: t('orders.details') }} />
        <View style={{ flex: 1, backgroundColor: theme.color.bg, justifyContent: 'center' }}>
          <EmptyState title={t('error.notFound')} action={{ label: t('common.back'), onPress: () => router.back() }} />
        </View>
      </>
    );
  }

  const tailor = getTailor(order.tailorBusinessId);

  return (
    <>
      <Stack.Screen options={{ title: order.number }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        <Card>
          <View style={{ gap: theme.space.md }}>
            <Row justify="space-between">
              <T variant="heading">{t('orders.tracking')}</T>
              <Badge
                label={t(`customerStatus.${customerStage(order.status)}` as StringKey)}
                tone={order.status === 'delivered' ? 'success' : 'info'}
              />
            </Row>
            <View style={{ gap: theme.space.md }}>
              {CUSTOMER_STAGES.map((stage, index) => {
                const done = index <= stageIndex;
                return (
                  <Row key={stage} gap={theme.space.md} align="center">
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: done ? theme.color.accent : theme.color.bgSunken,
                        borderWidth: 1,
                        borderColor: done ? theme.color.accent : theme.color.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {done ? <T variant="tiny" color="#FFFFFF" weight="700">✓</T> : null}
                    </View>
                    <T variant="small" color={done ? theme.color.text : theme.color.textFaint} weight={index === stageIndex ? '700' : '400'}>
                      {t(`customerStatus.${stage}` as StringKey)}
                    </T>
                  </Row>
                );
              })}
            </View>
            <Row justify="space-between">
              <T variant="tiny" color={theme.color.textMuted}>
                {t('orders.expected')}
              </T>
              <T variant="tiny" weight="700">
                {formatDate(order.expectedReadyAt, lang)}
              </T>
            </Row>
          </View>
        </Card>

        <Section title={t('orders.details')}>
          <View style={{ gap: theme.space.md }}>
            {order.items.map((item) => (
              <Card key={item.id} padded={false}>
                <Row align="stretch" gap={0}>
                  <View style={{ backgroundColor: theme.color.bgSunken, paddingHorizontal: theme.space.sm, justifyContent: 'center' }}>
                    <DishdashaFigure config={item.config} width={70} height={110} transparentBackground />
                  </View>
                  <View style={{ flex: 1, padding: theme.space.md, gap: 6 }}>
                    <T variant="small" weight="700">
                      {item.quantity} × {t('cart.item')}
                    </T>
                    <T variant="tiny" color={theme.color.textMuted}>
                      {configSummary(item.config, L)}
                    </T>
                    {item.measurementSnapshot ? (
                      <T variant="tiny" color={theme.color.textFaint}>
                        {item.measurementSnapshot.name} · {t(`measure.status.${item.measurementSnapshot.status}` as StringKey)}
                      </T>
                    ) : null}
                    <T variant="small" weight="700" color={theme.color.accent}>
                      {formatMoney(item.price.total, lang)}
                    </T>
                  </View>
                </Row>
              </Card>
            ))}
          </View>
        </Section>

        <Section title={t('checkout.tailor')}>
          <Card>
            <View style={{ gap: 6 }}>
              <T variant="small" weight="700">
                {L(tailor?.name)}
              </T>
              <T variant="tiny" color={theme.color.textMuted}>
                {order.fulfilment === 'pickup' ? t('checkout.pickup') : t('checkout.homeDelivery')}
              </T>
              {order.addressSnapshot ? (
                <T variant="tiny" color={theme.color.textFaint}>
                  {order.addressSnapshot.line1} · {order.addressSnapshot.area}
                </T>
              ) : null}
            </View>
          </Card>
        </Section>

        <Section title={t('checkout.payment')}>
          <Card>
            <View style={{ gap: 6 }}>
              <Row justify="space-between">
                <T variant="small">{t('checkout.total')}</T>
                <T variant="small" weight="700">
                  {formatMoney(order.price.total, lang)}
                </T>
              </Row>
              <Row justify="space-between">
                <T variant="tiny" color={theme.color.textMuted}>
                  {order.payment ? order.payment.provider : t('dash.paid.no')}
                </T>
                {order.payment ? (
                  <Badge
                    label={order.payment.status === 'paid' ? t('dash.paid.yes') : t('dash.paid.no')}
                    tone={order.payment.status === 'paid' ? 'success' : 'warning'}
                  />
                ) : null}
              </Row>
              {order.payment?.isSimulated ? <Notice text={t('checkout.mockNote')} tone="warning" /> : null}
            </View>
          </Card>
        </Section>

        <Section title={t('orders.placedOn')}>
          <Card>
            <View style={{ gap: 6 }}>
              {order.history.map((event, i) => (
                <Row key={i} justify="space-between">
                  <T variant="tiny" color={theme.color.textMuted}>
                    {t(`status.${event.status}` as StringKey)}
                  </T>
                  <T variant="tiny" color={theme.color.textFaint}>
                    {formatDateTime(event.at, lang)}
                  </T>
                </Row>
              ))}
            </View>
          </Card>
        </Section>

        <View style={{ gap: theme.space.sm }}>
          <Button
            label={t('orders.reorder')}
            onPress={() => {
              const first = order.items[0];
              if (!first) return;
              track('reorder_clicked', { source: 'order_detail', orderId: order.id });
              addToCart(first.config, {
                quantity: first.quantity,
                measurementProfileId: first.measurementProfileId,
                tailorBusinessId: order.tailorBusinessId,
              });
              router.push('/cart');
            }}
            full
          />
          <Button label={t('orders.alteration')} variant="secondary" onPress={() => router.push(`/alteration/${order.id}`)} full />
        </View>
      </ScrollView>
    </>
  );
}
