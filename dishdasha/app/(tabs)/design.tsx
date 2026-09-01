import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { configSummary } from '@dd/components/cards';
import { Button, Card, Notice, Row, StickyBar, T } from '@dd/components/ui';
import { StepRail } from '@dd/features/studio/StepRail';
import { StudioStage, type StageMode } from '@dd/features/studio/StudioStage';
import {
  ColorPanel,
  DetailsPanel,
  FabricPanel,
  FurakhaPanel,
  PatternPanel,
  ThreadPanel,
} from '@dd/features/studio/panels';
import { validateConfig } from '@dd/engine/design';
import { formatMoney } from '@dd/engine/money';
import { useI18n, type StringKey } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useCartStore } from '@dd/store/cartStore';
import { useCatalogStore } from '@dd/store/catalogStore';
import { useDesignStore } from '@dd/store/designStore';
import { activeMeasurements, useProfileStore } from '@dd/store/profileStore';
import { usePricing } from '@dd/hooks/usePricing';
import { theme } from '@dd/theme/tokens';

type Step = 'fabric' | 'color' | 'pattern' | 'threads' | 'furakha' | 'details' | 'review';

/**
 * THE DESIGN STUDIO — V2.
 *
 * The V1 studio put seven step chips, five zoom chips, a price, four utility
 * actions and a primary action on screen at once, which made a tailoring app
 * feel like CAD. V2 shows ONE decision at a time:
 *
 *   - the garment occupies roughly 60% of the screen and is the hero
 *   - the stage follows the step (thread colours zoom to the shaq, and so on)
 *   - the bottom bar carries the price and exactly one primary action
 *   - utilities live behind "more options", not on the main bar
 *
 * Every V1 capability is still reachable. None was removed.
 */
const STEPS: { key: Step; labelKey: StringKey; stage: StageMode }[] = [
  { key: 'fabric', labelKey: 'studio.step.fabric', stage: { kind: 'full' } },
  { key: 'color', labelKey: 'studio.step.color', stage: { kind: 'full' } },
  { key: 'pattern', labelKey: 'studio.step.pattern', stage: { kind: 'detail', target: 'shaq' } },
  { key: 'threads', labelKey: 'studio.step.threads', stage: { kind: 'detail', target: 'shaq' } },
  { key: 'furakha', labelKey: 'studio.step.furakha', stage: { kind: 'detail', target: 'furakha' } },
  { key: 'details', labelKey: 'studio.step.details', stage: { kind: 'detail', target: 'neckline' } },
  { key: 'review', labelKey: 'studio.step.review', stage: { kind: 'rotate' } },
];

export default function DesignStudio() {
  const router = useRouter();
  const { t, L, lang } = useI18n();
  const { width, height } = useWindowDimensions();

  const config = useDesignStore((s) => s.config);
  const historyLength = useDesignStore((s) => s.history.length);
  const editingDesignId = useDesignStore((s) => s.editingDesignId);
  const store = useDesignStore;

  const fabrics = useCatalogStore((s) => s.fabrics);
  const patterns = useCatalogStore((s) => s.patterns);
  const colors = useCatalogStore((s) => s.colors);
  const threads = useCatalogStore((s) => s.threads);

  const customer = useProfileStore((s) => s.customer);
  const measurements = useProfileStore((s) => s.measurements);
  const selectedMeasurementId = useProfileStore((s) => s.selectedMeasurementId);
  const addToCart = useCartStore((s) => s.add);

  const [step, setStep] = useState<Step>('fabric');
  const [showMore, setShowMore] = useState(false);
  const [designName, setDesignName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const index = STEPS.findIndex((s) => s.key === step);
  const entry = STEPS[Math.max(0, index)];

  const measurement = useMemo(
    () => activeMeasurements(measurements).find((m) => m.id === selectedMeasurementId) ?? null,
    [measurements, selectedMeasurementId],
  );
  const fabric = useMemo(() => fabrics.find((f) => f.id === config.fabricId), [fabrics, config.fabricId]);
  const pattern = useMemo(
    () => patterns.find((p) => p.id === config.embroideryPatternId),
    [patterns, config.embroideryPatternId],
  );
  const price = usePricing(config, { quantity: 1, tailorId: customer.favoriteTailorId });
  const issues = useMemo(() => validateConfig(config), [config]);

  // The garment gets the majority of the screen; controls take what is left.
  const stageHeight = Math.round(Math.min(height * 0.46, 400));

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2400);
  };

  const goTo = (next: Step) => {
    setStep(next);
    setShowMore(false);
  };

  const advance = () => {
    if (index < STEPS.length - 1) goTo(STEPS[index + 1].key);
  };

  const handleSave = () => {
    const design = store.getState().saveDesign(designName, price, {
      measurementProfileId: selectedMeasurementId,
      tailorBusinessId: customer.favoriteTailorId,
    });
    track('design_saved', { designId: design.id, hash: design.configHash });
    setDesignName('');
    flash(t('studio.designSaved'));
  };

  const handleAddToCart = () => {
    addToCart(config, {
      quantity: 1,
      measurementProfileId: selectedMeasurementId,
      tailorBusinessId: customer.favoriteTailorId,
      designId: editingDesignId,
    });
    router.push('/cart');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }} edges={['top']}>
      <StudioStage
        config={config}
        measurement={measurement}
        mode={entry.stage}
        width={width}
        height={stageHeight}
      />

      <StepRail
        steps={STEPS.map((s) => ({ key: s.key, label: t(s.labelKey) }))}
        activeKey={step}
        onSelect={(k) => goTo(k as Step)}
      />

      <ScrollView
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {notice ? <Notice text={notice} tone="success" /> : null}
        {issues.map((issue, i) => (
          <Notice
            key={i}
            tone="warning"
            text={
              issue.kind === 'fabric_unavailable'
                ? t('error.fabricUnavailable')
                : issue.kind === 'color_unavailable_in_fabric'
                  ? L({ ar: 'هذا اللون غير متوفر في القماش المختار.', en: 'This colour is not available in the selected fabric.' })
                  : t('error.notFound')
            }
          />
        ))}

        {step === 'fabric' ? (
          <FabricPanel
            fabrics={fabrics}
            config={config}
            onSelect={(id) => {
              store.getState().setFabric(id);
              track('fabric_selected', { fabricId: id });
            }}
          />
        ) : null}

        {step === 'color' ? (
          <ColorPanel
            colors={colors}
            fabric={fabric}
            config={config}
            onSelect={(id) => {
              store.getState().setBaseColor(id);
              track('color_selected', { colorId: id });
            }}
          />
        ) : null}

        {step === 'pattern' ? (
          <PatternPanel
            patterns={patterns}
            config={config}
            onSelect={(id) => {
              store.getState().setPattern(id);
              track('embroidery_selected', { patternId: id ?? 'none' });
            }}
          />
        ) : null}

        {step === 'threads' ? (
          <ThreadPanel
            threads={threads}
            pattern={pattern}
            config={config}
            onSelect={(i, id) => {
              store.getState().setThreadColor(i, id);
              track('thread_color_changed', { channel: i + 1, threadId: id });
            }}
          />
        ) : null}

        {step === 'furakha' ? (
          <FurakhaPanel
            threads={threads}
            config={config}
            onColor={(id) => store.getState().setFurakhaColor(id)}
            onLength={(id) => store.getState().setComponentOption('furakha_length', id)}
          />
        ) : null}

        {step === 'details' ? (
          <DetailsPanel
            config={config}
            onSelect={(componentId, optionId) =>
              store.getState().setComponentOption(componentId, optionId)
            }
          />
        ) : null}

        {step === 'review' ? (
          <View style={{ gap: theme.space.lg }}>
            <Card>
              <View style={{ gap: theme.space.md }}>
                <T variant="heading">{t('studio.step.review')}</T>
                <T variant="small" color={theme.color.textMuted}>
                  {configSummary(config, L)}
                </T>
                <Row justify="space-between">
                  <T variant="heading">{t('checkout.total')}</T>
                  <T variant="heading" color={theme.color.accent}>
                    {formatMoney(price.total, lang)}
                  </T>
                </Row>
              </View>
            </Card>

            <Card>
              <View style={{ gap: theme.space.md }}>
                <T variant="small" weight="700">
                  {t('studio.saveDesign')}
                </T>
                <TextInput
                  value={designName}
                  onChangeText={setDesignName}
                  placeholder={L({ ar: 'اسم التصميم', en: 'Design name' })}
                  placeholderTextColor={theme.color.textFaint}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.color.border,
                    borderRadius: theme.radius.sm,
                    padding: theme.space.md,
                    minHeight: 46,
                    color: theme.color.text,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                />
                <Button label={t('studio.saveDesign')} onPress={handleSave} variant="secondary" full />
              </View>
            </Card>

            <Button
              label={t('studio.realistic')}
              variant="secondary"
              onPress={() => router.push('/preview')}
              full
            />
          </View>
        ) : null}

        {/* Advanced actions stay out of the way until asked for. */}
        <View style={{ gap: theme.space.sm }}>
          <Button
            label={showMore ? t('studio.less') : t('studio.more')}
            variant="ghost"
            size="sm"
            onPress={() => setShowMore(!showMore)}
          />
          {showMore ? (
            <Card>
              <View style={{ gap: theme.space.sm }}>
                <Row gap={theme.space.sm}>
                  <Button
                    label={t('common.undo')}
                    variant="secondary"
                    size="sm"
                    disabled={historyLength === 0}
                    onPress={() => store.getState().undo()}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t('common.reset')}
                    variant="secondary"
                    size="sm"
                    onPress={() => store.getState().reset()}
                    style={{ flex: 1 }}
                  />
                </Row>
                <Row gap={theme.space.sm}>
                  <Button
                    label={t('common.compare')}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      store.getState().addToCompare();
                      router.push('/compare');
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t('studio.matchKumma')}
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push('/kumma')}
                    style={{ flex: 1 }}
                  />
                </Row>
                <Button
                  label={t('home.stylistCta')}
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/stylist')}
                  full
                />
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {/* One price, one primary action. */}
      <StickyBar>
        <Row justify="space-between">
          <View style={{ gap: 1 }}>
            <T variant="tiny" color={theme.color.textMuted}>
              {t('studio.priceLive')}
            </T>
            <T variant="heading" color={theme.color.accent}>
              {formatMoney(price.total, lang)}
            </T>
          </View>
          <T variant="tiny" color={theme.color.textFaint}>
            {t('studio.stepOf', { current: index + 1, total: STEPS.length })}
          </T>
        </Row>
        {step === 'review' ? (
          <Button label={t('studio.addToCart')} onPress={handleAddToCart} full size="lg" />
        ) : (
          <Button label={t('common.next')} onPress={advance} full size="lg" />
        )}
      </StickyBar>
    </SafeAreaView>
  );
}
