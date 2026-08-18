import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { STATEMENT_KIND_LABELS } from '../analysis/argument';
import type { ReasoningStep, StatementKind } from '../types/analysis';

const KIND_TONE: Record<StatementKind, 'accent' | 'good' | 'neutral' | 'caution' | 'external'> = {
  'quran-text': 'accent',
  'linguistic-observation': 'good',
  inference: 'neutral',
  'thinker-opinion': 'caution',
  'external-assumption': 'external',
};

/**
 * The visual inference path: verse ↓ observation ↓ assumption ↓ conclusion.
 *
 * Colour-coding by statement kind is the point of the component — a reader
 * should be able to see at a glance which link is a quotation and which is an
 * assumption someone inserted.
 */
export function ReasoningChain({ steps }: { steps: ReasoningStep[] }) {
  const { palette, spacing, radii } = useTheme();

  if (steps.length === 0) return null;

  return (
    <View style={{ gap: 0 }}>
      {steps.map((step, index) => {
        const tone = KIND_TONE[step.kind];
        const color =
          tone === 'accent'
            ? palette.accent
            : tone === 'good'
              ? palette.good
              : tone === 'caution'
                ? palette.caution
                : tone === 'external'
                  ? palette.external
                  : palette.neutral;

        return (
          <View key={`${step.kind}-${index}`}>
            <View
              style={{
                borderRightWidth: 3,
                borderRightColor: color,
                backgroundColor: palette.surfaceAlt,
                borderRadius: radii.sm,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <Badge label={STATEMENT_KIND_LABELS[step.kind]} tone={tone} />
                {step.isAssumption && step.kind !== 'external-assumption' ? (
                  <Badge label="افتراض" tone="external" />
                ) : null}
              </View>
              <AppText variant="small" tone={step.kind === 'quran-text' ? 'quran' : 'default'}>
                {step.content}
              </AppText>
            </View>

            {index < steps.length - 1 ? (
              <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                <View style={{ width: StyleSheet.hairlineWidth * 3, height: 14, backgroundColor: palette.borderStrong }} />
                <AppText variant="tiny" tone="faint">
                  ↓
                </AppText>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
