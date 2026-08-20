import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'sparkles-outline', title, body, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.lg, paddingVertical: theme.spacing.xxl }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primarySoft,
        }}
      >
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </View>

      <View style={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg }}>
        <Text variant="heading" align="center" autoAlign={false}>
          {title}
        </Text>
        {body ? (
          <Text variant="body" color="textMuted" align="center" autoAlign={false}>
            {body}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} size="medium" />
      ) : null}
    </View>
  );
}
