import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ZoomTarget } from '@dd/components/dishdasha/geometry';
import { Badge, Button, Card, Notice, Row, StickyBar, T } from '@dd/components/ui';
import { configSummary } from '@dd/components/cards';
import {
  ColorPanel,
  DetailsPanel,
  FabricPanel,
  FurakhaPanel,
  PatternPanel,
  ThreadPanel,
} from '@dd/features/studio/panels';
import { StudioPreview } from '@dd/features/studio/StudioPreview';
import { serializeDesign, validateConfig } from '@dd/engine/design';
import { formatMoney } from '@dd/engine/money';
import { useI18n, type StringKey } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useCartStore } from '@dd/store/cartStore';
import { useCatalogStore } from '@dd/store/catalogStore';
import { useDesignStore } from '@dd/store/designStore';
import { useProfileStore } from '@dd/store/profileStore';
import { usePricing } from '@dd/hooks/usePricing';
import { theme } from '@dd/theme/tokens';

type Step = 'fabric' | 'color' | 'pattern' | 'threads' | 'furakha' | 'details' | 'review';

const STEPS: { key: Step; labelKey: StringKey }[] = [
  { key: 'fabric', labelKey: 'studio.step.fabric' },
  { key: 'color', labelKey: 'studio.step.color' },
  { key: 'pattern', labelKey: 'studio.step.pattern' },
  { key: 'threads', labelKey: 'studio.step.threads' },
  { key: 'furakha', labelKey: 'studio.step.furakha' },
  { key: 'details', labelKey: 'studio.step.details' },
  { key: 'review', labelKey: 'studio.step.review' },
];

/**
 * THE DESIGN STUDIO.
 *
 * Steps are a suggested order, not a wizard: every step is reachable at any
 * time and nothing is lost by going back, because the whole configuration
 * lives in one persisted store rather than in step-local state.
 */
export default function DesignStudio() {
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const config = useDesignStore((s) => s.config);
  const historyLength = useDesignStore((s) => s.history.length);
  const editingDesignId = useDesignStore((s) => s.editingDesignId);
  const store = useDesignStore;

  const fabrics = useCatalogStore((s) => s.fabrics);
  const patterns = useCatalogStore((s) => s.patterns);
  const colors = useCatalogStore((s) => s.colors);
  const threads = useCatalogStore((s) => s.threads);

  const customer = useProfileStore((s) => s.customer);
  const selectedMeasurementId = useProfileStore((s) => s.selectedMeasurementId);
  const addToCart = useCartStore((s) => s.add);

  const [step, setStep] = useState<Step>('fabric');
  const [zoom, setZoom] = useState<ZoomTarget>('full');
  const [designName, setDesignName] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const fabric = useMemo(() => fabrics.find((f) => f.id === config.fabricId), [fabrics, config.fabricId]);
  const pattern = useMemo(
    () => patterns.find((p) => p.id === config.embroideryPatternId),
    [patterns, config.embroideryPatternId],
  );
  const price = usePricing(config, { quantity: 1, tailorId: customer.favoriteTailorId });
  const issues = useMemo(() => validateConfig(config), [config]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const goStep = (next: Step) => {
    setStep(next);
    // Jump the preview to whatever the customer is about to change.
    if (next === 'pattern' || next === 'threads') setZoom('chest');
    else if (next === 'furakha') setZoom('furakha');
    else if (next === 'details') setZoom('neck');
    else setZoom('full');
  };

  const handleSave = () => {
    const design = store.getState().saveDesign(designName, price, {
      measurementProfileId: selectedMeasurementId,
      tailorBusinessId: customer.favoriteTailorId,
    });
    track('design_saved', { designId: design.id, hash: design.configHash });
    setSavedNotice(t('studio.designSaved'));
    setDesignName('');
    setTimeout(() => setSavedNotice(null), 2500);
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

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${configSummary(config, L)}\n${serializeDesign(config)}`,
      });
    } catch {
      /* The user dismissed the sheet — nothing to report. */
    }
  };

  const handleCompare = () => {
    const added = store.getState().addToCompare();
    if (!added) Alert.alert(t('compare.title'), t('compare.full'));
    track('design_compared', {});
    router.push('/compare');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }} edges={['top']}>
      <StudioPreview config={config} zoom={zoom} onZoomChange={setZoom} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: theme.color.surface, borderBottomWidth: 1, borderBottomColor: theme.color.border }}
        contentContainerStyle={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm, gap: theme.space.sm }}
      >
        <Row gap={theme.space.sm}>
          {STEPS.map((s, index) => {
            const selected = s.key === step;
            return (
              <Pressable
                key={s.key}
                onPress={() => goStep(s.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={{
                  paddingHorizontal: theme.space.md,
                  paddingVertical: 8,
                  minHeight: 36,
                  borderRadius: theme.radius.pill,
                  backgroundColor: selected ? theme.color.accent : 'transparent',
                }}
              >
                <T variant="tiny" weight="700" color={selected ? theme.color.accentText : theme.color.textMuted}>
                  {index + 1}. {t(s.labelKey)}
                </T>
              </Pressable>
            );
          })}
        </Row>
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxl }}>
        {savedNotice ? <Notice text={savedNotice} tone="success" /> : null}
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
          <FabricPanel fabrics={fabrics} config={config} onSelect={(id) => { store.getState().setFabric(id); track('fabric_selected', { fabricId: id }); }} />
        ) : null}

        {step === 'color' ? (
          <ColorPanel
            colors={colors}
            fabric={fabric}
            config={config}
            onSelect={(id) => { store.getState().setBaseColor(id); track('color_selected', { colorId: id }); }}
          />
        ) : null}

        {step === 'pattern' ? (
          <PatternPanel
            patterns={patterns}
            config={config}
            onSelect={(id) => { store.getState().setPattern(id); track('embroidery_selected', { patternId: id ?? 'none' }); }}
          />
        ) : null}

        {step === 'threads' ? (
          <ThreadPanel
            threads={threads}
            pattern={pattern}
            config={config}
            onSelect={(index, id) => {
              store.getState().setThreadColor(index, id);
              track('thread_color_changed', { channel: index + 1, threadId: id });
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
          <DetailsPanel config={config} onSelect={(componentId, optionId) => store.getState().setComponentOption(componentId, optionId)} />
        ) : null}

        {step === 'review' ? (
          <View style={{ gap: theme.space.lg }}>
            <Card>
              <View style={{ gap: theme.space.md }}>
                <T variant="heading">{t('studio.step.review')}</T>
                <T variant="small" color={theme.color.textMuted}>
                  {configSummary(config, L)}
                </T>
                {price.lines.map((line) => (
                  <Row key={line.key} justify="space-between">
                    <T variant="small" color={theme.color.textMuted}>
                      {t(`checkout.${line.key === 'discount' ? 'discountLine' : line.key === 'delivery' ? 'deliveryFee' : line.key === 'fabric' ? 'fabricCost' : line.key === 'tailoring' ? 'tailoringCost' : line.key === 'embroidery' ? 'embroideryCost' : line.key === 'extras' ? 'extras' : 'tax'}` as StringKey)}
                    </T>
                    <T variant="small">{formatMoney(line.amount, lang)}</T>
                  </Row>
                ))}
                <Row justify="space-between">
                  <T variant="heading">{t('checkout.total')}</T>
                  <T variant="heading" color={theme.color.accent}>
                    {formatMoney(price.total, lang)}
                  </T>
                </Row>
                {price.taxRate === null ? (
                  <T variant="tiny" color={theme.color.textFaint}>
                    {t('checkout.taxNotConfigured')}
                  </T>
                ) : null}
              </View>
            </Card>

            <Card>
              <View style={{ gap: theme.space.md }}>
                <T variant="heading">{t('studio.saveDesign')}</T>
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
                    minHeight: theme.hit,
                    color: theme.color.text,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                />
                <Button label={t('studio.saveDesign')} onPress={handleSave} variant="secondary" full />
              </View>
            </Card>

            <Row gap={theme.space.sm} wrap>
              <Button label={t('studio.realistic')} onPress={() => router.push('/preview')} variant="secondary" style={{ flex: 1 }} />
              <Button label={t('common.compare')} onPress={handleCompare} variant="secondary" style={{ flex: 1 }} />
            </Row>
            <Row gap={theme.space.sm} wrap>
              <Button label={t('common.share')} onPress={handleShare} variant="ghost" style={{ flex: 1 }} />
              <Button label={t('studio.matchKumma')} onPress={() => router.push('/kumma')} variant="ghost" style={{ flex: 1 }} />
            </Row>
          </View>
        ) : null}
      </ScrollView>

      <StickyBar>
        <Row justify="space-between">
          <View style={{ gap: 2 }}>
            <T variant="tiny" color={theme.color.textMuted}>
              {t('studio.priceLive')}
            </T>
            <T variant="heading" color={theme.color.accent}>
              {formatMoney(price.total, lang)}
            </T>
          </View>
          <Row gap={theme.space.sm}>
            <Button label={t('common.undo')} variant="ghost" size="sm" disabled={historyLength === 0} onPress={() => store.getState().undo()} />
            <Button label={t('common.reset')} variant="ghost" size="sm" onPress={() => store.getState().reset()} />
            <Button label={t('studio.step.ai')} variant="secondary" size="sm" onPress={() => router.push('/stylist')} />
          </Row>
        </Row>
        {/* Explicit step navigation: the chip strip scrolls horizontally, so on a
            narrow phone the later steps are otherwise off-screen. */}
        <Row gap={theme.space.sm}>
          <Button
            label={t('common.back')}
            variant="secondary"
            size="sm"
            disabled={stepIndex <= 0}
            onPress={() => goStep(STEPS[Math.max(0, stepIndex - 1)].key)}
            style={{ flex: 1 }}
          />
          <Button
            label={t('common.next')}
            variant="secondary"
            size="sm"
            disabled={stepIndex >= STEPS.length - 1}
            onPress={() => goStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].key)}
            style={{ flex: 1 }}
          />
        </Row>
        <Row gap={theme.space.sm}>
          <Button label={t('studio.addToCart')} onPress={handleAddToCart} full style={{ flex: 1 }} />
        </Row>
        {editingDesignId ? (
          <Row justify="space-between">
            <Badge label={t('saved.designs')} tone="accent" />
            <Pressable onPress={() => store.getState().startNew()} accessibilityRole="button">
              <T variant="tiny" color={theme.color.accent} weight="700">
                {t('common.reset')}
              </T>
            </Pressable>
          </Row>
        ) : null}
      </StickyBar>
    </SafeAreaView>
  );
}
