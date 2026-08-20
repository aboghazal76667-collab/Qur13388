import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { PhotoQualityReport, QualityDimensionKey } from '@/domain';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { displayedDimensions } from '@/services/photoQuality';
import { Card, ScoreBar, Text, scoreTone } from '@/ui';

/**
 * The photo quality panel.
 *
 * Two rules here. Everything is phrased for a parent — no model names, no
 * confidence intervals. And when the analyzer has not actually looked at
 * pixels, the panel says so, because a product that stores children's photos
 * cannot afford to overstate what it knows about them.
 */
export function PhotoQualityPanel({
  report,
  analysing,
  inspectsPixels,
}: {
  report: PhotoQualityReport | null;
  analysing: boolean;
  inspectsPixels: boolean;
}) {
  const theme = useTheme();
  const { t, isRtl, formatNumber } = useI18n();

  if (analysing) {
    return (
      <Card>
        <Text variant="caption" color="textMuted">
          {t.photoQuality.analysing}
        </Text>
      </Card>
    );
  }

  if (!report) return null;

  const labels: Record<QualityDimensionKey, string> = {
    face: t.photoQuality.face,
    body: t.photoQuality.body,
    lighting: t.photoQuality.lighting,
    sharpness: t.photoQuality.sharpness,
    background: t.photoQuality.background,
    framing: t.photoQuality.framing,
    people: t.photoQuality.people,
  };

  const verdictLabel = {
    excellent: t.photoQuality.verdictExcellent,
    good: t.photoQuality.verdictGood,
    fair: t.photoQuality.verdictFair,
    poor: t.photoQuality.verdictPoor,
  }[report.verdict];

  const tone = scoreTone(report.overallScore);

  return (
    <Card>
      <View style={{ gap: theme.spacing.lg }}>
        <View
          style={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="subheading">{t.photoQuality.title}</Text>
          <View
            style={{
              flexDirection: isRtl ? 'row-reverse' : 'row',
              alignItems: 'baseline',
              gap: theme.spacing.xs,
            }}
          >
            <Text variant="title" color={tone} autoAlign={false}>
              {formatNumber(report.overallScore)}
            </Text>
            <Text variant="caption" color="textFaint" autoAlign={false}>
              / 100
            </Text>
          </View>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {displayedDimensions.map((key) => {
            const dimension = report.dimensions.find((item) => item.key === key);
            if (!dimension) return null;
            const caption = {
              excellent: t.photoQuality.verdictExcellent,
              good: t.photoQuality.verdictGood,
              fair: t.photoQuality.verdictFair,
              poor: t.photoQuality.verdictPoor,
            }[dimension.verdict];

            return (
              <ScoreBar key={key} label={labels[key]} score={dimension.score} caption={caption} />
            );
          })}
        </View>

        <View
          style={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors[`${tone}Soft` as const],
          }}
        >
          <Ionicons
            name={report.overallScore >= 70 ? 'checkmark-circle-outline' : 'bulb-outline'}
            size={18}
            color={theme.colors[tone]}
          />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="bodyStrong" color={tone}>
              {verdictLabel}
            </Text>
            <Text variant="caption" color="textMuted">
              {report.summary}
            </Text>
            {report.advice ? (
              <Text variant="caption" color="textMuted">
                {report.advice}
              </Text>
            ) : null}
          </View>
        </View>

        <Text variant="micro" color="textFaint">
          {inspectsPixels ? t.photoQuality.checkedOnDevice : t.photoQuality.estimateNote}
        </Text>
      </View>
    </Card>
  );
}
