import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  AppText,
  Badge,
  Card,
  Divider,
  EmptyState,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../../src/components/primitives';
import { ThinkerClaimCard } from '../../src/components/ThinkerClaimCard';
import { useTheme } from '../../src/theme/ThemeProvider';
import { THINKER_BY_ID, claimsForThinker } from '../../src/knowledge/thinkers';

export default function ThinkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spacing } = useTheme();
  const thinker = id ? THINKER_BY_ID.get(id) : undefined;

  if (!thinker) {
    return (
      <Screen>
        <EmptyState title="مفكر غير موجود" message="تحقق من الرابط." />
      </Screen>
    );
  }

  const claims = claimsForThinker(thinker.id);
  const topics = Array.from(new Set(claims.map((c) => c.topicLabel)));

  return (
    <Screen>
      <Stack.Screen options={{ title: thinker.nameArabic }} />

      <Card>
        <AppText variant="title" weight="bold">
          {thinker.nameArabic}
        </AppText>
        <AppText variant="tiny" tone="faint" style={{ marginTop: 4 }}>
          {[thinker.nameTransliterated, thinker.lifespan, thinker.country]
            .filter((v) => v && v !== '—')
            .join(' · ')}
        </AppText>

        <Divider spacingY={spacing.md} />

        <AppText variant="tiny" tone="faint">
          المنهج
        </AppText>
        <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
          {thinker.methodSummary}
        </AppText>
      </Card>

      {thinker.methodPrinciples.length > 0 ? (
        <>
          <Spacer size={spacing.lg} />
          <SectionTitle hint="مبادئ منهجية معلنة — لا نتائج">مبادئه المنهجية</SectionTitle>
          <Card>
            {thinker.methodPrinciples.map((p, i) => (
              <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 8 }}>
                • {p}
              </AppText>
            ))}
          </Card>
        </>
      ) : null}

      {topics.length > 0 ? (
        <>
          <Spacer size={spacing.lg} />
          <SectionTitle>الموضوعات المسجّلة</SectionTitle>
          <Row gap={6}>
            {topics.map((t) => (
              <Badge key={t} label={t} tone="accent" />
            ))}
          </Row>
        </>
      ) : null}

      <Spacer size={spacing.xl} />
      <SectionTitle hint="كل ادعاء يحمل مصدره ودرجة توثيقه">الآراء المسجّلة</SectionTitle>

      {claims.length > 0 ? (
        claims.map((claim) => <ThinkerClaimCard key={claim.id} claim={claim} />)
      ) : (
        <Card tone="alt">
          <AppText variant="small" weight="bold">
            لا توجد آراء مسجّلة
          </AppText>
          <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
            {thinker.coverageNote}
          </AppText>
        </Card>
      )}

      {thinker.knownSources.length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle>المصادر المعروفة</SectionTitle>
          <Card>
            {thinker.knownSources.map((s, i) => (
              <View key={i} style={{ marginBottom: spacing.sm }}>
                <AppText variant="small">{s.title}</AppText>
                <AppText variant="tiny" tone="faint">
                  {[s.author, s.year, s.kind].filter(Boolean).join(' · ')}
                </AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Spacer size={spacing.lg} />
      <Card tone="alt">
        <AppText variant="tiny" tone="muted">
          حالة قاعدة البيانات: {thinker.coverageNote}
        </AppText>
      </Card>
    </Screen>
  );
}
