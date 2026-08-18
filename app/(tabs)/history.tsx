import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../../src/components/primitives';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useHistoryStore } from '../../src/store/historyStore';
import { useAnalysisStore } from '../../src/store/analysisStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { analyzeQuestion } from '../../src/analysis/pipeline';

export default function HistoryTab() {
  const { palette, spacing } = useTheme();
  const history = useHistoryStore();
  const analysis = useAnalysisStore();
  const settings = useSettingsStore((s) => s.settings);
  const [rerunning, setRerunning] = useState<string | null>(null);

  const rerun = async (question: string, id: string) => {
    setRerunning(id);
    try {
      const result = await analyzeQuestion(question, {
        aiEnabled: settings.aiEnabled,
        apiBaseUrl: settings.apiBaseUrl,
      });
      analysis.store(result);
      history.add(result);
      router.push({ pathname: '/analysis/[id]', params: { id: result.id } });
    } finally {
      setRerunning(null);
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="title" weight="bold">
          السجل
        </AppText>
        <Pressable onPress={() => router.push('/favorites')} hitSlop={8}>
          <Ionicons name="bookmark-outline" size={22} color={palette.textMuted} />
        </Pressable>
      </Row>

      <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
        الأسئلة السابقة محفوظة على هذا الجهاز فقط.
      </AppText>

      <Spacer size={spacing.lg} />

      {history.entries.length === 0 ? (
        <EmptyState
          title="لا توجد أسئلة بعد"
          message="اطرح سؤالك الأول من تبويب «اسأل» وسيظهر هنا."
        />
      ) : (
        <>
          <SectionTitle hint={`${history.entries.length} سؤال محفوظ`}>الأسئلة</SectionTitle>

          {history.entries.map((entry) => (
            <Card key={entry.id} style={{ marginBottom: spacing.md }}>
              <Pressable
                onPress={() => router.push({ pathname: '/analysis/[id]', params: { id: entry.id } })}
              >
                <AppText variant="body" weight="medium">
                  {entry.question}
                </AppText>
                <AppText variant="tiny" tone="faint" style={{ marginTop: 4 }}>
                  {new Date(entry.createdAt).toLocaleString('ar')}
                </AppText>
                <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }} numberOfLines={3}>
                  {entry.summary}
                </AppText>
              </Pressable>

              <Row gap={6} style={{ marginTop: spacing.md }}>
                <Badge
                  label={entry.engine === 'ai' ? 'بمساعدة نموذج' : 'تحليل محلي'}
                  tone={entry.engine === 'ai' ? 'accent' : 'neutral'}
                />
              </Row>

              <Row gap={spacing.sm} wrap={false} style={{ marginTop: spacing.md }}>
                <Button
                  label="أعد التحليل"
                  variant="secondary"
                  loading={rerunning === entry.id}
                  onPress={() => rerun(entry.question, entry.id)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="حذف"
                  variant="ghost"
                  onPress={() => history.remove(entry.id)}
                  style={{ flex: 1 }}
                />
              </Row>
            </Card>
          ))}

          <Spacer size={spacing.lg} />
          <Button label="مسح السجل كاملًا" variant="ghost" onPress={() => history.clear()} />
        </>
      )}
    </Screen>
  );
}
