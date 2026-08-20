import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Card({
  children,
  onPress,
  padded = true,
  raised = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const theme = useTheme();

  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: padded ? theme.spacing.lg : 0,
      overflow: 'hidden',
    },
    raised ? theme.elevation.raised : theme.elevation.card,
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}
    >
      {children}
    </Pressable>
  );
}
