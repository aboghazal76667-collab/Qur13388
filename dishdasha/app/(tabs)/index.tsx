import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fullBrandName } from '@dd/config/brand';
import { ENV } from '@dd/config/env';
import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { DesignCard, FabricCard, OrderCard, PaletteCard, PatternCard, configSummary } from '@dd/components/cards';
import { Badge, Button, Card, Row, Section, T } from '@dd/components/ui';
import { CURATED_PALETTES } from '@dd/data/palettes';
import { applyPattern, normalizeConfig } from '@dd/engine/design';
import { formatMoney } from '@dd/engine/money';
import { activeOrders } from '@dd/engine/orders';
import { useI18n } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useCartStore } from '@dd/store/cartStore';
import { useCatalogStore } from '@dd/store/catalogStore';
import { useDesignStore, visibleDesigns } from '@dd/store/designStore';
import { useOrdersStore } from '@dd/store/ordersStore';
import { useProfileStore } from '@dd/store/profileStore';
import { useUsualConfig } from '@dd/hooks/useStyleMemory';
import { usePricing } from '@dd/hooks/usePricing';
import { theme } from '@dd/theme/tokens';

/**
 * HOME.
 *
 * Built to make the thesis legible in about fifteen seconds: this is not a
 * catalogue, it is a customer's own tailoring profile. Reorder, saved designs
 * and a live order come before any browsing.
 */
export default function Home() {
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const customer = useProfileStore((s) => s.customer);
  const orders = useOrdersStore((s) => s.orders);
  const savedDesigns = useDesignStore((s) => s.savedDesigns);
  const setConfig = useDesignStore((s) => s.setConfig);
  const loadDesign = useDesignStore((s) => s.loadDesign);
  const toggleFavorite = useDesignStore((s) => s.toggleFavorite);
  const addToCart = useCartStore((s) => s.add);
  const selectedMeasurementId = useProfileStore((s) => s.selectedMeasurementId);
  const fabrics = useCatalogStore((s) => s.fabrics);
  const patterns = useCatalogStore((s) => s.patterns);

  const usual = useUsualConfig();
  const heroConfig = usual?.config ?? useDesignStore.getState().config;
  const usualPrice = usePricing(heroConfig, { quantity: 1, tailorId: customer.favoriteTailorId });

  const live = useMemo(() => activeOrders(orders), [orders]);
  const designs = useMemo(() => visibleDesigns(savedDesigns).slice(0, 6), [savedDesigns]);
  const popularPatterns = useMemo(
    () => patterns.filter((p) => p.active && p.motif !== 'none').sort((a, b) => b.popularity - a.popularity).slice(0, 8),
    [patterns],
  );
  const featuredFabrics = useMemo(
    () => fabrics.filter((f) => f.active && f.inStock).slice(0, 6),
    [fabrics],
  );

  const openStudio = () => {
    track('design_started', { from: 'home' });
    router.push('/(tabs)/design');
  };

  const reorderUsual = () => {
    if (!usual) return;
    track('reorder_clicked', { source: usual.source });
    addToCart(usual.config, {
      quantity: 1,
      measurementProfileId: selectedMeasurementId,
      tailorBusinessId: customer.favoriteTailorId,
    });
    router.push('/cart');
  };

  const reorderNewColor = () => {
    if (!usual) return;
    track('reorder_clicked', { source: 'new_color' });
    setConfig(usual.config);
    router.push('/stylist');
  };

  const refreshWithAi = () => {
    if (!usual) return;
    track('reorder_clicked', { source: 'ai_refresh' });
    setConfig(usual.config);
    router.push({ pathname: '/stylist', params: { auto: '1' } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xxl, paddingBottom: theme.space.xxxl }}>
        <Row justify="space-between">
          <View style={{ gap: 2 }}>
            <T variant="small" color={theme.color.textMuted}>
              {t('home.greeting')}
            </T>
            <T variant="title">{customer.name || fullBrandName(lang)}</T>
          </View>
          {ENV.DEMO_MODE ? <Badge label={t('auth.demoBadge')} tone="warning" /> : null}
        </Row>

        {/* ── hero ── */}
        <Card padded={false} elevated>
          <View style={{ backgroundColor: theme.color.bgSunken, alignItems: 'center', paddingVertical: theme.space.lg }}>
            <DishdashaFigure config={heroConfig} width={196} height={307} realistic />
          </View>
          <View style={{ padding: theme.space.lg, gap: theme.space.md }}>
            <T variant="title">{t('home.heroCta')}</T>
            <T variant="small" color={theme.color.textMuted}>
              {t('home.heroSub')}
            </T>
            <Button label={t('home.heroCta')} onPress={openStudio} full size="lg" />
          </View>
        </Card>

        {/* ── active order ── */}
        {live.length > 0 ? (
          <Section
            title={t('home.activeOrder')}
            action={{ label: t('common.seeAll'), onPress: () => router.push('/(tabs)/orders') }}
          >
            <OrderCard order={live[0]} onPress={() => router.push(`/order/${live[0].id}`)} />
          </Section>
        ) : null}

        {/* ── usual dishdasha ── */}
        {usual ? (
          <Section title={t('home.usual')}>
            <Card>
              <View style={{ gap: theme.space.md }}>
                <Row gap={theme.space.md} align="flex-start">
                  <View style={{ backgroundColor: theme.color.bgSunken, borderRadius: theme.radius.sm, padding: 6 }}>
                    <DishdashaFigure config={usual.config} width={64} height={100} transparentBackground />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="small" weight="700">
                      {configSummary(usual.config, L)}
                    </T>
                    <T variant="tiny" color={theme.color.textMuted}>
                      {t('checkout.measurement')}: {t('measure.status.tailor_verified')}
                    </T>
                    <T variant="small" weight="700" color={theme.color.accent}>
                      {formatMoney(usualPrice.total, lang)}
                    </T>
                  </View>
                </Row>
                <Button label={t('home.usualAgain')} onPress={reorderUsual} full />
                <Row gap={theme.space.sm}>
                  <Button label={t('home.usualNewColor')} variant="secondary" size="sm" onPress={reorderNewColor} style={{ flex: 1 }} />
                  <Button label={t('home.usualAi')} variant="secondary" size="sm" onPress={refreshWithAi} style={{ flex: 1 }} />
                </Row>
              </View>
            </Card>
          </Section>
        ) : null}

        {/* ── AI stylist ── */}
        <Section title={t('home.aiPicks')} subtitle={t('home.stylistSub')} action={{ label: t('home.stylistCta'), onPress: () => router.push('/stylist') }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
            {CURATED_PALETTES.slice(0, 4).map((palette) => (
              <PaletteCard
                key={palette.id}
                palette={palette}
                compact
                previewConfig={normalizeConfig({
                  ...applyPattern(heroConfig, palette.suggestedPatternId),
                  baseColorId: palette.baseColorId,
                  threadColorIds: palette.threadColorIds,
                  furakhaColorId: palette.furakhaColorId,
                })}
                onApply={() => {
                  useDesignStore.getState().applyPalette(palette);
                  track('ai_palette_applied', { paletteId: palette.id, source: 'home_curated' });
                  router.push('/(tabs)/design');
                }}
              />
            ))}
          </ScrollView>
        </Section>

        {/* ── saved designs ── */}
        {designs.length > 0 ? (
          <Section title={t('home.savedDesigns')} action={{ label: t('common.seeAll'), onPress: () => router.push('/(tabs)/saved') }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
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
            </ScrollView>
          </Section>
        ) : null}

        {/* ── popular embroidery ── */}
        <Section title={t('home.popularEmbroidery')} action={{ label: t('common.seeAll'), onPress: () => router.push('/patterns') }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
            {popularPatterns.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                onPress={() => {
                  useDesignStore.getState().setPattern(pattern.id);
                  track('embroidery_selected', { patternId: pattern.id, from: 'home' });
                  router.push('/(tabs)/design');
                }}
              />
            ))}
          </ScrollView>
        </Section>

        {/* ── fabrics ── */}
        <Section title={t('home.fabrics')} action={{ label: t('common.seeAll'), onPress: () => router.push('/fabrics') }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
            {featuredFabrics.map((fabric) => (
              <FabricCard
                key={fabric.id}
                fabric={fabric}
                onPress={() => {
                  useDesignStore.getState().setFabric(fabric.id);
                  track('fabric_selected', { fabricId: fabric.id, from: 'home' });
                  router.push('/(tabs)/design');
                }}
              />
            ))}
          </ScrollView>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
