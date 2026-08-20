import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Banner, Card, Chip, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Memory plans.
 *
 * Placeholders, and labelled as such. No payment provider is connected, no
 * card details are collected, and nothing here is gated — every feature in the
 * app works on the free tier today. When payments arrive, this screen gains a
 * button; it does not need rebuilding.
 */
export default function Plans() {
  const theme = useTheme();
  const { t, isRtl } = useI18n();

  return (
    <Screen>
      <ScreenHeader title={t.plans.title} subtitle={t.plans.subtitle} />

      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.xl }}>
        <Banner tone="info" body={t.plans.notice} />

        {t.plans.tiers.map((tier) => (
          <Card key={tier.key}>
            <View style={{ gap: theme.spacing.md }}>
              <View
                style={{
                  flexDirection: isRtl ? 'row-reverse' : 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <Text variant="heading">{tier.name}</Text>
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
                  <Text variant="subheading" color="primary" autoAlign={false}>
                    {tier.price}
                  </Text>
                  <Text variant="micro" color="textFaint" autoAlign={false}>
                    {tier.key === 'free' ? '' : t.plans.perYear}
                  </Text>
                </View>
              </View>

              <Text variant="caption" color="textMuted">
                {tier.blurb}
              </Text>

              <View style={{ gap: theme.spacing.sm }}>
                {tier.features.map((feature) => (
                  <View
                    key={feature}
                    style={{
                      flexDirection: isRtl ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <Ionicons name="checkmark" size={15} color={theme.colors.success} />
                    <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <Chip
                  label={tier.key === 'free' ? t.plans.activeNow : t.common.comingSoon}
                  tone={tier.key === 'free' ? 'success' : 'neutral'}
                />
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
