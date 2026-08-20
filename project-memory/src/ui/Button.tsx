import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'large' | 'medium' | 'small';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** Set for actions that are hard to undo, so the press gets a haptic beat. */
  emphasise?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  fullWidth = true,
  icon,
  style,
  accessibilityHint,
  emphasise = false,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const height = size === 'large' ? 54 : size === 'medium' ? 48 : theme.minTouchTarget;
  const paddingHorizontal =
    size === 'small' ? theme.spacing.lg : size === 'medium' ? theme.spacing.xl : theme.spacing.xl;

  const background = (pressed: boolean): string => {
    if (variant === 'ghost') return pressed ? theme.colors.backgroundAlt : 'transparent';
    if (variant === 'secondary') return pressed ? theme.colors.backgroundAlt : theme.colors.surface;
    if (variant === 'danger') return pressed ? theme.colors.danger : theme.colors.dangerSoft;
    return pressed ? theme.colors.primaryPressed : theme.colors.primary;
  };

  const labelColor =
    variant === 'primary' ? 'onPrimary' : variant === 'danger' ? 'danger' : 'text';

  const handlePress = () => {
    if (inactive || !onPress) return;
    if (emphasise) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal,
          borderRadius: theme.radius.lg,
          backgroundColor: background(pressed),
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: theme.colors.borderStrong,
          opacity: inactive ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.onPrimary : theme.colors.primary} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {icon}
          <Text
            variant={size === 'small' ? 'label' : 'bodyStrong'}
            color={labelColor}
            autoAlign={false}
            align="center"
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center' },
});
