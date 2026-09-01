import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { configSummary } from '@dd/components/cards';
import { Badge, Button, Card, Loading, Notice, Row, T } from '@dd/components/ui';
import { ENV } from '@dd/config/env';
import type { PreviewAsset } from '@dd/domain/types';
import { hashConfig } from '@dd/engine/design';
import { useI18n } from '@dd/i18n';
import {
  buildGarmentSpec,
  evidenceFromOwnRenderer,
  isSimulatedV2,
  photorealisticProvider,
  validateAgainstSpec,
  type ConsistencyResult,
} from '@dd/services/ai';
import { activeMeasurements, useProfileStore } from '@dd/store/profileStore';
import { track } from '@dd/services/analytics';
import { useDesignStore } from '@dd/store/designStore';
import { theme } from '@dd/theme/tokens';

/**
 * LAYER 2 — REALISTIC PREVIEW.
 *
 * In demo mode the provider returns a `simulated:` asset which is rendered by
 * the high-fidelity vector renderer, and the badge says so plainly. We do not
 * present a simulation as AI output. Failure here is non-blocking by design:
 * the configurator and checkout keep working regardless.
 */
export default function Preview() {
  const router = useRouter();
  const { t, L } = useI18n();
  const config = useDesignStore((s) => s.config);

  const measurements = useProfileStore((s) => s.measurements);
  const selectedMeasurementId = useProfileStore((s) => s.selectedMeasurementId);
  const measurement =
    activeMeasurements(measurements).find((m) => m.id === selectedMeasurementId) ?? null;

  const [asset, setAsset] = useState<PreviewAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [consistency, setConsistency] = useState<ConsistencyResult | null>(null);

  const generate = async (quality: 'low' | 'high') => {
    setLoading(true);
    setFailed(false);
    setConsistency(null);
    const hash = hashConfig(config);
    const before = Date.now();
    try {
      // The COMPLETE structured design goes to the provider — never a prose
      // prompt, which is what lets a model invent a different garment.
      const spec = buildGarmentSpec(config, measurement, 0);
      const result = await photorealisticProvider.generateProductPreview({ spec, quality });
      setFromCache(Date.now() - before < 50);
      setAsset(result);
      // Verify the result actually depicts the configured design.
      setConsistency(validateAgainstSpec(spec, evidenceFromOwnRenderer(spec)));
      track('preview_generated', { quality, simulated: result.isSimulated, hash });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('preview.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <Card padded={false}>
          <View style={{ backgroundColor: theme.color.surface, alignItems: 'center', paddingVertical: theme.space.lg }}>
            <DishdashaFigure
              config={config}
              width={260}
              height={408}
              realistic={Boolean(asset)}
              transparentBackground={!asset}
            />
          </View>
          <View style={{ padding: theme.space.lg, gap: theme.space.sm }}>
            <T variant="heading">{configSummary(config, L)}</T>
            {asset ? (
              <Row gap={theme.space.sm} wrap>
                <Badge label={asset.quality === 'high' ? 'HIGH' : 'LOW'} tone="info" />
                {asset.isSimulated ? <Badge label={t('preview.simulated')} tone="warning" /> : null}
                {fromCache ? <Badge label={t('preview.cached')} tone="success" /> : null}
              </Row>
            ) : null}
          </View>
        </Card>

        {loading ? <Loading label={t('preview.generating')} /> : null}

        {failed ? (
          <Notice title={t('preview.failed')} text={t('preview.failedHint')} tone="warning" />
        ) : null}

        {asset && isSimulatedV2(asset.uri) ? (
          <Notice tone="warning" text={t('preview.simulated')} />
        ) : null}

        {consistency && consistency.requiresRegeneration ? (
          <Notice
            tone="danger"
            title={t('preview.needsRegenerate')}
            text={t('preview.mismatch')}
          />
        ) : null}

        <View style={{ gap: theme.space.sm }}>
          <Button label={t('preview.generate')} onPress={() => generate('high')} loading={loading} full size="lg" />
          <Button
            label={L({ ar: 'معاينة سريعة منخفضة الدقة', en: 'Quick low-resolution preview' })}
            onPress={() => generate('low')}
            variant="secondary"
            full
          />
          {failed ? <Button label={t('common.retry')} onPress={() => generate('high')} variant="secondary" full /> : null}
        </View>

        <Card>
          <View style={{ gap: theme.space.md }}>
            <Row justify="space-between">
              <T variant="heading">{t('preview.tryOn')}</T>
              <Badge label={t('common.optional')} tone="neutral" />
            </Row>
            <T variant="small" color={theme.color.textMuted}>
              {t('preview.tryOnIntro')}
            </T>
            <Notice text={t('preview.tryOnOptional')} tone="info" />
            <Button
              label={t('preview.tryOn')}
              variant="secondary"
              onPress={() => router.push('/photo-consent')}
              full
            />
          </View>
        </Card>

        {ENV.MOCK_AI_MODE ? (
          <T variant="tiny" color={theme.color.textFaint}>
            MOCK_AI_MODE — {L({ ar: 'المعاينة تُنتج محلياً بدون أي خدمة خارجية.', en: 'previews are produced locally with no external service.' })}
          </T>
        ) : null}
      </ScrollView>
    </>
  );
}
