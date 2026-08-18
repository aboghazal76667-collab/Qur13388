import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { CONFIDENCE_LABELS } from '../analysis/argument';
import type { ConfidenceLevel } from '../types/analysis';

const FILL: Record<ConfidenceLevel, number> = {
  high: 1,
  medium: 0.62,
  low: 0.3,
  undetermined: 0.1,
};

/** Confidence is never shown without its reason — that is the whole contract. */
export function ConfidenceMeter({ level, reason }: { level: ConfidenceLevel; reason: string }) {
  const { palette, radii, spacing } = useTheme();

  const color =
    level === 'high'
      ? palette.strong
      : level === 'medium'
        ? palette.neutral
        : level === 'low'
          ? palette.caution
          : palette.textFaint;

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radii.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.border,
        backgroundColor: palette.surface,
      }}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="small" weight="bold">
          درجة الثقة
        </AppText>
        <AppText variant="small" weight="bold" style={{ color }}>
          {CONFIDENCE_LABELS[level]}
        </AppText>
      </View>

      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: palette.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${FILL[level] * 100}%`,
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      </View>

      <AppText variant="tiny" tone="faint">
        السبب
      </AppText>
      <AppText variant="small" tone="muted">
        {reason}
      </AppText>
    </View>
  );
}
