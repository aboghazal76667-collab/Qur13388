import React, { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { PatternCard } from '@dd/components/cards';
import { Chip, EmptyState, Row } from '@dd/components/ui';
import { EMBROIDERY_COLLECTIONS } from '@dd/data/embroidery';
import { useI18n } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useCatalogStore } from '@dd/store/catalogStore';
import { useDesignStore } from '@dd/store/designStore';
import { theme } from '@dd/theme/tokens';

export default function PatternDiscovery() {
  const router = useRouter();
  const { t, L } = useI18n();
  const patterns = useCatalogStore((s) => s.patterns);
  const setPattern = useDesignStore((s) => s.setPattern);

  const [family, setFamily] = useState<string>('all');
  const [channels, setChannels] = useState<0 | 1 | 2 | 3>(0);
  const [sort, setSort] = useState<'popular' | 'new'>('popular');

  const results = useMemo(() => {
    const list = patterns.filter((p) => {
      if (!p.active || p.motif === 'none') return false;
      if (family !== 'all' && p.styleFamily !== family) return false;
      if (channels !== 0 && p.channelCount !== channels) return false;
      return true;
    });
    return sort === 'popular'
      ? [...list].sort((a, b) => b.popularity - a.popularity)
      : [...list].sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.popularity - a.popularity);
  }, [patterns, family, channels, sort]);

  return (
    <>
      <Stack.Screen options={{ title: t('discover.patterns') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.sm }}>
          <Row gap={theme.space.sm}>
            <Chip label={t('common.all')} selected={family === 'all'} onPress={() => setFamily('all')} />
            {EMBROIDERY_COLLECTIONS.map((c) => (
              <Chip key={c.id} label={L(c.name)} selected={family === c.id} onPress={() => setFamily(c.id)} />
            ))}
          </Row>
        </ScrollView>

        <Row gap={theme.space.sm} wrap>
          <Chip label={t('common.all')} selected={channels === 0} onPress={() => setChannels(0)} small />
          {([1, 2, 3] as const).map((n) => (
            <Chip key={n} label={`${n} ${t('studio.thread')}`} selected={channels === n} onPress={() => setChannels(n)} small />
          ))}
          <Chip label={t('common.popular')} selected={sort === 'popular'} onPress={() => setSort('popular')} small />
          <Chip label={t('common.new')} selected={sort === 'new'} onPress={() => setSort('new')} small />
        </Row>

        {results.length === 0 ? (
          <EmptyState title={t('discover.noResults')} />
        ) : (
          <Row wrap gap={theme.space.md} align="flex-start">
            {results.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                onPress={() => {
                  setPattern(pattern.id);
                  track('embroidery_selected', { patternId: pattern.id, from: 'discovery' });
                  router.push('/(tabs)/design');
                }}
              />
            ))}
          </Row>
        )}
      </ScrollView>
    </>
  );
}
