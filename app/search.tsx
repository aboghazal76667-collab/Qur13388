import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import {
  AppText,
  Badge,
  Card,
  Chip,
  EmptyState,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../src/components/primitives';
import { VerseCard } from '../src/components/VerseCard';
import { useTheme } from '../src/theme/ThemeProvider';
import { exactSearch, normalizedSearch, rootSearch, search, semanticSearch } from '../src/quran/search';
import { referenceFromVerse, getRootProfile } from '../src/quran/repository';
import { displayRoot, parseRootInput } from '../src/quran/arabic';
import { CONCEPTS } from '../src/knowledge/concepts';
import { THINKERS, THINKER_CLAIMS } from '../src/knowledge/thinkers';
import { useHistoryStore } from '../src/store/historyStore';
import type { SearchMode } from '../src/types/quran';

const MODES: { id: SearchMode | 'auto'; label: string; hint: string }[] = [
  { id: 'auto', label: 'تلقائي', hint: 'يجمع بين البحث المطبّع والجذري' },
  { id: 'exact', label: 'مطابقة حرفية', hint: 'النص كما كُتب بتشكيله' },
  { id: 'normalized', label: 'بدون تشكيل', hint: 'يتجاهل الحركات والهمزات والتطويل' },
  { id: 'root', label: 'بالجذر', hint: 'مثال: ح ج ب' },
  { id: 'semantic', label: 'بالمفهوم', hint: 'آيات مرتبطة بالمعنى ولو بألفاظ أخرى' },
];

export default function SearchScreen() {
  const { palette, spacing, radii } = useTheme();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode | 'auto'>('auto');

  const history = useHistoryStore((s) => s.entries);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    switch (mode) {
      case 'exact':
        return exactSearch(q, { limit: 40 });
      case 'normalized':
        return normalizedSearch(q, { limit: 40 });
      case 'root':
        return rootSearch(q, { limit: 60 });
      case 'semantic':
        return semanticSearch({ roots: [parseRootInput(q)], terms: [q] }, { limit: 40 });
      default:
        return search(q, { limit: 40 });
    }
  }, [query, mode]);

  const rootProfile = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    return getRootProfile(parseRootInput(q));
  }, [query]);

  const matchingConcepts = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return CONCEPTS.filter(
      (c) => c.labelArabic.includes(q) || c.terms.some((t) => t.includes(q)) || c.roots.some((r) => r.includes(q))
    );
  }, [query]);

  const matchingThinkers = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return THINKERS.filter((t) => t.nameArabic.includes(q) || t.methodSummary.includes(q));
  }, [query]);

  const matchingClaims = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return THINKER_CLAIMS.filter((c) => c.claim.includes(q) || c.topicLabel.includes(q));
  }, [query]);

  const matchingHistory = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return history.filter((e) => e.question.includes(q) || e.summary.includes(q));
  }, [query, history]);

  return (
    <Screen>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث في المصحف والمفاهيم والمفكرين والتحليلات"
        placeholderTextColor={palette.textFaint}
        autoFocus
        textAlign="right"
        style={{
          backgroundColor: palette.surface,
          borderRadius: radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          color: palette.text,
          fontSize: 17,
          writingDirection: 'rtl',
        }}
      />

      <Spacer size={spacing.md} />
      <Row gap={6}>
        {MODES.map((m) => (
          <Chip key={m.id} label={m.label} selected={mode === m.id} onPress={() => setMode(m.id)} compact />
        ))}
      </Row>
      <AppText variant="tiny" tone="faint" style={{ marginTop: 6 }}>
        {MODES.find((m) => m.id === mode)?.hint}
      </AppText>

      {query.trim().length < 2 ? (
        <EmptyState title="ابدأ الكتابة" message="اكتب كلمة أو جذرًا (مثال: ص ل و) للبحث." />
      ) : (
        <>
          {rootProfile ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle>الجذر</SectionTitle>
              <Card onPress={() => router.push({ pathname: '/word/[form]', params: { form: query.trim(), root: rootProfile.root } })}>
                <Row gap={8} style={{ justifyContent: 'space-between' }}>
                  <AppText variant="heading" weight="bold">
                    {displayRoot(rootProfile.root)}
                  </AppText>
                  <Badge label={`${rootProfile.occurrenceCount} موضعًا`} tone="accent" />
                </Row>
                <AppText variant="tiny" tone="faint" style={{ marginTop: 6 }}>
                  {rootProfile.verseCount} آية · {rootProfile.surahCount} سورة · {rootProfile.forms.length} صيغة
                </AppText>
              </Card>
            </>
          ) : null}

          {matchingConcepts.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle>المواضيع</SectionTitle>
              <Row gap={6}>
                {matchingConcepts.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.labelArabic}
                    onPress={() => router.push({ pathname: '/graph', params: { concept: c.id } })}
                  />
                ))}
              </Row>
            </>
          ) : null}

          {matchingThinkers.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle>المفكرون</SectionTitle>
              <Row gap={6}>
                {matchingThinkers.map((t) => (
                  <Chip
                    key={t.id}
                    label={t.nameArabic}
                    onPress={() => router.push({ pathname: '/thinker/[id]', params: { id: t.id } })}
                  />
                ))}
              </Row>
            </>
          ) : null}

          {matchingClaims.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle>الادعاءات</SectionTitle>
              {matchingClaims.map((c) => (
                <Card
                  key={c.id}
                  style={{ marginBottom: spacing.sm }}
                  onPress={() => router.push({ pathname: '/thinker/[id]', params: { id: c.thinkerId } })}
                >
                  <AppText variant="small">{c.claim}</AppText>
                </Card>
              ))}
            </>
          ) : null}

          {matchingHistory.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle>تحليلات سابقة</SectionTitle>
              {matchingHistory.map((e) => (
                <Card
                  key={e.id}
                  style={{ marginBottom: spacing.sm }}
                  onPress={() => router.push({ pathname: '/analysis/[id]', params: { id: e.id } })}
                >
                  <AppText variant="small" weight="medium">
                    {e.question}
                  </AppText>
                </Card>
              ))}
            </>
          ) : null}

          <Spacer size={spacing.lg} />
          <SectionTitle hint={`${results.length} نتيجة`}>الآيات</SectionTitle>
          {results.length === 0 ? (
            <Card tone="alt">
              <AppText variant="small" tone="muted">
                لا توجد نتائج بهذه الطريقة. جرّب وضع بحث آخر من الأعلى.
              </AppText>
            </Card>
          ) : (
            results.map((hit) => (
              <VerseCard
                key={`${hit.verse.key}-${hit.mode}`}
                reference={referenceFromVerse(hit.verse, hit.reason)}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}
