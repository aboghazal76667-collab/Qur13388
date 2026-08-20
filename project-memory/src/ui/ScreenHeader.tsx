import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
  large?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  large = true,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t, isRtl } = useI18n();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: isRtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: showBack || right ? theme.minTouchTarget : 0,
        }}
      >
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            onPress={handleBack}
            hitSlop={12}
            style={({ pressed }) => ({
              width: theme.minTouchTarget,
              height: theme.minTouchTarget,
              borderRadius: theme.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.colors.backgroundAlt : 'transparent',
            })}
          >
            <Ionicons
              name={isRtl ? 'chevron-forward' : 'chevron-back'}
              size={24}
              color={theme.colors.text}
            />
          </Pressable>
        ) : (
          <View />
        )}
        {right ?? <View />}
      </View>

      {title ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant={large ? 'title' : 'heading'} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
