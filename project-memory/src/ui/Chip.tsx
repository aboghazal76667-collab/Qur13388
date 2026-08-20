import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';

export type ChipTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent';

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

export function Chip({ label, tone = 'neutral', selected = false, onPress, icon }: ChipProps) {
  const theme = useTheme();

  const backgrounds: Record<ChipTone, string> = {
    neutral: theme.colors.backgroundAlt,
    primary: theme.colors.primarySoft,
    success: theme.colors.successSoft,
    warning: theme.colors.warningSoft,
    danger: theme.colors.dangerSoft,
    accent: theme.colors.accentSoft,
  };
  const foregrounds: Record<ChipTone, 'text' | 'primary' | 'success' | 'warning' | 'danger' | 'accent'> = {
    neutral: 'text',
    primary: 'primary',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    accent: 'accent',
  };

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: backgrounds[tone],
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
      }}
    >
      {icon}
      <Text variant="label" color={foregrounds[tone]} autoAlign={false}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
    >
      {content}
    </Pressable>
  );
}
