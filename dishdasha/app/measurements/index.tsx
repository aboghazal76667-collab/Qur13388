import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Badge, Button, Card, EmptyState, Notice, Row, T } from '@dd/components/ui';
import { statusConfidence } from '@dd/engine/measurements';
import { useI18n, type StringKey } from '@dd/i18n';
import { activeMeasurements, useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';
import { formatDate } from '@dd/utils/date';

export default function Measurements() {
  const router = useRouter();
  const { t, lang } = useI18n();

  const measurements = useProfileStore((s) => s.measurements);
  const selectedId = useProfileStore((s) => s.selectedMeasurementId);
  const selectMeasurement = useProfileStore((s) => s.selectMeasurement);

  const list = useMemo(() => activeMeasurements(measurements), [measurements]);

  const tone = (status: string) =>
    status === 'tailor_verified' ? 'success' : status === 'needs_review' ? 'warning' : 'neutral';

  return (
    <>
      <Stack.Screen options={{ title: t('measure.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <Notice text={t('measure.aiSoon')} tone="info" />

        {list.length === 0 ? (
          <EmptyState title={t('measure.title')} action={{ label: t('measure.add'), onPress: () => router.push('/measurements/new') }} />
        ) : (
          <View style={{ gap: theme.space.md }}>
            {list.map((profile) => {
              const selected = profile.id === selectedId;
              return (
                <Card
                  key={profile.id}
                  onPress={() => {
                    selectMeasurement(profile.id);
                    router.push(`/measurements/${profile.id}`);
                  }}
                  style={{ borderColor: selected ? theme.color.accent : theme.color.border, borderWidth: selected ? 2 : 1 }}
                >
                  <View style={{ gap: theme.space.sm }}>
                    <Row justify="space-between">
                      <T variant="heading">{profile.name}</T>
                      <Badge
                        label={t(`measure.status.${profile.status}` as StringKey)}
                        tone={tone(profile.status) as 'success' | 'warning' | 'neutral'}
                      />
                    </Row>
                    <Row justify="space-between">
                      <T variant="tiny" color={theme.color.textMuted}>
                        {profile.measuredBy ?? t('measure.status.customer_entered')}
                      </T>
                      <T variant="tiny" color={theme.color.textFaint}>
                        {formatDate(profile.measuredAt, lang)}
                      </T>
                    </Row>
                    <Row gap={theme.space.lg} wrap>
                      <T variant="tiny" color={theme.color.textMuted}>
                        {t('fit.' + profile.fitPreference as StringKey)}
                      </T>
                      <T variant="tiny" color={theme.color.textMuted}>
                        {Object.keys(profile.values).length} {t('measure.title')}
                      </T>
                      <T variant="tiny" color={theme.color.accent} weight="700">
                        {Math.round(statusConfidence(profile.status) * 100)}%
                      </T>
                    </Row>
                    {profile.status === 'customer_entered' ? (
                      <T variant="tiny" color={theme.color.warning}>
                        {t('measure.customerWarn')}
                      </T>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <Button label={t('measure.add')} onPress={() => router.push('/measurements/new')} full />
      </ScrollView>
    </>
  );
}
