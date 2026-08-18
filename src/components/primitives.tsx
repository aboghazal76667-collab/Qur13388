/** Small themed building blocks used across every screen. */

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

import { useTheme } from '../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type TextVariant = 'title' | 'heading' | 'body' | 'small' | 'tiny' | 'quran';
type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'quran';

interface AppTextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'bold';
  align?: 'right' | 'center' | 'left' | 'auto';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}

export function AppText({
  children,
  variant = 'body',
  tone = 'default',
  weight = 'regular',
  align = 'right',
  style,
  numberOfLines,
  selectable,
}: AppTextProps) {
  const { palette, typography, quranScale } = useTheme();

  const sizes: Record<TextVariant, number> = {
    title: typography.title,
    heading: typography.heading,
    body: typography.body,
    small: typography.small,
    tiny: typography.tiny,
    quran: typography.quran * quranScale,
  };

  const colors: Record<TextTone, string> = {
    default: palette.text,
    muted: palette.textMuted,
    faint: palette.textFaint,
    accent: palette.accent,
    quran: palette.quran,
  };

  const lineHeight =
    variant === 'quran'
      ? sizes.quran * typography.quranLineHeight
      : sizes[variant] * typography.bodyLineHeight;

  return (
    <Text
      selectable={selectable}
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: sizes[variant],
          lineHeight,
          color: colors[tone],
          textAlign: align,
          writingDirection: 'rtl',
          fontWeight: weight === 'bold' ? '700' : weight === 'medium' ? '600' : '400',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'alt' | 'accent';
  padded?: boolean;
}

export function Card({ children, onPress, style, tone = 'default', padded = true }: CardProps) {
  const { palette, radii, spacing } = useTheme();

  const backgroundColor =
    tone === 'accent' ? palette.accentSoft : tone === 'alt' ? palette.surfaceAlt : palette.surface;

  const content = (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {content}
    </Pressable>
  );
}

export function Divider({ spacingY = 12 }: { spacingY?: number }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: palette.border,
        marginVertical: spacingY,
      }}
    />
  );
}

export function Spacer({ size = 12 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

// ---------------------------------------------------------------------------
// Badges & chips
// ---------------------------------------------------------------------------

interface BadgeProps {
  label: string;
  tone?: 'accent' | 'neutral' | 'strong' | 'good' | 'caution' | 'external' | 'danger';
  size?: 'sm' | 'md';
}

export function Badge({ label, tone = 'neutral', size = 'sm' }: BadgeProps) {
  const { palette, radii } = useTheme();
  const color =
    tone === 'accent'
      ? palette.accent
      : tone === 'strong'
        ? palette.strong
        : tone === 'good'
          ? palette.good
          : tone === 'caution'
            ? palette.caution
            : tone === 'external'
              ? palette.external
              : tone === 'danger'
                ? palette.danger
                : palette.textMuted;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: size === 'md' ? 12 : 9,
        paddingVertical: size === 'md' ? 6 : 4,
        borderRadius: radii.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: size === 'md' ? 13 : 11,
          color,
          fontWeight: '600',
          writingDirection: 'rtl',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export function Chip({ label, onPress, selected, compact }: ChipProps) {
  const { palette, radii } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: compact ? 10 : 14,
        paddingVertical: compact ? 6 : 9,
        borderRadius: radii.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? palette.accent : palette.border,
        backgroundColor: selected ? palette.accentSoft : palette.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: compact ? 13 : 14,
          color: selected ? palette.accent : palette.text,
          writingDirection: 'rtl',
          fontWeight: selected ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({
  children,
  gap = 8,
  wrap = true,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row-reverse',
          flexWrap: wrap ? 'wrap' : 'nowrap',
          gap,
          alignItems: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const { palette, radii } = useTheme();
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPrimary ? palette.accent : isGhost ? 'transparent' : palette.surfaceAlt,
          borderWidth: isGhost ? StyleSheet.hairlineWidth : 0,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? palette.accentText : palette.accent} />
      ) : (
        <Text
          style={{
            color: isPrimary ? palette.accentText : palette.text,
            fontWeight: '600',
            fontSize: 16,
            writingDirection: 'rtl',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { palette, spacing } = useTheme();
  const style: StyleProp<ViewStyle> = [
    { padding: padded ? spacing.lg : 0, paddingBottom: 48 },
    contentStyle,
  ];

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: palette.background }, style]}>{children}</View>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={style}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md, marginTop: spacing.sm }}>
      <AppText variant="heading" weight="bold">
        {children}
      </AppText>
      {hint ? (
        <AppText variant="small" tone="faint" style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm }}>
      <AppText variant="heading" weight="medium" align="center">
        {title}
      </AppText>
      <AppText variant="small" tone="muted" align="center">
        {message}
      </AppText>
    </View>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  const { palette, spacing } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.md }}>
      <ActivityIndicator color={palette.accent} size="large" />
      <AppText variant="small" tone="muted" align="center">
        {label}
      </AppText>
    </View>
  );
}
