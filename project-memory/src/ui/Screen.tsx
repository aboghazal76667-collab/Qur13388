import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Scrollable by default; set false for screens that manage their own list. */
  scroll?: boolean;
  /** Extra bottom padding for a fixed footer. */
  footer?: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  background?: 'background' | 'backgroundAlt' | 'surface';
}

/**
 * The one place that knows about safe areas and keyboard avoidance. Screens
 * compose this instead of re-deriving insets each time.
 *
 * Note what this deliberately does *not* do: set `direction: 'rtl'` on the
 * container. Layout direction is handled by components flipping their own
 * `flexDirection` to `row-reverse`, and doing both cancels out — a container
 * in RTL flips its children, and `row-reverse` flips them straight back. One
 * mechanism, applied consistently, is the only version that works on iOS,
 * Android and web alike.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  padded = true,
  style,
  contentStyle,
  background = 'background',
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding = padded ? theme.spacing.xl : 0;

  const body = (
    <View style={styles.fill}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            {
              paddingHorizontal: padding,
              paddingBottom: theme.spacing.xxxl + (footer ? 0 : insets.bottom),
              flexGrow: 1,
            },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, { paddingHorizontal: padding }, contentStyle]}>{children}</View>
      )}

      {footer ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.md,
            paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors[background],
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fill, { backgroundColor: theme.colors[background] }, style]}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
