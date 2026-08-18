import React from 'react';
import { router } from 'expo-router';

import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../src/components/primitives';
import { useTheme } from '../src/theme/ThemeProvider';
import { useFavoritesStore } from '../src/store/favoritesStore';
import type { Favorite, FavoriteKind } from '../src/types/app';

const KIND_LABEL: Record<FavoriteKind, string> = {
  verse: 'آية',
  analysis: 'تحليل',
  claim: 'ادعاء',
  comparison: 'مقارنة',
  word: 'كلمة',
};

export default function FavoritesScreen() {
  const { spacing } = useTheme();
  const favorites = useFavoritesStore();

  const open = (item: Favorite) => {
    switch (item.kind) {
      case 'verse':
        router.push({ pathname: '/verse/[key]', params: { key: item.verseKey } });
        break;
      case 'analysis':
        router.push({ pathname: '/analysis/[id]', params: { id: item.result.id } });
        break;
      case 'claim':
        router.push({ pathname: '/thinker/[id]', params: { id: item.claim.thinkerId } });
        break;
      case 'word':
        router.push({
          pathname: '/word/[form]',
          params: { form: item.analysis.word, root: item.analysis.root ?? '' },
        });
        break;
      case 'comparison':
        router.push('/compare');
        break;
    }
  };

  if (favorites.items.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="لا توجد محفوظات"
          message="احفظ آية أو تحليلًا أو مقارنة بالضغط على النجمة، وستظهر هنا."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title" weight="bold">
        المحفوظات
      </AppText>
      <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
        {favorites.items.length} عنصر محفوظ على هذا الجهاز.
      </AppText>

      <Spacer size={spacing.lg} />
      <SectionTitle>العناصر</SectionTitle>

      {favorites.items.map((item) => (
        <Card key={item.id} style={{ marginBottom: spacing.md }} onPress={() => open(item)}>
          <Row gap={8} style={{ justifyContent: 'space-between' }}>
            <Badge label={KIND_LABEL[item.kind]} tone="accent" />
            <AppText variant="tiny" tone="faint">
              {new Date(item.createdAt).toLocaleDateString('ar')}
            </AppText>
          </Row>

          <AppText variant="body" weight="medium" style={{ marginTop: spacing.sm }}>
            {item.title}
          </AppText>
          {item.subtitle ? (
            <AppText variant="small" tone="muted" style={{ marginTop: 4 }} numberOfLines={2}>
              {item.subtitle}
            </AppText>
          ) : null}

          <Row gap={6} style={{ marginTop: spacing.md }}>
            <Chip label="إزالة" compact onPress={() => favorites.remove(item.id)} />
          </Row>
        </Card>
      ))}

      <Spacer size={spacing.lg} />
      <Button label="مسح كل المحفوظات" variant="ghost" onPress={() => favorites.clear()} />
    </Screen>
  );
}
