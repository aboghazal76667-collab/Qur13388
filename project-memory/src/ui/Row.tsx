import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface RowProps {
  label: string;
  value?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
  /** Marks features that are architected but not built yet. Never silent. */
  comingSoon?: boolean;
}

export function Row({ label, value, icon, onPress, destructive, right, comingSoon }: RowProps) {
  const theme = useTheme();
  const { t, isRtl } = useI18n();

  const content = (
    <View
      style={{
        flexDirection: isRtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.minTouchTarget + 8,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? theme.colors.danger : theme.colors.textMuted}
        />
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'}>
          {label}
        </Text>
        {value ? (
          <Text variant="caption" color="textFaint">
            {value}
          </Text>
        ) : null}
      </View>

      {comingSoon ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 3,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.backgroundAlt,
          }}
        >
          <Text variant="micro" color="textFaint" autoAlign={false}>
            {t.common.comingSoon}
          </Text>
        </View>
      ) : null}

      {right}

      {onPress && !right ? (
        <Ionicons
          name={isRtl ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={theme.colors.textFaint}
        />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={comingSoon ? t.common.comingSoon : undefined}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { backgroundColor: theme.colors.backgroundAlt } : undefined)}
    >
      {content}
    </Pressable>
  );
}

export function RowGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const theme = useTheme();
  const items = React.Children.toArray(children);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {title ? (
        <Text variant="label" color="textFaint" style={{ paddingHorizontal: theme.spacing.xs }}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        }}
      >
        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? (
              <View style={{ height: 1, backgroundColor: theme.colors.border, marginStart: theme.spacing.lg }} />
            ) : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}
