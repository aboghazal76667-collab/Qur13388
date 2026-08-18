import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { QURAN_ONLY_NOTICE } from '../analysis/offlineEngine';

/**
 * The mode banner. Present at the top of every analysis so the evidentiary
 * boundary is stated on the page rather than buried in an about screen.
 */
export function QuranOnlyBadge({ compact = false }: { compact?: boolean }) {
  const { palette, radii, spacing } = useTheme();

  return (
    <View
      style={{
        borderRadius: radii.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.accent,
        backgroundColor: palette.accentSoft,
        paddingVertical: compact ? spacing.sm : spacing.md,
        paddingHorizontal: spacing.md,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: palette.accent,
          }}
        />
        <AppText variant="small" weight="bold" tone="accent">
          QURAN ONLY — القرآن فقط
        </AppText>
      </View>
      {!compact ? (
        <AppText variant="tiny" tone="muted">
          {QURAN_ONLY_NOTICE}
        </AppText>
      ) : null}
    </View>
  );
}
