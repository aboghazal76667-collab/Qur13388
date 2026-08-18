import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { AppText, Badge, EmptyState, Row } from '../../src/components/primitives';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getSurah, getSurahVerses } from '../../src/quran/repository';
import { toArabicNumerals } from '../../src/quran/arabic';
import type { QuranVerse, QuranWord } from '../../src/types/quran';

export default function SurahScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surahNumber = Number(id);
  const { palette, spacing, radii } = useTheme();

  const surah = getSurah(surahNumber);
  const verses = useMemo(() => getSurahVerses(surahNumber), [surahNumber]);

  if (!surah) {
    return <EmptyState title="سورة غير موجودة" message="تحقق من رقم السورة." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen options={{ title: surah.nameArabic }} />

      <FlatList
        data={verses}
        keyExtractor={(v) => v.key}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg, alignItems: 'center', gap: 6 }}>
            <AppText variant="title" weight="bold">
              سورة {surah.nameArabic}
            </AppText>
            <Row gap={6} style={{ justifyContent: 'center' }}>
              <Badge label={surah.revelationType === 'makki' ? 'مكية' : 'مدنية'} tone="accent" />
              <Badge label={`${toArabicNumerals(surah.ayahCount)} آية`} tone="neutral" />
            </Row>
            <AppText variant="tiny" tone="faint" align="center" style={{ marginTop: 4 }}>
              اضغط على أي كلمة لتحليلها · اضغط على رقم الآية لفتح التحليل العميق
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <VerseRow verse={item} palette={palette} spacing={spacing} radii={radii} />
        )}
      />
    </View>
  );
}

function VerseRow({
  verse,
  palette,
  spacing,
  radii,
}: {
  verse: QuranVerse;
  palette: ReturnType<typeof useTheme>['palette'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radii: ReturnType<typeof useTheme>['radii'];
}) {
  const openWord = (word: QuranWord) => {
    router.push({
      pathname: '/word/[form]',
      params: { form: word.surface, root: word.root ?? '', verseKey: verse.key },
    });
  };

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: radii.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.border,
        padding: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/verse/[key]', params: { key: verse.key } })}
        style={{ alignSelf: 'flex-start' }}
        hitSlop={8}
      >
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: palette.accentSoft,
          }}
        >
          <AppText variant="tiny" weight="bold" tone="accent">
            آية {toArabicNumerals(verse.ayahNumber)}
          </AppText>
        </View>
      </Pressable>

      {/* Word-level tap targets, laid out RTL so the line reads normally. */}
      <View
        style={{
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          marginTop: spacing.md,
          alignItems: 'center',
        }}
      >
        {verse.words.map((word) => (
          <Pressable
            key={word.index}
            onPress={() => openWord(word)}
            style={({ pressed }) => ({
              paddingHorizontal: 3,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor: pressed ? palette.quranHighlight : 'transparent',
            })}
          >
            <AppText variant="quran" tone="quran">
              {word.surface}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
