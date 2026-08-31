import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Card, EmptyState, Notice, Section, T } from '@dd/components/ui';
import { LEGAL_CONTACT, getLegalDoc } from '@dd/data/legal';
import { useI18n } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';

export default function LegalDocument() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const { t, L } = useI18n();

  const document = getLegalDoc(doc ?? '');

  if (!document) {
    return (
      <>
        <Stack.Screen options={{ title: t('profile.legal') }} />
        <View style={{ flex: 1, backgroundColor: theme.color.bg, justifyContent: 'center' }}>
          <EmptyState title={t('error.notFound')} action={{ label: t('common.back'), onPress: () => router.back() }} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: L(document.title) }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <Notice text={t('legal.reviewRequired')} tone="warning" />
        {document.sections.map((section, i) => (
          <Section key={i} title={L(section.heading)}>
            <Card>
              <T variant="small" color={theme.color.textMuted}>
                {L(section.body)}
              </T>
            </Card>
          </Section>
        ))}
        <T variant="tiny" color={theme.color.textFaint}>
          {LEGAL_CONTACT}
        </T>
      </ScrollView>
    </>
  );
}
