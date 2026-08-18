import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  AppText,
  Button,
  Card,
  LoadingBlock,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../../src/components/primitives';
import { QuranOnlyBadge } from '../../src/components/QuranOnlyBadge';
import { useTheme } from '../../src/theme/ThemeProvider';
import { analyzeQuestion, STAGE_LABELS, type AnalysisStage } from '../../src/analysis/pipeline';
import { useAnalysisStore } from '../../src/store/analysisStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { SAMPLE_QUESTIONS } from '../../src/knowledge/concepts';

export default function AskScreen() {
  const { palette, spacing, radii } = useTheme();
  const [question, setQuestion] = useState('');
  const [stage, setStage] = useState<AnalysisStage | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const settings = useSettingsStore((s) => s.settings);
  const analysis = useAnalysisStore();
  const history = useHistoryStore();

  const run = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || analysis.running) return;

      Haptics.selectionAsync().catch(() => {});
      analysis.setRunning(true, 'analyzing-question');
      setStage('analyzing-question');

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await analyzeQuestion(trimmed, {
          aiEnabled: settings.aiEnabled,
          apiBaseUrl: settings.apiBaseUrl,
          signal: controller.signal,
          onStage: setStage,
        });
        analysis.store(result);
        history.add(result);
        router.push({ pathname: '/analysis/[id]', params: { id: result.id } });
      } catch (error) {
        analysis.setError(error instanceof Error ? error.message : 'تعذّر إتمام التحليل.');
      } finally {
        setStage(null);
        analysis.setRunning(false);
      }
    },
    [analysis, history, settings.aiEnabled, settings.apiBaseUrl]
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <AppText variant="title" weight="bold">
            Quran Intelligence
          </AppText>
          <AppText variant="small" tone="muted">
            دراسة القرآن من داخل القرآن
          </AppText>
        </View>
        <Row gap={14} wrap={false}>
          <Pressable onPress={() => router.push('/search')} hitSlop={8}>
            <Ionicons name="search-outline" size={22} color={palette.textMuted} />
          </Pressable>
          <Pressable onPress={() => router.push('/favorites')} hitSlop={8}>
            <Ionicons name="bookmark-outline" size={22} color={palette.textMuted} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={palette.textMuted} />
          </Pressable>
        </Row>
      </View>

      <Spacer size={spacing.lg} />
      <QuranOnlyBadge />
      <Spacer size={spacing.xl} />

      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: radii.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.borderStrong,
          padding: spacing.lg,
        }}
      >
        <AppText variant="heading" weight="bold">
          اسأل القرآن
        </AppText>
        <AppText variant="tiny" tone="faint" style={{ marginTop: 4 }}>
          اكتب سؤالك، وسيُفكَّك إلى مفاهيم وجذور ومواضع قبل الإجابة.
        </AppText>

        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="مثال: ما الفرق بين النبي والرسول؟"
          placeholderTextColor={palette.textFaint}
          multiline
          textAlign="right"
          textAlignVertical="top"
          style={{
            marginTop: spacing.md,
            minHeight: 96,
            fontSize: 17,
            lineHeight: 28,
            color: palette.text,
            backgroundColor: palette.surfaceAlt,
            borderRadius: radii.md,
            padding: spacing.md,
            writingDirection: 'rtl',
          }}
        />

        <Spacer size={spacing.md} />
        <Button
          label={analysis.running ? 'جارٍ التحليل…' : 'حلّل السؤال'}
          onPress={() => run(question)}
          loading={analysis.running}
          disabled={question.trim().length === 0}
        />
      </View>

      {analysis.running && stage ? (
        <>
          <Spacer size={spacing.lg} />
          <LoadingBlock label={STAGE_LABELS[stage]} />
        </>
      ) : null}

      {analysis.error ? (
        <>
          <Spacer size={spacing.lg} />
          <Card tone="alt">
            <AppText variant="small" style={{ color: palette.danger }}>
              {analysis.error}
            </AppText>
          </Card>
        </>
      ) : null}

      <Spacer size={spacing.xl} />
      <SectionTitle hint="اضغط على أي سؤال لتشغيله مباشرة">أسئلة للبدء</SectionTitle>

      {SAMPLE_QUESTIONS.map((q) => (
        <Card key={q} onPress={() => { setQuestion(q); run(q); }} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="chevron-back" size={16} color={palette.textFaint} />
            <AppText variant="body" style={{ flex: 1 }}>
              {q}
            </AppText>
          </View>
        </Card>
      ))}

      <Spacer size={spacing.xl} />
      <Card tone="alt">
        <AppText variant="small" weight="bold">
          كيف يعمل هذا التطبيق
        </AppText>
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          يفصل التطبيق دائمًا بين خمسة أشياء: نص الآية، والملاحظة اللغوية المحسوبة من المصحف،
          والاستنتاج، ورأي المفكر، ودرجة الثقة. لا يُعرض تفسير على أنه نص، ولا يُنسب رأي لأحد بلا مصدر،
          وكل مرجع قرآني يُتحقق منه من قاعدة البيانات المحلية قبل عرضه.
        </AppText>
      </Card>
    </Screen>
  );
}
