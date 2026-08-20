import React from 'react';
import { Switch } from 'react-native';

import { useTheme } from '@/theme';

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  const theme = useTheme();

  return (
    <Switch
      accessibilityLabel={accessibilityLabel}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
      thumbColor={theme.colors.surface}
    />
  );
}
