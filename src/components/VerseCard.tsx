import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AppText, Badge, Card } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { useFavoritesStore } from '../store/favoritesStore';
import { toArabicNumerals } from '../quran/arabic';
import type { QuranReference } from '../types/quran';

interface VerseCardProps {
  reference: QuranReference;
  /** Why this verse was surfaced — shown under the text, never inside it. */
  relevance?: string;
  onPress?: () => void;
  showFavorite?: boolean;
  highlight?: string[];
}

export function VerseCard({
  reference,
  relevance,
  onPress,
  showFavorite = true,
  highlight,
}: VerseCardProps) {
  const { palette, spacing } = useTheme();
  const favorites = useFavoritesStore();
  const favoriteId = `verse:${reference.key}`;
  const isFavorite = favorites.items.some((i) => i.id === favoriteId);

  const handlePress =
    onPress ?? (() => router.push({ pathname: '/verse/[key]', params: { key: reference.key } }));

  const reason = relevance ?? reference.relevance;

  return (
    <Card onPress={handlePress} style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <AppText variant="small" weight="bold" tone="accent">
            {reference.surahNameArabic}
          </AppText>
          <AppText variant="tiny" tone="faint">
            {toArabicNumerals(reference.surah)} : {toArabicNumerals(reference.ayah)}
          </AppText>
        </View>

        {showFavorite ? (
          <Pressable
            hitSlop={10}
            onPress={() =>
              favorites.toggle({
                id: favoriteId,
                kind: 'verse',
                createdAt: new Date().toISOString(),
                title: `${reference.surahNameArabic} ${reference.surah}:${reference.ayah}`,
                subtitle: reference.text.slice(0, 60),
                verseKey: reference.key,
                reference,
              })
            }
          >
            <AppText variant="small" tone={isFavorite ? 'accent' : 'faint'}>
              {isFavorite ? '★' : '☆'}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <AppText variant="quran" tone="quran" style={{ marginTop: spacing.md }} selectable>
        {reference.text}
      </AppText>

      {reason ? (
        <View
          style={{
            marginTop: spacing.md,
            paddingTop: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: palette.border,
          }}
        >
          <AppText variant="tiny" tone="faint" style={{ marginBottom: 2 }}>
            سبب الارتباط بالسؤال
          </AppText>
          <AppText variant="small" tone="muted">
            {reason}
          </AppText>
        </View>
      ) : null}

      {highlight && highlight.length > 0 ? (
        <View style={{ marginTop: spacing.sm, flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' }}>
          {highlight.map((h) => (
            <Badge key={h} label={h} tone="accent" />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
