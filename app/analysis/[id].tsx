import React, { useMemo } from 'react';
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
import { QuranOnlyBadge } from '../../src/components/QuranOnlyBadge';
import { VerseCard } from '../../src/components/VerseCard';
import { ReasoningChain } from '../../src/components/ReasoningChain';
import { EvidenceGradeBadge } from '../../src/components/EvidenceGradeBadge';
import { ConfidenceMeter } from '../../src/components/ConfidenceMeter';
import { WordAnalysisCard } from '../../src/components/WordAnalysisCard';
import { ThinkerClaimCard, NoThinkerDataCard } from '../../src/components/ThinkerClaimCard';
import { GraphView } from '../../src/components/GraphView';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAnalysisStore } from '../../src/store/analysisStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useFavoritesStore } from '../../src/store/favoritesStore';
import { buildAnalysisGraph } from '../../src/graph/builder';
import { CONFIDENCE_LABELS } from '../../src/analysis/argument';

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spacing, palette } = useTheme();
  const fromStore = useAnalysisStore((s) => (id ? s.results[id] : undefined));
  const fromHistory = useHistoryStore((s) => s.entries.find((e) => e.id === id)?.result);
  const favorites = useFavoritesStore();

  const result = fromStore ?? fromHistory;

  const graph = useMemo(
    () =>
      result
        ? buildAnalysisGraph(
            result.questionAnalysis.relatedConcepts,
            result.centralVerses.map((v) => v.key),
            result.thinkerPerspectives.flatMap((t) => t.claims.map((c) => c.id))
          )
        : null,
    [result]
  );

  if (!result) {
    return (
      <Screen>
        <EmptyState title="لم يُعثر على التحليل" message="ربما حُذف من السجل أو انتهت الجلسة." />
      </Screen>
    );
  }

  const favoriteId = `analysis:${result.id}`;
  const isFavorite = favorites.items.some((i) => i.id === favoriteId);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'نتيجة التحليل' }} />

      <QuranOnlyBadge />
      <Spacer size={spacing.lg} />

      {/* ---------------------------------------------------------------- */}
      <AppText variant="tiny" tone="faint">
        السؤال
      </AppText>
      <AppText variant="heading" weight="bold" style={{ marginTop: 4 }}>
        {result.question}
      </AppText>

      <Row gap={6} style={{ marginTop: spacing.md }}>
        <Badge
          label={result.engine === 'ai' ? 'تحليل بمساعدة نموذج لغوي' : 'تحليل محلي (بدون نموذج)'}
          tone={result.engine === 'ai' ? 'accent' : 'neutral'}
        />
        <Badge label={`الثقة: ${CONFIDENCE_LABELS[result.confidence.level]}`} tone="neutral" />
      </Row>

      {result.notices.length > 0 ? (
        <Card tone="alt" style={{ marginTop: spacing.md }}>
          {result.notices.map((n, i) => (
            <AppText key={i} variant="tiny" tone="muted" style={{ marginBottom: 4 }}>
              • {n}
            </AppText>
          ))}
        </Card>
      ) : null}

      {result.rejectedReferences.length > 0 ? (
        <Card tone="alt" style={{ marginTop: spacing.md }}>
          <AppText variant="small" weight="bold" style={{ color: palette.danger }}>
            مراجع مرفوضة من حارس التحقق
          </AppText>
          {result.rejectedReferences.map((r, i) => (
            <AppText key={i} variant="tiny" tone="muted" style={{ marginTop: 4 }}>
              • {r}
            </AppText>
          ))}
        </Card>
      ) : null}

      {/* الخلاصة ---------------------------------------------------------- */}
      <Spacer size={spacing.xl} />
      <SectionTitle>الخلاصة</SectionTitle>
      <Card tone="accent">
        <AppText variant="body">{result.summary}</AppText>
      </Card>

      {/* تحليل السؤال ------------------------------------------------------ */}
      <Spacer size={spacing.xl} />
      <SectionTitle hint="ما الذي يفترضه السؤال نفسه قبل أن يُجاب عنه">تفكيك السؤال</SectionTitle>
      <Card>
        <AppText variant="tiny" tone="faint">
          القضية الرئيسية
        </AppText>
        <AppText variant="small" style={{ marginTop: 4 }}>
          {result.questionAnalysis.mainIssue}
        </AppText>

        {result.questionAnalysis.candidateRoots.length > 0 ? (
          <>
            <Divider spacingY={spacing.md} />
            <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
              الجذور المرشّحة للبحث
            </AppText>
            <Row gap={6}>
              {result.questionAnalysis.candidateRoots.map((r) => (
                <Badge key={r} label={r.split('').join(' ')} tone="accent" />
              ))}
            </Row>
          </>
        ) : null}

        {result.questionAnalysis.implicitAssumptions.length > 0 ? (
          <>
            <Divider spacingY={spacing.md} />
            <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
              افتراضات ضمنية في السؤال
            </AppText>
            {result.questionAnalysis.implicitAssumptions.map((a, i) => (
              <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                • {a}
              </AppText>
            ))}
          </>
        ) : null}

        {result.questionAnalysis.subQuestions.length > 0 ? (
          <>
            <Divider spacingY={spacing.md} />
            <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
              الأسئلة الفرعية التي يجب بحثها
            </AppText>
            {result.questionAnalysis.subQuestions.map((q, i) => (
              <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                • {q}
              </AppText>
            ))}
          </>
        ) : null}
      </Card>

      {/* الآيات المركزية --------------------------------------------------- */}
      <Spacer size={spacing.xl} />
      <SectionTitle hint="النص من قاعدة بيانات المصحف المحلية، لا من النموذج">
        الآيات المركزية
      </SectionTitle>
      {result.centralVerses.length > 0 ? (
        result.centralVerses.map((ref) => <VerseCard key={ref.key} reference={ref} />)
      ) : (
        <Card tone="alt">
          <AppText variant="small" tone="muted">
            لم تُستخرج آيات مركزية لهذا السؤال. جرّب صياغته بلفظ قرآني مباشر.
          </AppText>
        </Card>
      )}

      {/* التحليل القرآني --------------------------------------------------- */}
      {result.quranicAnalysis.length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle>التحليل القرآني الداخلي</SectionTitle>
          {result.quranicAnalysis.map((section) => (
            <Card key={section.id} style={{ marginBottom: spacing.md }}>
              <AppText variant="small" weight="bold">
                {section.title}
              </AppText>
              <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
                {section.body}
              </AppText>
            </Card>
          ))}
        </>
      ) : null}

      {/* تحليل الكلمات ---------------------------------------------------- */}
      {result.wordAnalyses.length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle hint="أرقام محسوبة من مورفولوجيا المصحف، غير مولّدة">
            تحليل الكلمات
          </SectionTitle>
          {result.wordAnalyses.map((w) => (
            <WordAnalysisCard key={w.normalized} analysis={w} />
          ))}
        </>
      ) : null}

      {/* مسار الاستدلال --------------------------------------------------- */}
      {result.arguments.length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle hint="كل حلقة ملوّنة بحسب نوعها: نص، ملاحظة، افتراض، استنتاج">
            مسار الاستدلال
          </SectionTitle>
          {result.arguments.map((arg) => (
            <Card key={arg.id} style={{ marginBottom: spacing.lg }}>
              <AppText variant="small" weight="bold">
                {arg.conclusion}
              </AppText>

              <Spacer size={spacing.md} />
              <EvidenceGradeBadge grade={arg.directness} />

              <Spacer size={spacing.md} />
              <ReasoningChain steps={arg.chain} />

              {arg.assumptions.length > 0 ? (
                <>
                  <Divider spacingY={spacing.md} />
                  <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
                    الافتراضات المخفيّة — هل هي في القرآن أم أُضيفت بين النص والنتيجة؟
                  </AppText>
                  {arg.assumptions.map((a, i) => (
                    <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                      • {a}
                    </AppText>
                  ))}
                </>
              ) : null}

              {arg.alternativeInterpretations.length > 0 ? (
                <>
                  <Divider spacingY={spacing.md} />
                  <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
                    تفسيرات بديلة ممكنة
                  </AppText>
                  {arg.alternativeInterpretations.map((a, i) => (
                    <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                      • {a}
                    </AppText>
                  ))}
                </>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {/* الرأي المرجّح ----------------------------------------------------- */}
      {result.leadingView ? (
        <>
          <Spacer size={spacing.lg} />
          <SectionTitle>الرأي المرجَّح</SectionTitle>
          <Card>
            <AppText variant="body" weight="medium">
              {result.leadingView.statement}
            </AppText>
            <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
              {result.leadingView.rationale}
            </AppText>
            <Spacer size={spacing.md} />
            <EvidenceGradeBadge grade={result.leadingView.directness} />
          </Card>
        </>
      ) : null}

      {/* أقوى اعتراض ------------------------------------------------------ */}
      {result.strongestCounterArgument ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle hint="النظام مُلزَم بمحاولة هدم استنتاجه بنفسه">أقوى اعتراض</SectionTitle>
          <Card>
            <Badge
              label={`قوة الاعتراض: ${CONFIDENCE_LABELS[result.strongestCounterArgument.strength]}`}
              tone="caution"
            />
            <AppText variant="small" style={{ marginTop: spacing.md }}>
              {result.strongestCounterArgument.statement}
            </AppText>

            {result.strongestCounterArgument.quranEvidence.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                {result.strongestCounterArgument.quranEvidence.map((ref) => (
                  <VerseCard key={ref.key} reference={ref} showFavorite={false} />
                ))}
              </View>
            ) : null}

            {result.strongestCounterArgument.response ? (
              <>
                <Divider spacingY={spacing.md} />
                <AppText variant="tiny" tone="faint">
                  الردّ على الاعتراض
                </AppText>
                <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
                  {result.strongestCounterArgument.response}
                </AppText>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* عدم الترادف ------------------------------------------------------ */}
      {result.nonSynonymyNotes.length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle hint="عدم الترادف يُعامَل كفرضية تُختبر، لا كحقيقة مفروضة">
            اختبار فرضية عدم الترادف
          </SectionTitle>
          {result.nonSynonymyNotes.map((note) => (
            <Card key={note.id} style={{ marginBottom: spacing.md }}>
              <Row gap={6}>
                <Badge label="فرضية قيد الاختبار" tone="caution" />
                <Badge label={note.terms.join(' / ')} tone="accent" />
              </Row>

              <AppText variant="small" style={{ marginTop: spacing.md }}>
                {note.hypothesis}
              </AppText>

              {note.supporting.length > 0 ? (
                <>
                  <Divider spacingY={spacing.md} />
                  <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
                    الأدلة المؤيّدة للتفريق
                  </AppText>
                  {note.supporting.map((s, i) => (
                    <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                      • {s}
                    </AppText>
                  ))}
                </>
              ) : null}

              {note.weakening.length > 0 ? (
                <>
                  <Divider spacingY={spacing.md} />
                  <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
                    ما قد يُضعف هذا التفريق
                  </AppText>
                  {note.weakening.map((s, i) => (
                    <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                      • {s}
                    </AppText>
                  ))}
                </>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {/* آراء المفكرين ---------------------------------------------------- */}
      <Spacer size={spacing.xl} />
      <SectionTitle hint="لا يُنسب رأي لأحد بغير مصدر موثّق">آراء المفكرين</SectionTitle>
      {result.thinkerPerspectives.map((entry) =>
        entry.claims.length > 0 ? (
          <View key={entry.thinkerId}>
            <AppText variant="small" weight="bold" style={{ marginBottom: spacing.sm }}>
              {entry.thinkerName}
            </AppText>
            {entry.claims.map((claim) => (
              <ThinkerClaimCard key={claim.id} claim={claim} showVerses={false} />
            ))}
          </View>
        ) : (
          <NoThinkerDataCard
            key={entry.thinkerId}
            thinkerName={entry.thinkerName}
            message={entry.noDataMessage ?? ''}
          />
        )
      )}

      {/* الرسم المعرفي ---------------------------------------------------- */}
      {graph && graph.nodes.length > 1 ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle>خريطة العلاقات</SectionTitle>
          <GraphView graph={graph} />
        </>
      ) : null}

      {/* درجة الثقة ------------------------------------------------------- */}
      <Spacer size={spacing.xl} />
      <SectionTitle>درجة الثقة</SectionTitle>
      <ConfidenceMeter level={result.confidence.level} reason={result.confidence.reason} />

      <Spacer size={spacing.lg} />
      <Card
        tone="alt"
        onPress={() =>
          favorites.toggle({
            id: favoriteId,
            kind: 'analysis',
            createdAt: new Date().toISOString(),
            title: result.question,
            subtitle: result.summary.slice(0, 80),
            result,
          })
        }
      >
        <AppText variant="small" weight="medium" align="center" tone={isFavorite ? 'accent' : 'default'}>
          {isFavorite ? '★ محفوظ في المفضلة — اضغط للإزالة' : '☆ احفظ هذا التحليل'}
        </AppText>
      </Card>
    </Screen>
  );
}
