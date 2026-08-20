import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

/**
 * The emotional progress view.
 *
 * A parent waiting on a figurine of their child should not be reading about
 * mesh decimation. Five sentences, each one arriving as its stage begins, and
 * a bar that only ever moves forward — a progress indicator that jumps
 * backwards reads as a fault even when nothing is wrong.
 */
export function GenerationStages({
  stageIndex,
  progress,
}: {
  stageIndex: number;
  progress: number;
}) {
  const theme = useTheme();
  const { t, isRtl } = useI18n();
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: theme.motion.slow,
      easing: Easing.out(Easing.quad),
      // Width cannot be driven natively; the animation is short and cheap.
      useNativeDriver: false,
    }).start();
  }, [progress, width, theme.motion.slow]);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View
        style={{
          height: 6,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.backgroundAlt,
          overflow: 'hidden',
          flexDirection: isRtl ? 'row-reverse' : 'row',
        }}
      >
        <Animated.View
          style={{
            width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
          }}
        />
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        {t.threeD.stages.map((stage, index) => {
          const done = index < stageIndex;
          const active = index === stageIndex;

          return (
            <View
              key={stage}
              accessible
              accessibilityLabel={stage}
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: isRtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                opacity: done || active ? 1 : 0.38,
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done
                    ? theme.colors.successSoft
                    : active
                      ? theme.colors.primarySoft
                      : theme.colors.backgroundAlt,
                }}
              >
                {done ? (
                  <Ionicons name="checkmark" size={15} color={theme.colors.success} />
                ) : (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: active ? theme.colors.primary : theme.colors.borderStrong,
                    }}
                  />
                )}
              </View>

              <Text variant={active ? 'bodyStrong' : 'body'} color={active ? 'text' : 'textMuted'}>
                {stage}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
