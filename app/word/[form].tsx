import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  LoadingBlock,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../../src/components/primitives';
import { VerseCard } from '../../src/components/VerseCard';
import { GraphView } from '../../src/components/GraphView';
import { useTheme } from '../../src/theme/ThemeProvider';
import { analyzeWord, describeSenseSpread } from '../../src/analysis/internalAnalysis';
import { buildCounterArgument } from '../../src/analysis/counterArgument';
import { buildWordGraph } from '../../src/graph/builder';
import { getVerseByKey, referenceFromVerse } from '../../src/quran/repository';
import { displayRoot, normalizeArabic } from '../../src/quran/arabic';
import { useFavoritesStore } from '../../src/store/favoritesStore';

export default function WordScreen() {
  const params = useLocalSearchParams<{ form: string; root?: string; verseKey?: string }>();
  const { spacing, palette } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const favorites = useFavoritesStore();

  const form = params.form ?? '';
  const root = params.root && params.root.length > 0 ? params.root : undefined;

  const analysis = useMemo(
    () => (form ? analyzeWord(form, { root, maxContexts: 400 }) : null),
    [form, root]
  );

  if (!analysis) {
    return (
      <Screen>
        <LoadingBlock label="جارٍ تحليل الكلمة…" />
      </Screen>
    );
  }

  if (analysis.occurrenceCount === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: form }} />
        <EmptyState
          title="لا توجد مواضع"
          message={`لم يُعثر على «${form}» في قاعدة بيانات المصحف بهذه الصورة، ولا على جذر لها في المورفولوجيا.`}
        />
      </Screen>
    );
  }

  const spread = describeSenseSpread(analysis);
  const counter = buildCounterArgument(analysis);
  const graph = buildWordGraph(analysis);
  const favoriteId = `word:${analysis.normalized}`;
  const isFavorite = favorites.items.some((i) => i.id === favoriteId);

  const patternsToShow = showAll ? analysis.usagePatterns : analysis.usagePatterns.slice(0, 4);

  return (
    <Screen>
      <Stack.Screen options={{ title: form }} />

      <Card>
        <AppText variant="quran" tone="quran" align="center">
          {form}
        </AppText>
        <Row gap={6} style={{ justifyContent: 'center', marginTop: spacing.md }}>
          <Badge label={`بدون تشكيل: ${analysis.normalized}`} tone="neutral" />
          {analysis.root ? <Badge label={`الجذر: ${displayRoot(analysis.root)}`} tone="accent" /> : null}
          {analysis.lemma ? <Badge label={`اللفظ الأصلي: ${analysis.lemma}`} tone="neutral" /> : null}
        </Row>

        <Divider spacingY={spacing.lg} />

        <Row gap={20} style={{ justifyContent: 'center' }}>
          <Stat label="التكرارات" value={analysis.occurrenceCount} />
          <Stat label="الآيات" value={analysis.verseCount} />
          <Stat label="الصيغ" value={analysis.distinctForms.length} />
          <Stat label="الأنماط" value={analysis.usagePatterns.length} />
        </Row>
      </Card>

      <Spacer size={spacing.lg} />
      <Card tone="accent">
        <AppText variant="small" weight="bold">
          {spread.headline}
        </AppText>
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          {spread.detail}
        </AppText>
      </Card>

      {/* الصيغ ------------------------------------------------------------ */}
      <Spacer size={spacing.xl} />
      <SectionTitle hint="الصيغ الصرفية المختلفة المشتقة من الجذر نفسه">الصيغ الواردة</SectionTitle>
      <Card>
        <Row gap={6}>
          {analysis.distinctForms.slice(0, showAll ? 60 : 18).map((f) => (
            <View
              key={f.surface}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: palette.surfaceAlt,
              }}
            >
              <AppText variant="small">
                {f.surface} <AppText variant="tiny" tone="faint">{`(${f.count})`}</AppText>
              </AppText>
            </View>
          ))}
        </Row>
      </Card>

      {analysis.lemmaBreakdown.length > 0 ? (
        <>
          <Spacer size={spacing.lg} />
          <SectionTitle>الألفاظ الأصلية (Lemmas)</SectionTitle>
          <Card>
            <Row gap={6}>
              {analysis.lemmaBreakdown.slice(0, showAll ? 40 : 12).map((l) => (
                <Badge key={l.lemma} label={`${l.lemma} · ${l.count}`} tone="neutral" />
              ))}
            </Row>
          </Card>
        </>
      ) : null}

      {/* حروف الجر -------------------------------------------------------- */}
      {analysis.prepositionProfile.length > 0 ? (
        <>
          <Spacer size={spacing.lg} />
          <SectionTitle hint="تغيّر حرف الجر كثيرًا ما يصاحب تغيّرًا في وجه الاستعمال">
            حروف الجر المصاحبة
          </SectionTitle>
          <Card>
            <Row gap={6}>
              {analysis.prepositionProfile.map((p) => (
                <Badge key={p.particle} label={`${p.particle} · ${p.count}`} tone="accent" />
              ))}
            </Row>
          </Card>
        </>
      ) : null}

      {/* الخصائص الصرفية --------------------------------------------------- */}
      {analysis.grammarProfile.length > 0 ? (
        <>
          <Spacer size={spacing.lg} />
          <SectionTitle>الخصائص الصرفية والنحوية</SectionTitle>
          <Card>
            <Row gap={6}>
              {analysis.grammarProfile.map((g) => (
                <Badge key={g.feature} label={`${g.label} · ${g.count}`} tone="neutral" />
              ))}
            </Row>
          </Card>
        </>
      ) : null}

      {/* السياقات المختلفة ------------------------------------------------- */}
      <Spacer size={spacing.xl} />
      <SectionTitle hint="تصنيف بنيوي لا دلالي — يبيّن كيف يوظّف النص اللفظ، لا ماذا يعني">
        السياقات المختلفة
      </SectionTitle>

      {patternsToShow.map((pattern) => (
        <Card key={pattern.id} style={{ marginBottom: spacing.md }}>
          <Row gap={8} style={{ justifyContent: 'space-between' }}>
            <AppText variant="small" weight="bold">
              {pattern.label}
            </AppText>
            <Badge label={`${pattern.verseKeys.length} موضعًا`} tone="accent" />
          </Row>

          <AppText variant="tiny" tone="faint" style={{ marginTop: 6 }}>
            {pattern.signals.join('، ')}
          </AppText>

          <Divider spacingY={spacing.md} />

          {pattern.sampleReferences.map((ref) => (
            <VerseCard key={ref.key} reference={ref} showFavorite={false} />
          ))}
        </Card>
      ))}

      {analysis.usagePatterns.length > 4 ? (
        <Button
          label={showAll ? 'عرض أقل' : `عرض كل الأنماط (${analysis.usagePatterns.length})`}
          variant="ghost"
          onPress={() => setShowAll((v) => !v)}
        />
      ) : null}

      {/* مواضع مشابهة ------------------------------------------------------ */}
      <Spacer size={spacing.xl} />
      <SectionTitle hint="اشتراك الجذر يدل على الموضع فقط">
        مواضع تشترك في الجذر نفسه
      </SectionTitle>
      {analysis.contexts.slice(0, showAll ? 40 : 6).map((ctx, i) => {
        const verse = getVerseByKey(ctx.verseKey);
        if (!verse) return null;
        return (
          <VerseCard
            key={`${ctx.verseKey}-${i}`}
            reference={referenceFromVerse(
              verse,
              `الصيغة الواردة: ${ctx.surface}${ctx.preposition ? ` · مع حرف ${ctx.preposition}` : ''}`
            )}
            showFavorite={false}
          />
        );
      })}

      {/* أقوى اعتراض ------------------------------------------------------ */}
      {counter ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle hint="ما الذي تتركه القراءة الغالبة بلا تفسير؟">
            أقوى اعتراض من داخل النص
          </SectionTitle>
          <Card>
            <AppText variant="small">{counter.statement}</AppText>
            {counter.response ? (
              <>
                <Divider spacingY={spacing.md} />
                <AppText variant="tiny" tone="faint">
                  الردّ المحتمل
                </AppText>
                <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
                  {counter.response}
                </AppText>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* الرسم ------------------------------------------------------------ */}
      {graph.nodes.length > 1 ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle>خريطة العلاقات</SectionTitle>
          <GraphView graph={graph} />
        </>
      ) : null}

      <Spacer size={spacing.lg} />
      <Card
        tone="alt"
        onPress={() =>
          favorites.toggle({
            id: favoriteId,
            kind: 'word',
            createdAt: new Date().toISOString(),
            title: analysis.word,
            subtitle: `${analysis.occurrenceCount} موضعًا · ${analysis.usagePatterns.length} أنماط`,
            analysis,
          })
        }
      >
        <AppText variant="small" weight="medium" align="center" tone={isFavorite ? 'accent' : 'default'}>
          {isFavorite ? '★ محفوظ — اضغط للإزالة' : '☆ احفظ تحليل هذه الكلمة'}
        </AppText>
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <AppText variant="title" weight="bold" tone="accent">
        {value}
      </AppText>
      <AppText variant="tiny" tone="faint">
        {label}
      </AppText>
    </View>
  );
}
