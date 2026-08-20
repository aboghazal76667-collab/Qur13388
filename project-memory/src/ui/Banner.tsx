import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  body: string;
  action?: React.ReactNode;
}

/**
 * Used for user-facing problems and notices. Technical detail never reaches
 * here — it goes to the log sink instead.
 */
export function Banner({ tone = 'info', title, body, action }: BannerProps) {
  const theme = useTheme();
  const { isRtl } = useI18n();

  const config = {
    info: { bg: theme.colors.primarySoft, fg: 'primary' as const, icon: 'information-circle-outline' as const },
    success: { bg: theme.colors.successSoft, fg: 'success' as const, icon: 'checkmark-circle-outline' as const },
    warning: { bg: theme.colors.warningSoft, fg: 'warning' as const, icon: 'alert-circle-outline' as const },
    danger: { bg: theme.colors.dangerSoft, fg: 'danger' as const, icon: 'heart-dislike-outline' as const },
  }[tone];

  return (
    <View
      accessible
      accessibilityRole="alert"
      style={{
        flexDirection: isRtl ? 'row-reverse' : 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: config.bg,
      }}
    >
      <Ionicons name={config.icon} size={20} color={theme.colors[config.fg]} />
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        {title ? (
          <Text variant="bodyStrong" color={config.fg}>
            {title}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {body}
        </Text>
        {action}
      </View>
    </View>
  );
}
