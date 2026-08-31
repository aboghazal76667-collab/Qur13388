import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { TailorCard } from '@dd/components/cards';
import { Notice } from '@dd/components/ui';
import { activeTailors } from '@dd/data/tailors';
import { useI18n } from '@dd/i18n';
import { useCartStore } from '@dd/store/cartStore';
import { theme } from '@dd/theme/tokens';

export default function Tailors() {
  const router = useRouter();
  const { t } = useI18n();
  const selected = useCartStore((s) => s.tailorBusinessId);

  return (
    <>
      <Stack.Screen options={{ title: t('tailor.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: theme.space.xxxl }}
      >
        <Notice text={t('tailor.demoNotice')} tone="warning" />
        <View style={{ gap: theme.space.md }}>
          {activeTailors().map((tailor) => (
            <TailorCard
              key={tailor.id}
              tailor={tailor}
              selected={tailor.id === selected}
              onPress={() => router.push(`/tailor/${tailor.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}
