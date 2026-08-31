import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { configSummary } from '@dd/components/cards';
import { Badge, Card, Chip, EmptyState, Notice, Row, Section, T } from '@dd/components/ui';
import { getTailor } from '@dd/data/tailors';
import type { Order, OrderStatus } from '@dd/domain/types';
import { formatMoney } from '@dd/engine/money';
import { DEFAULT_STATUS_FLOW, ordersRevenue } from '@dd/engine/orders';
import { useI18n, type StringKey } from '@dd/i18n';
import { useOrdersStore } from '@dd/store/ordersStore';
import { useSessionStore } from '@dd/store/sessionStore';
import { theme } from '@dd/theme/tokens';
import { isToday } from '@dd/utils/date';

/**
 * TAILOR OPERATING SYSTEM — production board.
 *
 * The eleven operational statuses, grouped as a column-per-stage board. This
 * is the workshop's view of reality; the customer sees the simplified five.
 */
export default function TailorDashboard() {
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const orders = useOrdersStore((s) => s.orders);
  const activeTailorId = useSessionStore((s) => s.activeTailorBusinessId);
  const tailor = getTailor(activeTailorId);

  const [stage, setStage] = useState<OrderStatus | 'all'>('all');

  const scoped = useMemo(
    // A workshop only ever sees its own orders. In production this is enforced
    // by row-level security, not by this filter.
    () => orders.filter((o) => !activeTailorId || o.tailorBusinessId === activeTailorId),
    [orders, activeTailorId],
  );

  const buckets = useMemo(() => {
    const map = new Map<OrderStatus, Order[]>();
    for (const status of DEFAULT_STATUS_FLOW) map.set(status, []);
    for (const order of scoped) {
      map.set(order.status, [...(map.get(order.status) ?? []), order]);
    }
    return map;
  }, [scoped]);

  const todayOrders = scoped.filter((o) => isToday(o.createdAt));
  const newOrders = buckets.get('received') ?? [];
  const awaiting = [...(buckets.get('received') ?? []), ...(buckets.get('confirmed') ?? [])];

  const visible = stage === 'all' ? scoped : (buckets.get(stage) ?? []);

  return (
    <>
      <Stack.Screen options={{ title: t('dash.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        <Notice text={`${L(tailor?.name)} · ${t('tailor.demoNotice')}`} tone="warning" />

        <Row gap={theme.space.md} wrap>
          <Metric label={t('dash.today')} value={String(todayOrders.length)} />
          <Metric label={t('dash.new')} value={String(newOrders.length)} />
          <Metric label={t('dash.awaiting')} value={String(awaiting.length)} />
          <Metric label={t('common.total')} value={formatMoney(ordersRevenue(scoped), lang)} />
        </Row>

        <Section title={t('dash.board')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.sm }}>
            <Row gap={theme.space.sm}>
              <Chip label={t('common.all')} selected={stage === 'all'} onPress={() => setStage('all')} small />
              {DEFAULT_STATUS_FLOW.map((status) => (
                <Chip
                  key={status}
                  label={`${t(`status.${status}` as StringKey)} (${buckets.get(status)?.length ?? 0})`}
                  selected={stage === status}
                  onPress={() => setStage(status)}
                  small
                />
              ))}
            </Row>
          </ScrollView>
        </Section>

        {visible.length === 0 ? (
          <EmptyState title={t('dash.noOrders')} />
        ) : (
          <View style={{ gap: theme.space.md }}>
            {visible.map((order) => (
              <Card key={order.id} onPress={() => router.push(`/dashboard/order/${order.id}`)} padded={false}>
                <Row align="stretch" gap={0}>
                  {order.items[0] ? (
                    <View style={{ backgroundColor: theme.color.bgSunken, paddingHorizontal: theme.space.sm, justifyContent: 'center' }}>
                      <DishdashaFigure config={order.items[0].config} width={56} height={88} transparentBackground />
                    </View>
                  ) : null}
                  <View style={{ flex: 1, padding: theme.space.md, gap: 6 }}>
                    <Row justify="space-between">
                      <T variant="small" weight="700">
                        {order.number}
                      </T>
                      <Badge label={t(`status.${order.status}` as StringKey)} tone="info" />
                    </Row>
                    {order.items[0] ? (
                      <T variant="tiny" color={theme.color.textMuted} numberOfLines={1}>
                        {configSummary(order.items[0].config, L)}
                      </T>
                    ) : null}
                    <Row justify="space-between">
                      <T variant="tiny" color={theme.color.textFaint}>
                        {t('dash.qty')}: {order.items.reduce((n, i) => n + i.quantity, 0)}
                      </T>
                      <Badge
                        label={order.payment?.status === 'paid' ? t('dash.paid.yes') : t('dash.paid.no')}
                        tone={order.payment?.status === 'paid' ? 'success' : 'warning'}
                      />
                    </Row>
                  </View>
                </Row>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Card style={{ minWidth: 140, flexGrow: 1 }}>
    <View style={{ gap: 4 }}>
      <T variant="tiny" color={theme.color.textMuted}>
        {label}
      </T>
      <T variant="title">{value}</T>
    </View>
  </Card>
);
