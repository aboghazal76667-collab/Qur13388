import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getBackend } from '@/data';
import type { ThreeDJob, ThreeDModel } from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { log } from '@/lib/log';
import { useTheme } from '@/theme';
import { analytics } from '@/services/analytics';
import { isAwaitingResult, isFailed } from '@/services/threeD/pipeline';
import { ModelViewer } from '@/components/ModelViewer';
import { useModelData } from '@/features/threeD/useModelData';
import { GenerationStages } from '@/features/threeD/GenerationStages';
import { Banner, Button, Row, RowGroup, Screen, ScreenHeader, Text } from '@/ui';

/** How often we ask for progress while a job is running. */
const POLL_INTERVAL_MS = 1200;

/**
 * The generation screen.
 *
 * It polls while the job is running and stops the moment it is not — a phone
 * on a mobile connection should not keep a timer alive for a finished job.
 * Failure here is deliberately gentle: the photos and the memory are already
 * saved, and the copy says so, because the worst thing this screen could do is
 * make a parent think they lost something.
 */
export default function ThreeDJobScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, formatNumber } = useI18n();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

  const [job, setJob] = useState<ThreeDJob | null>(null);
  const [model, setModel] = useState<ThreeDModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelData = useModelData(model);

  const stop = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const poll = useCallback(
    async (id: string) => {
      try {
        const refreshed = await getBackend().threeD.refresh(id);
        setJob(refreshed);

        if (isAwaitingResult(refreshed)) {
          timer.current = setTimeout(() => poll(id), POLL_INTERVAL_MS);
          return;
        }

        stop();
        if (!isFailed(refreshed.status)) {
          const found = await getBackend().threeD.getModel(id);
          setModel(found);
        }
      } catch (pollError) {
        log.warn('poll failed', { jobId: id, error: String(pollError) });
        stop();
        setError(friendlyMessage(pollError, t.errors));
      }
    },
    [stop, t.errors],
  );

  useEffect(() => {
    if (!jobId) return undefined;
    poll(jobId);
    return stop;
  }, [jobId, poll, stop]);

  const retry = async () => {
    if (!job) return;
    setRetrying(true);
    setError(null);
    try {
      const next = await getBackend().threeD.retry(job.id);
      setModel(null);
      setJob(next);
      router.replace(`/three-d/${next.id}`);
    } catch (retryError) {
      setError(friendlyMessage(retryError, t.errors));
    } finally {
      setRetrying(false);
    }
  };

  const keep = () => {
    analytics.track('three_d_saved_to_timeline');
    if (job) router.replace(`/memory/${job.memoryId}`);
    else router.back();
  };

  if (!jobId) return null;

  if (!job) {
    return (
      <Screen>
        <ScreenHeader />
        {error ? <Banner tone="danger" body={error} /> : <Text color="textMuted">{t.common.loading}</Text>}
      </Screen>
    );
  }

  /* ------------------------------------------------------------ failure */

  if (isFailed(job.status)) {
    return (
      <Screen
        footer={
          <View style={{ gap: theme.spacing.md }}>
            <Button label={t.threeD.tryAgain} onPress={retry} loading={retrying} emphasise />
            <Button
              label={t.common.back}
              variant="ghost"
              size="medium"
              onPress={() => router.replace(`/memory/${job.memoryId}`)}
            />
          </View>
        }
      >
        <ScreenHeader />
        <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xxl, alignItems: 'center' }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.warningSoft,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={30} color={theme.colors.warning} />
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="heading" align="center" autoAlign={false}>
              {t.threeD.failedTitle}
            </Text>
            <Text variant="body" color="textMuted" align="center" autoAlign={false}>
              {t.threeD.failedBody}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- in flight */

  if (isAwaitingResult(job) || !model) {
    return (
      <Screen>
        <ScreenHeader title={t.threeD.inProgressTitle} />
        <View style={{ gap: theme.spacing.xxl, paddingTop: theme.spacing.xxl }}>
          {error ? <Banner tone="warning" body={error} /> : null}
          <GenerationStages stageIndex={job.stageIndex} progress={job.progress} />
          <Text variant="caption" color="textFaint" align="center" autoAlign={false}>
            {t.threeD.demoExplainer}
          </Text>
        </View>
      </Screen>
    );
  }

  /* ------------------------------------------------------------- result */

  return (
    <Screen
      footer={
        <View style={{ gap: theme.spacing.md }}>
          <Button label={t.threeD.saveToTimeline} onPress={keep} emphasise />
          <Button label={t.threeD.tryAgain} variant="ghost" size="medium" onPress={retry} loading={retrying} />
        </View>
      }
    >
      <ScreenHeader title={t.threeD.doneTitle} subtitle={t.threeD.doneBody} />

      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
        {/* The actual model this request produced, rendered with a real
            renderer. When no provider file exists it is the bundled stand-in —
            same viewer, and labelled so nobody mistakes it for their child. */}
        <ModelViewer data={modelData.data} loading={modelData.loading} />

        {modelData.source === 'demo' ? (
          <Banner tone="info" title={t.threeD.demoModelBadge} body={t.threeD.demoModelExplainer} />
        ) : null}

        {/* A polygon count means nothing to a parent. These say what they
            would actually want to know, and the print line says plainly that
            nothing has been checked rather than implying it passed. */}
        <RowGroup title={t.threeD.preview}>
          <Row
            label={t.threeD.sourcePhotos}
            value={formatNumber(job.sourceAssetIds.length)}
            icon="images-outline"
          />
          <Row
            label={t.threeD.modelQuality}
            value={
              (model.polycount ?? 0) >= 50_000
                ? t.threeD.modelQualityHigh
                : t.threeD.modelQualityStandard
            }
            icon="diamond-outline"
          />
          <Row
            label={t.threeD.figurineSize}
            value={t.threeD.sizeNotChosen}
            icon="resize-outline"
          />
          <Row
            label={t.threeD.printCheck}
            value={model.isPrintReady ? t.common.done : t.threeD.printCheckNotDone}
            icon="cube-outline"
          />
        </RowGroup>

        {!model.isPrintReady ? (
          <Banner tone="info" body={t.threeD.printCheckExplain} />
        ) : null}
      </View>
    </Screen>
  );
}
