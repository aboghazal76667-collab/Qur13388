import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DesignCard, FabricCard, PatternCard, PaletteCard } from '@dd/components/cards';
import { Chip, EmptyState, Row, T } from '@dd/components/ui';
import { CURATED_PALETTES } from '@dd/data/palettes';
import { useI18n } from '@dd/i18n';
import { useCatalogStore } from '@dd/store/catalogStore';
import { useDesignStore, visibleDesigns } from '@dd/store/designStore';
import { useStyleMemory } from '@dd/hooks/useStyleMemory';
import { theme } from '@dd/theme/tokens';

type Tab = 'designs' | 'fabrics' | 'patterns' | 'palettes';

export default function Saved() {
  const router = useRouter();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('designs');

  const savedDesigns = useDesignStore((s) => s.savedDesigns);
  const loadDesign = useDesignStore((s) => s.loadDesign);
  const toggleFavorite = useDesignStore((s) => s.toggleFavorite);
  const applyPalette = useDesignStore((s) => s.applyPalette);
  const setFabric = useDesignStore((s) => s.setFabric);
  const setPattern = useDesignStore((s) => s.setPattern);

  const fabrics = useCatalogStore((s) => s.fabrics);
  const patterns = useCatalogStore((s) => s.patterns);
  const memory = useStyleMemory();

  const designs = useMemo(() => visibleDesigns(savedDesigns), [savedDesigns]);
  const favouriteFabrics = useMemo(
    () => fabrics.filter((f) => memory.favoriteFabricIds.includes(f.id)),
    [fabrics, memory.favoriteFabricIds],
  );
  const favouritePatterns = useMemo(
    () => patterns.filter((p) => memory.favoritePatternIds.includes(p.id)),
    [patterns, memory.favoritePatternIds],
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'designs', label: t('saved.designs') },
    { key: 'fabrics', label: t('saved.fabrics') },
    { key: 'patterns', label: t('saved.patterns') },
    { key: 'palettes', label: t('saved.palettes') },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.bg }}
      contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
    >
      <Row gap={theme.space.sm} wrap>
        {tabs.map((x) => (
          <Chip key={x.key} label={x.label} selected={tab === x.key} onPress={() => setTab(x.key)} />
        ))}
      </Row>

      {tab === 'designs' ? (
        designs.length === 0 ? (
          <EmptyState title={t('saved.empty')} action={{ label: t('cart.emptyCta'), onPress: () => router.push('/(tabs)/design') }} />
        ) : (
          <Row wrap gap={theme.space.md} align="flex-start">
            {designs.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                onToggleFavorite={() => toggleFavorite(design.id)}
                onPress={() => {
                  loadDesign(design.id);
                  router.push('/(tabs)/design');
                }}
              />
            ))}
          </Row>
        )
      ) : null}

      {tab === 'fabrics' ? (
        favouriteFabrics.length === 0 ? (
          <EmptyState title={t('saved.empty')} />
        ) : (
          <Row wrap gap={theme.space.md} align="flex-start">
            {favouriteFabrics.map((fabric) => (
              <FabricCard
                key={fabric.id}
                fabric={fabric}
                onPress={() => {
                  setFabric(fabric.id);
                  router.push('/(tabs)/design');
                }}
              />
            ))}
          </Row>
        )
      ) : null}

      {tab === 'patterns' ? (
        favouritePatterns.length === 0 ? (
          <EmptyState title={t('saved.empty')} />
        ) : (
          <Row wrap gap={theme.space.md} align="flex-start">
            {favouritePatterns.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                onPress={() => {
                  setPattern(pattern.id);
                  router.push('/(tabs)/design');
                }}
              />
            ))}
          </Row>
        )
      ) : null}

      {tab === 'palettes' ? (
        <View style={{ gap: theme.space.md }}>
          {CURATED_PALETTES.map((palette) => (
            <PaletteCard
              key={palette.id}
              palette={palette}
              onApply={() => {
                applyPalette(palette);
                router.push('/(tabs)/design');
              }}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
