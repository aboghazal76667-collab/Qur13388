import React, { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../src/components/primitives';
import { useTheme } from '../src/theme/ThemeProvider';
import { useSettingsStore } from '../src/store/settingsStore';
import { checkHealth, resolveBaseUrl } from '../src/api/client';
import { TOTAL_VERSES, surahs } from '../src/quran/repository';
import type { ThemePreference } from '../src/types/app';

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'حسب النظام' },
  { id: 'light', label: 'فاتح' },
  { id: 'dark', label: 'داكن' },
];

export default function SettingsScreen() {
  const { palette, spacing, radii } = useTheme();
  const store = useSettingsStore();
  const settings = store.settings;

  const [urlDraft, setUrlDraft] = useState(settings.apiBaseUrl);
  const [health, setHealth] = useState<'unknown' | 'checking' | 'ok' | 'down'>('unknown');

  const resolved = resolveBaseUrl(settings.apiBaseUrl);

  const test = async () => {
    setHealth('checking');
    const ok = await checkHealth(resolveBaseUrl(urlDraft));
    setHealth(ok ? 'ok' : 'down');
  };

  return (
    <Screen>
      <SectionTitle>المظهر</SectionTitle>
      <Card>
        <AppText variant="small" weight="medium">
          السمة
        </AppText>
        <Row gap={6} style={{ marginTop: spacing.md }}>
          {THEME_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              selected={settings.theme === o.id}
              onPress={() => store.setTheme(o.id)}
              compact
            />
          ))}
        </Row>

        <Divider spacingY={spacing.lg} />

        <AppText variant="small" weight="medium">
          حجم خط المصحف
        </AppText>
        <Row gap={6} style={{ marginTop: spacing.md }}>
          {[0.85, 1, 1.15, 1.35, 1.6].map((scale) => (
            <Chip
              key={scale}
              label={`${Math.round(scale * 100)}%`}
              selected={Math.abs(settings.quranFontScale - scale) < 0.01}
              onPress={() => store.setQuranFontScale(scale)}
              compact
            />
          ))}
        </Row>
        <AppText variant="quran" tone="quran" style={{ marginTop: spacing.md }}>
          بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
        </AppText>
      </Card>

      <Spacer size={spacing.xl} />
      <SectionTitle hint="مفتاح الـAPI لا يوجد داخل التطبيق إطلاقًا، بل في الخادم">
        محرك التحليل
      </SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="small" weight="medium">
              تفعيل التحليل بمساعدة نموذج لغوي
            </AppText>
            <AppText variant="tiny" tone="faint" style={{ marginTop: 4 }}>
              عند الإيقاف، يعمل التطبيق بالكامل على الجهاز دون أي اتصال بالشبكة.
            </AppText>
          </View>
          <Switch
            value={settings.aiEnabled}
            onValueChange={store.setAiEnabled}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        </Row>

        <Divider spacingY={spacing.lg} />

        <AppText variant="small" weight="medium">
          عنوان الخادم
        </AppText>
        <AppText variant="tiny" tone="faint" style={{ marginTop: 4 }}>
          اتركه فارغًا ليُكتشف تلقائيًا من خادم Expo. العنوان الحالي: {resolved}
        </AppText>
        <TextInput
          value={urlDraft}
          onChangeText={setUrlDraft}
          placeholder="http://192.168.1.10:8787"
          placeholderTextColor={palette.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="left"
          style={{
            marginTop: spacing.md,
            backgroundColor: palette.surfaceAlt,
            borderRadius: radii.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: palette.border,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            color: palette.text,
          }}
        />

        <Row gap={spacing.sm} wrap={false} style={{ marginTop: spacing.md }}>
          <Button
            label="احفظ"
            variant="secondary"
            onPress={() => store.setApiBaseUrl(urlDraft.trim())}
            style={{ flex: 1 }}
          />
          <Button label="اختبر الاتصال" variant="ghost" onPress={test} style={{ flex: 1 }} />
        </Row>

        {health !== 'unknown' ? (
          <View style={{ marginTop: spacing.md }}>
            <Badge
              label={
                health === 'checking'
                  ? 'جارٍ الاختبار…'
                  : health === 'ok'
                    ? 'الخادم يعمل ✓'
                    : 'الخادم غير متاح — سيُستخدم المحرك المحلي'
              }
              tone={health === 'ok' ? 'good' : health === 'down' ? 'caution' : 'neutral'}
              size="md"
            />
          </View>
        ) : null}
      </Card>

      <Spacer size={spacing.xl} />
      <SectionTitle>قاعدة البيانات</SectionTitle>
      <Card>
        <Row gap={6}>
          <Badge label={`${surahs.length} سورة`} tone="neutral" />
          <Badge label={`${TOTAL_VERSES} آية`} tone="neutral" />
          <Badge label="نص عثماني" tone="neutral" />
          <Badge label="جذور ولواحق" tone="neutral" />
        </Row>
        <AppText variant="tiny" tone="muted" style={{ marginTop: spacing.md }}>
          النص القرآني والمورفولوجيا مضمّنان داخل التطبيق ويعملان دون إنترنت.
          لا يأتي أي نص قرآني من نموذج لغوي إطلاقًا.
        </AppText>
      </Card>

      <Spacer size={spacing.xl} />
      <SectionTitle>أدوات</SectionTitle>
      <Card onPress={() => router.push('/graph')} style={{ marginBottom: spacing.sm }}>
        <AppText variant="small" weight="medium">
          خريطة المعرفة
        </AppText>
        <AppText variant="tiny" tone="faint" style={{ marginTop: 4 }}>
          عرض العلاقات بين المفاهيم والجذور والآيات والادعاءات.
        </AppText>
      </Card>
      <Card onPress={() => router.push('/favorites')}>
        <AppText variant="small" weight="medium">
          المحفوظات
        </AppText>
      </Card>

      <Spacer size={spacing.xl} />
      <Card tone="alt">
        <AppText variant="small" weight="bold">
          حدود هذا التطبيق
        </AppText>
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          هذا التطبيق أداة بحث لغوي في النص القرآني، وليس مرجعًا للإفتاء ولا بديلًا عن
          الدراسة المتخصصة. ما يعرضه من استنتاجات هو قراءات قابلة للنقض، ويُصرَّح دائمًا
          بدرجة بعدها عن النص وبدرجة الثقة فيها.
        </AppText>
      </Card>
    </Screen>
  );
}
