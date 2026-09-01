import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { Badge, Button, Card, Chip, EmptyState, Loading, Notice, Row, Section, T } from '@dd/components/ui';
import { PaletteStrip } from '@dd/components/ui/Swatch';
import { ENV } from '@dd/config/env';
import { colorHex, getColor, threadHex } from '@dd/data/colors';
import { getFabric } from '@dd/data/fabrics';
import { getTailor } from '@dd/data/tailors';
import type { Occasion, Season } from '@dd/domain/types';
import { formatMoney } from '@dd/engine/money';
import { useI18n, type StringKey } from '@dd/i18n';
import { stylistV2, type CompleteDesign } from '@dd/services/ai';
import { track } from '@dd/services/analytics';
import { useCartStore } from '@dd/store/cartStore';
import { useDesignStore } from '@dd/store/designStore';
import { useProfileStore } from '@dd/store/profileStore';
import { useStyleMemory } from '@dd/hooks/useStyleMemory';
import { theme } from '@dd/theme/tokens';
import { currentSeason, currentTimeOfDay } from '@dd/utils/date';

const OCCASIONS: { key: Occasion; labelKey: StringKey }[] = [
  { key: 'daily', labelKey: 'occasion.daily' },
  { key: 'work', labelKey: 'occasion.work' },
  { key: 'friday', labelKey: 'occasion.friday' },
  { key: 'eid', labelKey: 'occasion.eid' },
  { key: 'wedding', labelKey: 'occasion.wedding' },
  { key: 'formal', labelKey: 'occasion.formal' },
  { key: 'special', labelKey: 'occasion.special' },
];

const SEASONS: { key: Season; labelKey: StringKey }[] = [
  { key: 'summer', labelKey: 'season.summer' },
  { key: 'winter', labelKey: 'season.winter' },
  { key: 'all_year', labelKey: 'season.allYear' },
];

/**
 * AI STYLIST V2.
 *
 * Returns three COMPLETE, ORDERABLE designs — fabric, colour, pattern, every
 * thread, furakha, price difference and whether the chosen tailor can make it.
 *
 * The fabricated "94% suitable" figure is gone. Affinity is expressed in words
 * that describe the relationship to the customer's past choices, which is the
 * thing we actually know.
 */
export default function Stylist() {
  const router = useRouter();
  const { t, L, lang } = useI18n();
  const params = useLocalSearchParams<{ auto?: string; inspiration?: string }>();

  const config = useDesignStore((s) => s.config);
  const setConfig = useDesignStore((s) => s.setConfig);
  const memory = useStyleMemory();
  const customer = useProfileStore((s) => s.customer);
  const cartTailorId = useCartStore((s) => s.tailorBusinessId);
  const tailorId = cartTailorId ?? customer.favoriteTailorId ?? null;

  const [occasion, setOccasion] = useState<Occasion>('friday');
  const [season, setSeason] = useState<Season>(currentSeason() === 'summer' ? 'summer' : 'winter');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'evening'>(currentTimeOfDay());
  const [results, setResults] = useState<CompleteDesign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inspirationHexes = params.inspiration ? params.inspiration.split(',') : undefined;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      track('ai_stylist_used', { occasion, season, timeOfDay, tailorId: tailorId ?? 'any' });
      setResults(
        await stylistV2.recommend({
          current: config,
          occasion,
          season,
          timeOfDay,
          memory,
          tailorId,
          inspirationHexes,
          count: 3,
        }),
      );
    } catch {
      // A stylist failure must never block designing.
      setError(t('preview.failed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occasion, season, timeOfDay, config, memory, tailorId]);

  useEffect(() => {
    if (params.auto === '1' || params.inspiration) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (design: CompleteDesign) => {
    setConfig(design.config);
    track('ai_palette_applied', { designId: design.id, producible: design.availability.producible });
    router.push('/(tabs)/design');
  };

  return (
    <>
      <Stack.Screen options={{ title: t('stylist.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        {ENV.MOCK_AI_MODE ? <Notice text={t('stylist.mock')} tone="info" /> : null}
        {inspirationHexes ? (
          <Notice
            tone="success"
            text={L({ ar: 'تم استخدام ألوان الكمة/المصر في التنسيق.', en: 'Your kumma/mussar colours are used in these designs.' })}
          />
        ) : null}

        <Section title={t('stylist.occasion')}>
          <Row wrap gap={theme.space.sm}>
            {OCCASIONS.map((o) => (
              <Chip key={o.key} label={t(o.labelKey)} selected={occasion === o.key} onPress={() => setOccasion(o.key)} />
            ))}
          </Row>
        </Section>

        <Section title={t('stylist.season')}>
          <Row wrap gap={theme.space.sm}>
            {SEASONS.map((s) => (
              <Chip key={s.key} label={t(s.labelKey)} selected={season === s.key} onPress={() => setSeason(s.key)} />
            ))}
            <Chip label={t('time.day')} selected={timeOfDay === 'day'} onPress={() => setTimeOfDay('day')} />
            <Chip label={t('time.evening')} selected={timeOfDay === 'evening'} onPress={() => setTimeOfDay('evening')} />
          </Row>
        </Section>

        <Button
          label={results.length ? t('stylist.regenerate') : t('stylist.generate')}
          onPress={run}
          loading={loading}
          full
          size="lg"
        />

        {error ? <Notice text={error} tone="warning" /> : null}
        {loading ? <Loading label={t('common.loading')} /> : null}
        {!loading && results.length === 0 && !error ? (
          <EmptyState title={t('stylist.subtitle')} />
        ) : null}

        {!loading && results.length > 0 ? (
          <Section title={t('stylist.completeDesigns')}>
            <View style={{ gap: theme.space.md }}>
              {results.map((design) => {
                const fabric = getFabric(design.fabricId);
                const base = getColor(design.baseColorId);
                const tailor = getTailor(design.availability.tailorId);
                return (
                  <Card key={design.id} padded={false}>
                    <Row align="stretch" gap={0}>
                      <View style={{ backgroundColor: theme.color.bgSunken, justifyContent: 'center', paddingHorizontal: theme.space.sm }}>
                        <DishdashaFigure config={design.config} width={78} height={112} transparentBackground />
                      </View>
                      <View style={{ flex: 1, padding: theme.space.md, gap: 8 }}>
                        <Row justify="space-between">
                          <Badge label={t(design.matchLabel)} tone="accent" />
                          <T variant="tiny" weight="700" color={theme.color.accent}>
                            {formatMoney(design.totalPrice, lang)}
                          </T>
                        </Row>
                        <T variant="tiny" weight="700">
                          {L(fabric?.name)} · {L(base?.name)}
                        </T>
                        <PaletteStrip
                          hexes={[colorHex(design.baseColorId), ...design.threadColorIds.map((id) => threadHex(id))]}
                          size={16}
                        />
                        <T variant="tiny" color={theme.color.textMuted} numberOfLines={3}>
                          {L(design.reason)}
                        </T>
                        <Row justify="space-between" wrap gap={theme.space.sm}>
                          <T variant="tiny" color={theme.color.textFaint}>
                            {t('stylist.priceDiff')}: {design.priceDelta >= 0 ? '+' : ''}
                            {formatMoney(design.priceDelta, lang)}
                          </T>
                          {design.availability.producible ? (
                            <T variant="tiny" color={theme.color.success}>
                              {t('stylist.availableAt')} {L(tailor?.name) || '—'}
                            </T>
                          ) : (
                            <T variant="tiny" color={theme.color.warning}>
                              {t('stylist.notAvailable')}
                            </T>
                          )}
                        </Row>
                        <Button label={t('stylist.useDesign')} size="sm" onPress={() => apply(design)} full />
                      </View>
                    </Row>
                  </Card>
                );
              })}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}
