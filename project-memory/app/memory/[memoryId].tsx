import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Dimensions, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { getBackend, type MemoryWithAssets } from '@/data';
import { presentationFor } from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import {
  assessCollection,
  pixelAnalyzerCapabilities,
  readinessWarningThreshold,
  type PhotoSignals,
  type ViewRole,
} from '@/services/readiness';
import { isAwaitingResult, isFailed } from '@/services/threeD/pipeline';
import { AssetImage } from '@/components/AssetImage';
import { FigurinePreview } from '@/components/FigurinePreview';
import { issueLabel } from '@/features/readiness/ReadinessPanel';
import { useArchive } from '@/state/archive';
import { Banner, Button, Card, Chip, Row, RowGroup, Screen, ScreenHeader, Text } from '@/ui';

/**
 * A single memory: the photos, what the parent wrote, and the figurine — or
 * the invitation to make one.
 */
export default function MemoryDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t, language, formatDate, isRtl } = useI18n();
  const { memoryId } = useLocalSearchParams<{ memoryId: string }>();
  const removeMemory = useArchive((state) => state.removeMemory);

  const [data, setData] = useState<MemoryWithAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  /** Set when we have warned about a weak photo and are awaiting a decision. */
  const [qualityGate, setQualityGate] = useState(false);

  const load = useCallback(() => {
    if (!memoryId) return;
    getBackend()
      .memories.get(memoryId)
      .then(setData)
      .catch((loadError) => setError(friendlyMessage(loadError, t.errors)));
  }, [memoryId, t.errors]);

  useFocusEffect(useCallback(() => load(), [load]));

  /**
   * Readiness for the whole set, rebuilt from the measurements taken when each
   * photo was added. Re-decoding here would cost seconds on a large memory for
   * numbers that cannot have changed.
   */
  const readiness = useMemo(() => {
    const analysed = (data?.assets ?? [])
      .filter((asset) => asset.kind === 'photo')
      .map((photo) => {
        const signals = photo.meta?.readiness as PhotoSignals | null | undefined;
        if (!signals) return null;
        const role = (photo.meta?.view as ViewRole | undefined) ?? 'unspecified';
        return { photoId: photo.id, role, signals };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (analysed.length === 0) return null;
    return assessCollection(analysed, pixelAnalyzerCapabilities, 'on-device-pixels', '1.0.0');
  }, [data]);


  if (!memoryId) return null;

  if (!data) {
    return (
      <Screen>
        <ScreenHeader />
        {error ? <Banner tone="danger" body={error} /> : <Text color="textMuted">{t.common.loading}</Text>}
      </Screen>
    );
  }

  const { memory, assets, job, model } = data;
  const photos = assets.filter((asset) => asset.kind === 'photo');
  const presentation = presentationFor(memory.kind);
  const photoWidth = Math.min(Dimensions.get('window').width - 96, 280);

  const startGeneration = async (force = false) => {
    if (photos.length === 0) {
      setError(t.threeD.needPhoto);
      return;
    }

    // Interrupt before spending a generation on a photo unlikely to produce
    // something the parent will like. It is a suggestion, not a block — they
    // can always continue.
    if (!force && readiness !== null && readiness.score < readinessWarningThreshold) {
      setQualityGate(true);
      return;
    }

    setQualityGate(false);
    setStarting(true);
    setError(null);
    try {
      const created = await getBackend().threeD.start({
        memoryId: memory.id,
        sourceAssetIds: photos.map((photo) => photo.id),
      });
      router.push(`/three-d/${created.id}`);
    } catch (startError) {
      setError(friendlyMessage(startError, t.errors));
    } finally {
      setStarting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t.common.delete, memory.title, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMemory(memory.id, memory.childId);
            router.back();
          } catch (deleteError) {
            setError(friendlyMessage(deleteError, t.errors));
          }
        },
      },
    ]);
  };

  const jobRunning = job ? isAwaitingResult(job) : false;
  const jobFailed = job ? isFailed(job.status) : false;

  return (
    <Screen>
      <ScreenHeader />

      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.lg }}>
        {error ? <Banner tone="danger" body={error} /> : null}

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <Chip
              label={language === 'ar' ? presentation.labelAr : presentation.labelEn}
              tone="primary"
              icon={<Ionicons name={presentation.icon} size={13} color={theme.colors.primary} />}
            />
          </View>
          <Text variant="title" accessibilityRole="header">
            {memory.title}
          </Text>
          <Text variant="body" color="textMuted">
            {formatDate(memory.occurredOn, 'long')}
          </Text>
        </View>

        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: isRtl ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
            }}
          >
            {photos.map((photo) => (
              <AssetImage
                key={photo.id}
                asset={photo}
                accessibilityLabel={memory.title}
                style={{
                  width: photoWidth,
                  height: photoWidth * 1.25,
                  borderRadius: theme.radius.xl,
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        {memory.note ? (
          <Card>
            <Text variant="body">{memory.note}</Text>
          </Card>
        ) : null}

        {memory.futureMessage ? (
          <Card style={{ backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent }}>
            <View style={{ gap: theme.spacing.sm }}>
              <View
                style={{
                  flexDirection: isRtl ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <Ionicons name="mail-outline" size={16} color={theme.colors.accent} />
                <Text variant="label" color="accent">
                  {t.memory.futureMessageLabel}
                </Text>
              </View>
              <Text variant="body">{memory.futureMessage}</Text>
              <Text variant="micro" color="textFaint">
                {t.memory.futureMessageHint}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* ------------------------------------------------- the figurine */}

        {model ? (
          <Card>
            <View style={{ gap: theme.spacing.lg, alignItems: 'center' }}>
              <View style={{ alignSelf: 'stretch' }}>
                <Text variant="subheading">{t.threeD.preview}</Text>
              </View>
              <FigurinePreview seed={String(model.meta.seed ?? model.id)} size={220} />
              {model.meta.previewKind === 'procedural' ? (
                <Banner tone="info" title={t.threeD.demoBadge} body={t.threeD.demoExplainer} />
              ) : null}
              <Button
                label={t.threeD.preview}
                variant="secondary"
                size="medium"
                onPress={() => router.push(`/three-d/${model.jobId}`)}
              />
            </View>
          </Card>
        ) : jobRunning && job ? (
          <Card onPress={() => router.push(`/three-d/${job.id}`)}>
            <View
              style={{
                flexDirection: isRtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <Ionicons name="hourglass-outline" size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t.threeD.inProgressTitle}</Text>
                <Text variant="caption" color="textMuted">
                  {t.threeD.stages[Math.min(job.stageIndex, t.threeD.stages.length - 1)]}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Text variant="subheading">{t.threeD.entryTitle}</Text>
              <Text variant="caption" color="textMuted">
                {t.threeD.entryBody}
              </Text>
              {jobFailed ? <Banner tone="warning" body={t.threeD.failedBody} /> : null}

              {qualityGate ? (
                <Banner
                  tone="warning"
                  title={t.threeD.qualityGateTitle}
                  body={
                    readiness?.photos[0]?.issues[0]
                      ? issueLabel(readiness.photos[0].issues[0], t)
                      : t.threeD.qualityGateBody
                  }
                  action={
                    <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
                      <Button
                        label={t.threeD.continueAnyway}
                        size="small"
                        onPress={() => startGeneration(true)}
                        loading={starting}
                      />
                      <Button
                        label={t.threeD.chooseBetterPhoto}
                        size="small"
                        variant="secondary"
                        onPress={() => setQualityGate(false)}
                      />
                    </View>
                  }
                />
              ) : (
                <Button
                  label={jobFailed ? t.threeD.tryAgain : t.threeD.create}
                  onPress={() => startGeneration()}
                  loading={starting}
                  disabled={photos.length === 0}
                  icon={<Ionicons name="cube-outline" size={18} color={theme.colors.onPrimary} />}
                  emphasise
                />
              )}
              {photos.length === 0 ? (
                <Text variant="caption" color="textFaint">
                  {t.threeD.needPhoto}
                </Text>
              ) : null}
            </View>
          </Card>
        )}

        <RowGroup>
          <Row label={t.common.delete} icon="trash-outline" destructive onPress={confirmDelete} />
        </RowGroup>
      </View>
    </Screen>
  );
}
