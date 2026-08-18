import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import {
  AppText,
  Badge,
  Card,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../../src/components/primitives';
import { QuranOnlyBadge } from '../../src/components/QuranOnlyBadge';
import { useTheme } from '../../src/theme/ThemeProvider';
import { THINKERS, claimsForThinker } from '../../src/knowledge/thinkers';

const COVERAGE_LABEL: Record<string, string> = {
  none: 'لا توجد بيانات موثقة',
  partial: 'تغطية جزئية',
  good: 'تغطية جيدة',
};

export default function ThinkersTab() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <QuranOnlyBadge compact />
      <Spacer size={spacing.lg} />

      <AppText variant="title" weight="bold">
        المفكرون
      </AppText>
      <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
        تُعرض هنا مناهج وأطروحات مفكرين معاصرين بوصفها أطرًا تفسيرية تُختبر مقابل النص،
        لا بوصفها حقائق نهائية. ولا يُنسب رأي لأحد بغير مصدر.
      </AppText>

      <Spacer size={spacing.xl} />
      <SectionTitle hint="اضغط على أي مفكر لعرض منهجه وادعاءاته المسجّلة">القائمة</SectionTitle>

      {THINKERS.map((thinker) => {
        const claims = claimsForThinker(thinker.id);
        return (
          <Card
            key={thinker.id}
            style={{ marginBottom: spacing.md }}
            onPress={() => router.push({ pathname: '/thinker/[id]', params: { id: thinker.id } })}
          >
            <Row gap={8} style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="heading" weight="bold">
                  {thinker.nameArabic}
                </AppText>
                <AppText variant="tiny" tone="faint" style={{ marginTop: 2 }}>
                  {[thinker.nameTransliterated, thinker.lifespan, thinker.country]
                    .filter((v) => v && v !== '—')
                    .join(' · ')}
                </AppText>
              </View>
              <Badge
                label={COVERAGE_LABEL[thinker.dataCoverage]}
                tone={thinker.dataCoverage === 'none' ? 'external' : 'good'}
              />
            </Row>

            <AppText variant="small" tone="muted" style={{ marginTop: spacing.md }} numberOfLines={4}>
              {thinker.methodSummary}
            </AppText>

            <Row gap={6} style={{ marginTop: spacing.md }}>
              <Badge label={`${claims.length} ادعاء مسجّل`} tone="neutral" />
              <Badge label={`${thinker.knownSources.length} مصدر`} tone="neutral" />
            </Row>
          </Card>
        );
      })}

      <Spacer size={spacing.lg} />
      <Card tone="alt">
        <AppText variant="small" weight="bold">
          كيف تُضاف الآراء
        </AppText>
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          كل ادعاء في هذا القسم يجب أن يحمل مصدرًا (كتاب أو مقال أو تسجيل مع تحديد الموضع).
          إن لم يتوفر مصدر مباشر، يُعرض بدلًا منه: «لا توجد لدينا بيانات موثقة كافية عن موقف
          هذا المفكر في هذه المسألة» — ولا يُخمَّن الرأي ولا يُستنتج.
        </AppText>
      </Card>
    </Screen>
  );
}
