import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { FabricCard, PatternCard } from '@dd/components/cards';
import { Badge, Button, Card, EmptyState, Notice, Row, Section, T } from '@dd/components/ui';
import { fabricsForTailor } from '@dd/data/fabrics';
import { patternsForTailor } from '@dd/data/embroidery';
import { getTailor } from '@dd/data/tailors';
import { formatMoney } from '@dd/engine/money';
import { ltr, useI18n } from '@dd/i18n';
import { useCartStore } from '@dd/store/cartStore';
import { useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';

export default function TailorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const tailor = getTailor(id ?? null);
  const setTailor = useCartStore((s) => s.setTailor);
  const updateCustomer = useProfileStore((s) => s.updateCustomer);

  if (!tailor) {
    return (
      <>
        <Stack.Screen options={{ title: t('tailor.title') }} />
        <View style={{ flex: 1, backgroundColor: theme.color.bg, justifyContent: 'center' }}>
          <EmptyState title={t('error.notFound')} action={{ label: t('common.back'), onPress: () => router.back() }} />
        </View>
      </>
    );
  }

  const fabrics = fabricsForTailor(tailor.id);
  const patterns = patternsForTailor(tailor.id).filter((p) => p.motif !== 'none');

  return (
    <>
      <Stack.Screen options={{ title: L(tailor.name) }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        {tailor.isDemoData ? <Notice text={t('tailor.demoNotice')} tone="warning" /> : null}

        <Card>
          <View style={{ gap: theme.space.md }}>
            <Row gap={theme.space.md}>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: theme.radius.sm,
                  backgroundColor: tailor.logoColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <T variant="heading" color="#FFFFFF">
                  {tailor.logoInitials}
                </T>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="heading">{L(tailor.name)}</T>
                <T variant="tiny" color={theme.color.textMuted}>
                  {tailor.serviceAreas.map((a) => L(a)).join(' · ')}
                </T>
              </View>
            </Row>
            <T variant="small" color={theme.color.textMuted}>
              {L(tailor.about)}
            </T>
            <Row justify="space-between">
              <T variant="tiny" color={theme.color.textMuted}>
                {t('tailor.productionTime')}
              </T>
              <T variant="tiny" weight="700">
                {tailor.productionDays.min}–{tailor.productionDays.max} {t('common.days')}
              </T>
            </Row>
            <Row justify="space-between">
              <T variant="tiny" color={theme.color.textMuted}>
                {t('tailor.startingFrom')}
              </T>
              <T variant="tiny" weight="700" color={theme.color.accent}>
                {formatMoney(tailor.startingPrice, lang)}
              </T>
            </Row>
            <Row gap={theme.space.sm} wrap>
              {tailor.offersPickup ? <Badge label={t('checkout.pickup')} tone="success" /> : null}
              {tailor.offersDelivery ? <Badge label={`${t('checkout.homeDelivery')} · ${formatMoney(tailor.deliveryFee, lang)}`} tone="info" /> : null}
            </Row>
          </View>
        </Card>

        <Section title={t('tailor.branches')}>
          <View style={{ gap: theme.space.sm }}>
            {tailor.branches.map((branch) => (
              <Card key={branch.id}>
                <Row justify="space-between">
                  <View style={{ gap: 3 }}>
                    <T variant="small" weight="700">
                      {L(branch.name)}
                    </T>
                    <T variant="tiny" color={theme.color.textMuted}>
                      {L(branch.area)}
                    </T>
                  </View>
                  <T variant="tiny" color={theme.color.textFaint}>
                    {ltr(branch.phone)}
                  </T>
                </Row>
              </Card>
            ))}
          </View>
        </Section>

        {fabrics.length > 0 ? (
          <Section title={t('discover.fabrics')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
              {fabrics.map((fabric) => (
                <FabricCard key={fabric.id} fabric={fabric} />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {patterns.length > 0 ? (
          <Section title={t('discover.patterns')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
              {patterns.slice(0, 10).map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        <Button
          label={t('tailor.select')}
          onPress={() => {
            setTailor(tailor.id);
            updateCustomer({ favoriteTailorId: tailor.id });
            router.back();
          }}
          full
          size="lg"
        />
      </ScrollView>
    </>
  );
}
