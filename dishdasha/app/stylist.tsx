import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { PaletteCard } from '@dd/components/cards';
import { Button, Chip, EmptyState, Loading, Notice, Row, Section, T } from '@dd/components/ui';
import { ENV } from '@dd/config/env';
import { CURATED_PALETTES } from '@dd/data/palettes';
import type { Occasion, PaletteSuggestion, Season } from '@dd/domain/types';
import { applyPattern, normalizeConfig } from '@dd/engine/design';
import { useI18n, type StringKey } from '@dd/i18n';
import { colorRecommendationService } from '@dd/services/ai';
import { track } from '@dd/services/analytics';
import { useDesignStore } from '@dd/store/designStore';
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
 * AI DISHDASHA STYLIST.
 *
 * The candidates come from the deterministic harmony engine and are ranked
 * against this customer's style memory. The percentage is labelled as
 * recommendation affinity, never as a scientific fit.
 */
export default function Stylist() {
  const router = useRouter();
  const { t, L } = useI18n();
  const params = useLocalSearchParams<{ auto?: string; inspiration?: string }>();

  const config = useDesignStore((s) => s.config);
  const applyPalette = useDesignStore((s) => s.applyPalette);
  const memory = useStyleMemory();

  const [occasion, setOccasion] = useState<Occasion>('friday');
  const [season, setSeason] = useState<Season>(currentSeason() === 'summer' ? 'summer' : 'winter');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'evening'>(currentTimeOfDay());
  const [lockBase, setLockBase] = useState(false);
  const [results, setResults] = useState<PaletteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inspirationHexes = params.inspiration ? params.inspiration.split(',') : undefined;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      track('ai_stylist_used', { occasion, season, timeOfDay, locked: lockBase });
      const suggestions = await colorRecommendationService.recommend({
        baseColorId: lockBase ? config.baseColorId : null,
        occasion,
        season,
        timeOfDay,
        channelCount: (config.threadColorIds.length || 2) as 1 | 2 | 3,
        memory,
        inspirationHexes,
        count: 6,
      });
      setResults(suggestions);
    } catch {
      // The stylist failing must never block designing — curated palettes
      // stand in and the configurator keeps working.
      setError(t('preview.failed'));
      setResults(CURATED_PALETTES);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occasion, season, timeOfDay, lockBase, config.baseColorId, config.threadColorIds.length, memory]);

  useEffect(() => {
    if (params.auto === '1' || params.inspiration) void run();
    // Runs once for an auto-triggered entry (e.g. "let AI refresh it").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (palette: PaletteSuggestion) => {
    applyPalette(palette);
    track('ai_palette_applied', { paletteId: palette.id, harmony: palette.harmony, score: palette.matchScore });
    router.push('/(tabs)/design');
  };

  return (
    <>
      <Stack.Screen options={{ title: t('stylist.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        <T variant="small" color={theme.color.textMuted}>
          {t('stylist.subtitle')}
        </T>

        {ENV.MOCK_AI_MODE ? <Notice text={t('stylist.mock')} tone="info" /> : null}
        {inspirationHexes ? (
          <Notice
            tone="success"
            text={L({ ar: 'تم استخدام ألوان الكمة/المصر في التنسيق.', en: 'Your kumma/mussar colours are being used in these palettes.' })}
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
          </Row>
        </Section>

        <Section title={t('stylist.time')}>
          <Row wrap gap={theme.space.sm}>
            <Chip label={t('time.day')} selected={timeOfDay === 'day'} onPress={() => setTimeOfDay('day')} />
            <Chip label={t('time.evening')} selected={timeOfDay === 'evening'} onPress={() => setTimeOfDay('evening')} />
            <Chip
              label={L({ ar: 'ثبّت لون القماش الحالي', en: 'Keep current fabric colour' })}
              selected={lockBase}
              onPress={() => setLockBase(!lockBase)}
            />
          </Row>
        </Section>

        <Button label={results.length ? t('stylist.regenerate') : t('stylist.generate')} onPress={run} loading={loading} full size="lg" />

        {error ? <Notice text={error} tone="warning" /> : null}

        {loading ? <Loading label={t('common.loading')} /> : null}

        {!loading && results.length === 0 ? (
          <EmptyState title={t('stylist.subtitle')} body={t('stylist.matchNote')} />
        ) : null}

        {!loading && results.length > 0 ? (
          <Section title={t('home.aiPicks')} subtitle={t('stylist.matchNote')}>
            <View style={{ gap: theme.space.md }}>
              {results.map((palette) => (
                <View key={palette.id} style={{ gap: theme.space.sm }}>
                  <PaletteCard
                    palette={palette}
                    onApply={() => apply(palette)}
                    previewConfig={normalizeConfig({
                      ...applyPattern(config, palette.suggestedPatternId ?? config.embroideryPatternId),
                      baseColorId: palette.baseColorId,
                      threadColorIds: palette.threadColorIds,
                      furakhaColorId: palette.furakhaColorId,
                    })}
                  />
                  <Button label={t('stylist.apply')} onPress={() => apply(palette)} variant="secondary" size="sm" />
                </View>
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}
