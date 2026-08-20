import React from 'react';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface ScoreBarProps {
  label: string;
  /** 0–100. */
  score: number;
  caption?: string;
}

export function scoreTone(score: number): 'success' | 'accent' | 'warning' | 'danger' {
  if (score >= 85) return 'success';
  if (score >= 70) return 'accent';
  if (score >= 50) return 'warning';
  return 'danger';
}

export function ScoreBar({ label, score, caption }: ScoreBarProps) {
  const theme = useTheme();
  const { isRtl, formatNumber } = useI18n();
  const tone = scoreTone(score);
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${clamped} / 100`}
      style={{ gap: theme.spacing.sm }}
    >
      <View
        style={{
          flexDirection: isRtl ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
        <Text variant="label" color={tone}>
          {caption ?? formatNumber(clamped)}
        </Text>
      </View>

      <View
        style={{
          height: 8,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.backgroundAlt,
          overflow: 'hidden',
          flexDirection: isRtl ? 'row-reverse' : 'row',
        }}
      >
        <View
          style={{
            width: `${clamped}%`,
            backgroundColor: theme.colors[tone],
            borderRadius: theme.radius.pill,
          }}
        />
      </View>
    </View>
  );
}
