import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { Dishdasha360Viewer } from '@dd/components/dishdasha/v2/Dishdasha360Viewer';
import { configSummary, paletteHexes } from '@dd/components/cards';
import { Badge, Button, Card, EmptyState, Notice, Row, T } from '@dd/components/ui';
import { PaletteStrip } from '@dd/components/ui/Swatch';
import { getColor, getThreadColor } from '@dd/data/colors';
import { scorePairing } from '@dd/engine/colorHarmony';
import { formatMoney } from '@dd/engine/money';
import { calculatePrice } from '@dd/engine/pricing';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import { getTailor } from '@dd/data/tailors';
import { useI18n } from '@dd/i18n';
import { useDesignStore } from '@dd/store/designStore';
import { useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';

const LABELS = ['A', 'B', 'C'];

/**
 * COMPARE MODE.
 *
 * Side-by-side on a phone means a horizontal carousel, not a squeezed grid.
 * The recommendation reuses the same pairing score the stylist uses, so the
 * app never contradicts itself about which combination is stronger.
 */
export default function Compare() {
  const router = useRouter();
  const { t, L, lang } = useI18n();

  // ONE camera angle shared by every card: comparing colour or embroidery is
  // meaningless if the garments are turned differently or lit differently.
  const [sharedAngle, setSharedAngle] = React.useState(0);
  const slots = useDesignStore((s) => s.compareSlots);
  const removeFromCompare = useDesignStore((s) => s.removeFromCompare);
  const setConfig = useDesignStore((s) => s.setConfig);
  const addToCompare = useDesignStore((s) => s.addToCompare);
  const favoriteTailorId = useProfileStore((s) => s.customer.favoriteTailorId);

  const scored = useMemo(
    () =>
      slots.map((config) => {
        const baseHex = getColor(config.baseColorId)?.hex ?? '#FFFFFF';
        const threadHex = getThreadColor(config.threadColorIds[0] ?? '')?.hex ?? '#000000';
        return {
          config,
          score: scorePairing(baseHex, threadHex, 3.2),
          price: calculatePrice({
            config,
            fabric: getFabric(config.fabricId),
            pattern: getPattern(config.embroideryPatternId),
            tailor: getTailor(favoriteTailorId),
            quantity: 1,
          }),
        };
      }),
    [slots, favoriteTailorId],
  );

  const bestIndex = useMemo(() => {
    if (scored.length < 2) return -1;
    let best = 0;
    scored.forEach((s, i) => {
      if (s.score > scored[best].score) best = i;
    });
    return best;
  }, [scored]);

  return (
    <>
      <Stack.Screen options={{ title: t('compare.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        {slots.length === 0 ? (
          <EmptyState
            title={t('compare.empty')}
            action={{ label: t('compare.add'), onPress: () => { addToCompare(); } }}
          />
        ) : null}

        {slots.length > 0 ? (
          <>
            <Button label={t('compare.add')} onPress={() => addToCompare()} variant="secondary" full />
            {/* Turning this viewer turns every card with it. */}
            <Card padded={false}>
              <View style={{ alignItems: 'center', paddingVertical: theme.space.md }}>
                <Dishdasha360Viewer
                  config={slots[0]}
                  width={190}
                  height={250}
                  onAngleChange={setSharedAngle}
                  showSnapControls
                />
              </View>
            </Card>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
              {scored.map((entry, index) => (
                <Card key={index} padded={false} style={{ width: 230 }}>
                  <View style={{ backgroundColor: theme.color.bgSunken, alignItems: 'center', paddingVertical: theme.space.md }}>
                    <DishdashaFigure
                      config={entry.config}
                      width={124}
                      height={194}
                      angle={sharedAngle}
                      transparentBackground
                    />
                  </View>
                  <View style={{ padding: theme.space.md, gap: 8 }}>
                    <Row justify="space-between">
                      <T variant="heading">{LABELS[index]}</T>
                      {index === bestIndex ? <Badge label={t('compare.aiPick')} tone="accent" /> : null}
                    </Row>
                    <T variant="tiny" color={theme.color.textMuted} numberOfLines={2}>
                      {configSummary(entry.config, L)}
                    </T>
                    <PaletteStrip hexes={paletteHexes(entry.config)} size={16} />
                    <T variant="small" weight="700" color={theme.color.accent}>
                      {formatMoney(entry.price.total, lang)}
                    </T>
                    <Button
                      label={t('compare.use')}
                      size="sm"
                      onPress={() => {
                        setConfig(entry.config);
                        router.push('/(tabs)/design');
                      }}
                      full
                    />
                    <Button label={t('common.delete')} size="sm" variant="ghost" onPress={() => removeFromCompare(index)} full />
                  </View>
                </Card>
              ))}
            </ScrollView>

            {bestIndex >= 0 ? (
              <Notice
                tone="info"
                title={`${t('compare.aiPick')} ${LABELS[bestIndex]}`}
                text={L({
                  ar: 'هذا التنسيق حقق أفضل توازن بين وضوح التطريز على القماش وانسجام الألوان، حسب محرك التنسيق نفسه المستخدم في المنسق الذكي.',
                  en: 'This combination scored the best balance of embroidery legibility on the fabric and colour harmony, using the same engine as the stylist.',
                })}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
