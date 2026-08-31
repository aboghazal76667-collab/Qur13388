import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { OrderCard } from '@dd/components/cards';
import { Chip, EmptyState, Row, T } from '@dd/components/ui';
import { activeOrders, pastOrders } from '@dd/engine/orders';
import { useI18n } from '@dd/i18n';
import { useOrdersStore } from '@dd/store/ordersStore';
import { theme } from '@dd/theme/tokens';

export default function Orders() {
  const router = useRouter();
  const { t } = useI18n();
  const orders = useOrdersStore((s) => s.orders);
  const [tab, setTab] = useState<'active' | 'past'>('active');

  const list = useMemo(
    () => (tab === 'active' ? activeOrders(orders) : pastOrders(orders)),
    [orders, tab],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.bg }}
      contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
    >
      <Row gap={theme.space.sm}>
        <Chip label={t('orders.active')} selected={tab === 'active'} onPress={() => setTab('active')} />
        <Chip label={t('orders.past')} selected={tab === 'past'} onPress={() => setTab('past')} />
      </Row>

      {list.length === 0 ? (
        <EmptyState
          title={t('orders.empty')}
          action={{ label: t('cart.emptyCta'), onPress: () => router.push('/(tabs)/design') }}
        />
      ) : (
        <View style={{ gap: theme.space.md }}>
          {list.map((order) => (
            <OrderCard key={order.id} order={order} onPress={() => router.push(`/order/${order.id}`)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
