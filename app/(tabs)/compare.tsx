import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

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
} from '../../src/components/primitives';
import { VerseCard } from '../../src/components/VerseCard';
import { QuranOnlyBadge } from '../../src/components/QuranOnlyBadge';
import { useTheme } from '../../src/theme/ThemeProvider';
import { compareTerms } from '../../src/analysis/comparison';
import { testNonSynonymy } from '../../src/analysis/nonSynonymy';
import { CONCEPT_PAIRS } from '../../src/knowledge/concepts';
import { CONFIDENCE_LABELS } from '../../src/analysis/argument';
import { displayRoot } from '../../src/quran/arabic';
import { useFavoritesStore } from '../../src/store/favoritesStore';
import type { ComparisonResult, NonSynonymyHypothesis, TermProfile } from '../../src/types/analysis';

export default function CompareTab() {
  const { palette, spacing, radii } = useTheme();
  const [termA, setTermA] = useState('');
  const [termB, setTermB] = useState('');
  const [rootA, setRootA] = useState<string | undefined>();
  const [rootB, setRootB] = useState<string | undefined>();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [hypothesis, setHypothesis] = useState<NonSynonymyHypothesis | null>(null);
  const favorites = useFavoritesStore();

  const run = (a: string, b: string, ra?: string, rb?: string) => {
    if (!a.trim() || !b.trim()) return;
    setResult(compareTerms(a.trim(), b.trim(), { rootA: ra, rootB: rb }));
    setHypothesis(testNonSynonymy({ termA: a.trim(), termB: b.trim(), rootA: ra, rootB: rb }));
  };

  const inputStyle = {
    flex: 1,
    // Flex items default to `min-width: auto`, so a text input refuses to
    // shrink below its placeholder's intrinsic width and pushes the row past
    // both screen edges. Allowing it to shrink is what keeps the pair on screen.
    minWidth: 0,
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: palette.text,
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
    fontSize: 16,
  };

  return (
    <Screen>
      <QuranOnlyBadge compact />
      <Spacer size={spacing.lg} />

      <AppText variant="title" weight="bold">
        مقارنة لفظين
      </AppText>
      <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
        قارن توزيع لفظين في المصحف: المواضع المشتركة والمنفردة، والسياقات، وما إذا كان
        الاستعمال يدعم وجود فرق دلالي.
      </AppText>

      <Spacer size={spacing.lg} />
      <Row gap={spacing.sm} wrap={false}>
        <TextInput
          value={termA}
          onChangeText={(t) => { setTermA(t); setRootA(undefined); }}
          placeholder="اللفظ الأول"
          placeholderTextColor={palette.textFaint}
          style={inputStyle}
        />
        <TextInput
          value={termB}
          onChangeText={(t) => { setTermB(t); setRootB(undefined); }}
          placeholder="اللفظ الثاني"
          placeholderTextColor={palette.textFaint}
          style={inputStyle}
        />
      </Row>

      <Spacer size={spacing.md} />
      <Button label="قارن" onPress={() => run(termA, termB, rootA, rootB)} disabled={!termA.trim() || !termB.trim()} />

      <Spacer size={spacing.xl} />
      <SectionTitle hint="أزواج جاهزة تُختبر بها فرضية عدم الترادف">مقارنات جاهزة</SectionTitle>
      <Row gap={8}>
        {CONCEPT_PAIRS.map((pair) => (
          <Chip
            key={pair.id}
            label={pair.labelArabic}
            onPress={() => {
              setTermA(pair.termA);
              setTermB(pair.termB);
              setRootA(pair.rootA);
              setRootB(pair.rootB);
              run(pair.termA, pair.termB, pair.rootA, pair.rootB);
            }}
          />
        ))}
      </Row>

      {result ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle>النتيجة</SectionTitle>

          <Row gap={spacing.sm} wrap={false} style={{ alignItems: 'stretch' }}>
            <ProfileColumn profile={result.termA} />
            <ProfileColumn profile={result.termB} />
          </Row>

          <Spacer size={spacing.lg} />
          <Card tone="accent">
            <AppText variant="small">{result.distributionalVerdict.summary}</AppText>
            <Spacer size={spacing.sm} />
            <Badge
              label={`ثقة المقارنة: ${CONFIDENCE_LABELS[result.distributionalVerdict.confidence]}`}
              tone="neutral"
            />
          </Card>

          {result.contrasts.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle>السمات المختلفة</SectionTitle>
              {result.contrasts.map((c, i) => (
                <Card key={i} style={{ marginBottom: spacing.sm }}>
                  <AppText variant="small" weight="bold">
                    {c.label}
                  </AppText>
                  <AppText variant="small" tone="muted" style={{ marginTop: 6 }}>
                    {c.detail}
                  </AppText>
                </Card>
              ))}
            </>
          ) : null}

          {hypothesis ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle hint="عدم الترادف فرضية تُختبر، لا قاعدة مفروضة">
                هل يدعم الاستعمال القرآني وجود فرق دلالي؟
              </SectionTitle>
              <Card>
                <Badge label="فرضية قيد الاختبار" tone="caution" />
                <AppText variant="small" style={{ marginTop: spacing.md }}>
                  {hypothesis.hypothesis}
                </AppText>

                <Divider spacingY={spacing.md} />
                <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
                  الأدلة المؤيدة
                </AppText>
                {hypothesis.supporting.map((s, i) => (
                  <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                    • {s}
                  </AppText>
                ))}

                <Divider spacingY={spacing.md} />
                <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
                  الأدلة المضادة
                </AppText>
                {hypothesis.weakening.map((s, i) => (
                  <AppText key={i} variant="small" tone="muted" style={{ marginBottom: 6 }}>
                    • {s}
                  </AppText>
                ))}
              </Card>
            </>
          ) : null}

          {result.sharedVerses.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle hint={`اجتماع اللفظين في سياق واحد من أقوى قرائن المغايرة · تُعرض ${result.sharedVerses.length} منها`}>
                المواضع المشتركة ({result.sharedCount})
              </SectionTitle>
              {result.sharedVerses.map((ref) => (
                <VerseCard key={ref.key} reference={ref} />
              ))}
            </>
          ) : null}

          {result.onlyA.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle hint={`${result.onlyACount} موضعًا — تُعرض أمثلة منها`}>
                {`مواضع «${result.termA.term}» وحده`}
              </SectionTitle>
              {result.onlyA.slice(0, 5).map((ref) => (
                <VerseCard key={ref.key} reference={ref} />
              ))}
            </>
          ) : null}

          {result.onlyB.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle hint={`${result.onlyBCount} موضعًا — تُعرض أمثلة منها`}>
                {`مواضع «${result.termB.term}» وحده`}
              </SectionTitle>
              {result.onlyB.slice(0, 5).map((ref) => (
                <VerseCard key={ref.key} reference={ref} />
              ))}
            </>
          ) : null}

          <Spacer size={spacing.lg} />
          <Card
            tone="alt"
            onPress={() =>
              favorites.toggle({
                id: `comparison:${result.termA.term}-${result.termB.term}`,
                kind: 'comparison',
                createdAt: new Date().toISOString(),
                title: `${result.termA.term} / ${result.termB.term}`,
                subtitle: result.distributionalVerdict.summary.slice(0, 80),
                comparison: result,
              })
            }
          >
            <AppText variant="small" weight="medium" align="center">
              ☆ احفظ هذه المقارنة
            </AppText>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function ProfileColumn({ profile }: { profile: TermProfile }) {
  const { spacing } = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 0 }}>
      <AppText variant="body" weight="bold" align="center">
        {profile.term}
      </AppText>
      {profile.root ? (
        <AppText variant="tiny" tone="faint" align="center" style={{ marginTop: 4 }}>
          {displayRoot(profile.root)}
        </AppText>
      ) : null}

      <Divider spacingY={spacing.md} />

      <StatLine label="المواضع" value={profile.occurrenceCount} />
      <StatLine label="الآيات" value={profile.verseCount} />
      <StatLine label="السور" value={profile.surahCount} />

      {profile.topSurahs.length > 0 ? (
        <>
          <Divider spacingY={spacing.sm} />
          <AppText variant="tiny" tone="faint">
            أكثر السور
          </AppText>
          {profile.topSurahs.slice(0, 3).map((s) => (
            <AppText key={s.surah} variant="tiny" tone="muted">
              {s.nameArabic} ({s.count})
            </AppText>
          ))}
        </>
      ) : null}
    </Card>
  );
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
      <AppText variant="tiny" tone="faint">
        {label}
      </AppText>
      <AppText variant="small" weight="bold" tone="accent">
        {value}
      </AppText>
    </View>
  );
}
