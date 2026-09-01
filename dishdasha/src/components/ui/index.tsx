import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { theme } from '@dd/theme/tokens';
import { rowDirection, textAlign, useI18n } from '@dd/i18n';

/**
 * Shared UI primitives.
 *
 * Every one of these is direction-aware: rows flip and text aligns from the
 * language, not from a native RTL restart. That is what lets Arabic and
 * English switch instantly in the same session while both feel native.
 */

export const Row: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
}> = ({ children, style, gap = theme.space.sm, align = 'center', justify, wrap }) => {
  const { dir } = useI18n();
  return (
    <View
      style={[
        {
          flexDirection: rowDirection(dir),
          alignItems: align,
          justifyContent: justify,
          gap,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'tiny';

export const T: React.FC<{
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  weight?: '400' | '500' | '600' | '700';
  style?: StyleProp<TextStyle>;
  center?: boolean;
  numberOfLines?: number;
}> = ({ children, variant = 'body', color, weight, style, center, numberOfLines }) => {
  const { dir } = useI18n();
  const sizes: Record<TextVariant, number> = {
    display: theme.font.display,
    title: theme.font.title,
    heading: theme.font.heading,
    body: theme.font.body,
    small: theme.font.small,
    tiny: theme.font.tiny,
  };
  const defaultWeights: Record<TextVariant, TextStyle['fontWeight']> = {
    display: '700',
    title: '700',
    heading: '600',
    body: '400',
    small: '400',
    tiny: '500',
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: sizes[variant],
          fontWeight: weight ?? defaultWeights[variant],
          color: color ?? theme.color.text,
          textAlign: center ? 'center' : textAlign(dir),
          writingDirection: dir,
          lineHeight: sizes[variant] * (variant === 'body' || variant === 'small' ? 1.6 : 1.35),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  accessibilityLabel?: string;
}> = ({ children, style, onPress, padded = true, elevated = true, accessibilityLabel }) => {
  const content = (
    <View
      style={[
        styles.card,
        padded && { padding: theme.space.lg },
        elevated && theme.shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
};

/**
 * BUTTON SYSTEM.
 *
 * Five variants, three heights, one radius, one type scale — declared here and
 * nowhere else. V1 let screens pick arbitrary sizes, which is why the studio
 * ended up with four differently-weighted actions competing on one bar.
 *
 * Hierarchy rule: at most ONE primary per screen region. Everything else is
 * secondary, ghost or icon.
 */
export const BUTTON_HEIGHT = { sm: 36, md: 46, lg: 54 } as const;

export const Button: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  full,
  icon,
  style,
}) => {
  const { dir } = useI18n();
  const palettes = {
    primary: { bg: theme.color.accent, fg: theme.color.accentText, border: 'transparent' },
    secondary: { bg: theme.color.surface, fg: theme.color.text, border: theme.color.borderStrong },
    ghost: { bg: 'transparent', fg: theme.color.accent, border: 'transparent' },
    danger: { bg: theme.color.dangerBg, fg: theme.color.danger, border: theme.color.danger },
    icon: { bg: theme.color.surface, fg: theme.color.text, border: theme.color.border },
  } as const;
  const p = palettes[variant];
  const heights = BUTTON_HEIGHT;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      style={({ pressed }) => [
        {
          minHeight: heights[size],
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: p.border === 'transparent' ? 0 : 1,
          borderRadius: theme.radius.md,
          paddingHorizontal: size === 'sm' ? theme.space.md : theme.space.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: rowDirection(dir),
          gap: theme.space.sm,
          opacity: isDisabled ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={{
              color: p.fg,
              fontSize: size === 'sm' ? theme.font.small : theme.font.body,
              fontWeight: '600',
              writingDirection: dir,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
};

export const Chip: React.FC<{
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'accent' | 'warning' | 'info' | 'success' | 'danger';
  small?: boolean;
}> = ({ label, selected, onPress, tone = 'default', small }) => {
  const { dir } = useI18n();
  const tones = {
    default: { bg: theme.color.surface, fg: theme.color.textMuted, border: theme.color.border },
    accent: { bg: theme.color.accentSoft, fg: theme.color.accent, border: theme.color.accent },
    warning: { bg: theme.color.warningBg, fg: theme.color.warning, border: theme.color.warningBg },
    info: { bg: theme.color.infoBg, fg: theme.color.info, border: theme.color.infoBg },
    success: { bg: theme.color.successBg, fg: theme.color.success, border: theme.color.successBg },
    danger: { bg: theme.color.dangerBg, fg: theme.color.danger, border: theme.color.dangerBg },
  } as const;
  const t = selected
    ? { bg: theme.color.accent, fg: theme.color.accentText, border: theme.color.accent }
    : tones[tone];

  const body = (
    <View
      style={{
        backgroundColor: t.bg,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: theme.radius.pill,
        paddingHorizontal: small ? theme.space.md : theme.space.lg,
        paddingVertical: small ? 5 : 9,
        minHeight: onPress ? theme.hit - 10 : undefined,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: t.fg,
          fontSize: small ? theme.font.tiny : theme.font.small,
          fontWeight: '600',
          writingDirection: dir,
        }}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
};

export const Section: React.FC<{
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ title, action, children, subtitle, style }) => (
  <View style={[{ gap: theme.space.md }, style]}>
    <Row justify="space-between" align="flex-end">
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading">{title}</T>
        {subtitle ? (
          <T variant="small" color={theme.color.textMuted}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8}>
          <T variant="small" color={theme.color.accent} weight="600">
            {action.label}
          </T>
        </Pressable>
      ) : null}
    </Row>
    {children}
  </View>
);

export const Divider: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <View style={[{ height: 1, backgroundColor: theme.color.border }, style]} />
);

export const Badge: React.FC<{
  label: string;
  tone?: 'accent' | 'warning' | 'info' | 'success' | 'danger' | 'neutral';
}> = ({ label, tone = 'neutral' }) => {
  const { dir } = useI18n();
  const tones = {
    accent: [theme.color.accentSoft, theme.color.accent],
    warning: [theme.color.warningBg, theme.color.warning],
    info: [theme.color.infoBg, theme.color.info],
    success: [theme.color.successBg, theme.color.success],
    danger: [theme.color.dangerBg, theme.color.danger],
    neutral: [theme.color.bgSunken, theme.color.textMuted],
  } as const;
  const [bg, fg] = tones[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: theme.radius.xs, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: theme.font.tiny, fontWeight: '700', writingDirection: dir }}>
        {label}
      </Text>
    </View>
  );
};

export const Notice: React.FC<{
  text: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
}> = ({ text, tone = 'info', title }) => {
  const tones = {
    info: [theme.color.infoBg, theme.color.info],
    warning: [theme.color.warningBg, theme.color.warning],
    danger: [theme.color.dangerBg, theme.color.danger],
    success: [theme.color.successBg, theme.color.success],
  } as const;
  const [bg, fg] = tones[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: theme.radius.sm, padding: theme.space.md, gap: 4 }}>
      {title ? (
        <T variant="small" weight="700" color={fg}>
          {title}
        </T>
      ) : null}
      <T variant="small" color={fg}>
        {text}
      </T>
    </View>
  );
};

export const EmptyState: React.FC<{
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}> = ({ title, body, action }) => (
  <View style={{ alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space.xxl }}>
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.color.bgSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 22 }}>◇</Text>
    </View>
    <T variant="heading" center>
      {title}
    </T>
    {body ? (
      <T variant="small" color={theme.color.textMuted} center style={{ maxWidth: 280 }}>
        {body}
      </T>
    ) : null}
    {action ? <Button label={action.label} onPress={action.onPress} /> : null}
  </View>
);

export const Loading: React.FC<{ label?: string }> = ({ label }) => (
  <View style={{ padding: theme.space.xxl, alignItems: 'center', gap: theme.space.md }}>
    <ActivityIndicator color={theme.color.accent} />
    {label ? (
      <T variant="small" color={theme.color.textMuted}>
        {label}
      </T>
    ) : null}
  </View>
);

export const Screen: React.FC<{
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}> = ({ children, scroll = true, padded = true, style, contentStyle }) => {
  const body = padded ? (
    <View style={[{ padding: theme.space.lg, gap: theme.space.xl }, contentStyle]}>{children}</View>
  ) : (
    <View style={contentStyle}>{children}</View>
  );

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: theme.color.bg }, style]}>{body}</View>;
  }
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: theme.color.bg }, style]}
      contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
      keyboardShouldPersistTaps="handled"
    >
      {body}
    </ScrollView>
  );
};

/** Sticky action bar used at the bottom of the studio and checkout. */
export const StickyBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View
    style={{
      backgroundColor: theme.color.surface,
      borderTopWidth: 1,
      borderTopColor: theme.color.border,
      padding: theme.space.lg,
      gap: theme.space.md,
    }}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
});
