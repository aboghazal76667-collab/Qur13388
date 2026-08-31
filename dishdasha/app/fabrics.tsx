import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { FabricCard } from '@dd/components/cards';
import { Chip, EmptyState, Row, T } from '@dd/components/ui';
import type { FabricCategory } from '@dd/domain/types';
import { useI18n } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useCatalogStore } from '@dd/store/catalogStore';
import { useDesignStore } from '@dd/store/designStore';
import { theme } from '@dd/theme/tokens';

const CATEGORIES: FabricCategory[] = ['light_summer', 'daily', 'premium', 'formal', 'winter', 'easy_care'];

export default function FabricDiscovery() {
  const router = useRouter();
  const { t, L, lang } = useI18n();
  const fabrics = useCatalogStore((s) => s.fabrics);
  const setFabric = useDesignStore((s) => s.setFabric);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FabricCategory | 'all'>('all');
  const [season, setSeason] = useState<'all' | 'summer' | 'winter'>('all');

  const labels: Record<FabricCategory, string> = {
    light_summer: L({ ar: 'صيفي خفيف', en: 'Light summer' }),
    daily: L({ ar: 'يومي', en: 'Daily' }),
    premium: L({ ar: 'فاخر', en: 'Premium' }),
    formal: L({ ar: 'رسمي', en: 'Formal' }),
    winter: L({ ar: 'شتوي', en: 'Winter' }),
    easy_care: L({ ar: 'سهل العناية', en: 'Easy care' }),
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fabrics.filter((f) => {
      if (!f.active) return false;
      if (category !== 'all' && f.category !== category) return false;
      if (season !== 'all' && f.season !== season && f.season !== 'all_year') return false;
      if (!q) return true;
      return (
        f.brand.toLowerCase().includes(q) ||
        f.name.ar.includes(query.trim()) ||
        f.name.en.toLowerCase().includes(q) ||
        (f.composition ?? '').toLowerCase().includes(q)
      );
    });
  }, [fabrics, query, category, season]);

  return (
    <>
      <Stack.Screen options={{ title: t('discover.fabrics') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('common.search')}
          placeholderTextColor={theme.color.textFaint}
          style={{
            borderWidth: 1,
            borderColor: theme.color.border,
            borderRadius: theme.radius.sm,
            padding: theme.space.md,
            minHeight: theme.hit,
            backgroundColor: theme.color.surface,
            color: theme.color.text,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.sm }}>
          <Row gap={theme.space.sm}>
            <Chip label={t('common.all')} selected={category === 'all'} onPress={() => setCategory('all')} />
            {CATEGORIES.map((c) => (
              <Chip key={c} label={labels[c]} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </Row>
        </ScrollView>
        <Row gap={theme.space.sm}>
          <Chip label={t('season.allYear')} selected={season === 'all'} onPress={() => setSeason('all')} small />
          <Chip label={t('season.summer')} selected={season === 'summer'} onPress={() => setSeason('summer')} small />
          <Chip label={t('season.winter')} selected={season === 'winter'} onPress={() => setSeason('winter')} small />
        </Row>

        {results.length === 0 ? (
          <EmptyState title={t('discover.noResults')} />
        ) : (
          <Row wrap gap={theme.space.md} align="flex-start">
            {results.map((fabric) => (
              <FabricCard
                key={fabric.id}
                fabric={fabric}
                onPress={() => {
                  setFabric(fabric.id);
                  track('fabric_selected', { fabricId: fabric.id, from: 'discovery' });
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
