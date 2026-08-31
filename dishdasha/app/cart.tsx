import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { configSummary } from '@dd/components/cards';
import { Button, Card, EmptyState, Notice, Row, StickyBar, T } from '@dd/components/ui';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import { getTailor } from '@dd/data/tailors';
import { validateConfig } from '@dd/engine/design';
import { addMoney, formatMoney } from '@dd/engine/money';
import { calculatePrice } from '@dd/engine/pricing';
import { useI18n } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { cartCount, useCartStore } from '@dd/store/cartStore';
import { useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';

export default function Cart() {
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const cartTailorId = useCartStore((s) => s.tailorBusinessId);
  const favoriteTailorId = useProfileStore((s) => s.customer.favoriteTailorId);

  const tailorId = cartTailorId ?? favoriteTailorId;

  const priced = useMemo(
    () =>
      items.map((item) => ({
        item,
        price: calculatePrice({
          config: item.config,
          fabric: getFabric(item.config.fabricId),
          pattern: getPattern(item.config.embroideryPatternId),
          tailor: getTailor(tailorId),
          quantity: item.quantity,
        }),
        issues: validateConfig(item.config),
      })),
    [items, tailorId],
  );

  const subtotal = addMoney(priced.map((p) => p.price.total));
  const blocked = priced.some((p) => p.issues.length > 0);

  return (
    <>
      <Stack.Screen options={{ title: `${t('cart.title')} (${cartCount(items)})` }} />
      {items.length === 0 ? (
        <View style={{ flex: 1, backgroundColor: theme.color.bg, justifyContent: 'center' }}>
          <EmptyState
            title={t('cart.empty')}
            action={{ label: t('cart.emptyCta'), onPress: () => router.replace('/(tabs)/design') }}
          />
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
          <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
            {priced.map(({ item, price, issues }) => (
              <Card key={item.id} padded={false}>
                <Row align="stretch" gap={0}>
                  <View style={{ backgroundColor: theme.color.bgSunken, paddingHorizontal: theme.space.sm, justifyContent: 'center' }}>
                    <DishdashaFigure config={item.config} width={64} height={100} transparentBackground />
                  </View>
                  <View style={{ flex: 1, padding: theme.space.md, gap: 8 }}>
                    <T variant="small" weight="700">
                      {t('cart.item')}
                    </T>
                    <T variant="tiny" color={theme.color.textMuted} numberOfLines={2}>
                      {configSummary(item.config, L)}
                    </T>
                    {issues.length > 0 ? <Notice text={t('error.fabricUnavailable')} tone="warning" /> : null}
                    <Row justify="space-between">
                      <Row gap={theme.space.sm}>
                        <QtyButton label="−" onPress={() => setQuantity(item.id, item.quantity - 1)} />
                        <T variant="small" weight="700">
                          {item.quantity}
                        </T>
                        <QtyButton label="+" onPress={() => setQuantity(item.id, item.quantity + 1)} />
                      </Row>
                      <T variant="small" weight="700" color={theme.color.accent}>
                        {formatMoney(price.total, lang)}
                      </T>
                    </Row>
                    <Pressable onPress={() => remove(item.id)} accessibilityRole="button" hitSlop={6}>
                      <T variant="tiny" color={theme.color.danger}>
                        {t('common.delete')}
                      </T>
                    </Pressable>
                  </View>
                </Row>
              </Card>
            ))}
            <Notice text={t('checkout.colorDisclaimer')} tone="info" />
          </ScrollView>

          <StickyBar>
            <Row justify="space-between">
              <T variant="body" color={theme.color.textMuted}>
                {t('common.total')}
              </T>
              <T variant="title" color={theme.color.accent}>
                {formatMoney(subtotal, lang)}
              </T>
            </Row>
            <Button
              label={t('cart.checkout')}
              disabled={blocked}
              onPress={() => {
                track('checkout_started', { items: items.length, subtotal });
                router.push('/checkout');
              }}
              full
              size="lg"
            />
          </StickyBar>
        </View>
      )}
    </>
  );
}

const QtyButton: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={{
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.color.border,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <T variant="small" weight="700">
      {label}
    </T>
  </Pressable>
);
