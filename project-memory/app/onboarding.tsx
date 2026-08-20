import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { analytics } from '@/services/analytics';
import { useSettings } from '@/state/settings';
import { Button, Screen, Text } from '@/ui';

/**
 * Onboarding.
 *
 * Four screens, no product explanation, no feature list. The first thing a
 * parent should feel is why this matters — the mechanics can wait until they
 * are inside. The illustration is drawn rather than photographed so that the
 * app never ships with a stock image of somebody else's child.
 */

const slideCount = 4;

function SlideArt({ index, tint, soft }: { index: number; tint: string; soft: string }) {
  const size = Math.min(Dimensions.get('window').width - 80, 300);

  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 300 216">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="45%" r="65%">
          <Stop offset="0%" stopColor={soft} stopOpacity="1" />
          <Stop offset="100%" stopColor={soft} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="150" cy="100" r="96" fill="url(#glow)" />

      {index === 0 ? (
        // A single moment, held.
        <>
          <Circle cx="150" cy="100" r="46" fill="none" stroke={tint} strokeWidth="3" opacity={0.5} />
          <Circle cx="150" cy="100" r="9" fill={tint} />
          <Path d="M150 62 L150 100 L176 114" stroke={tint} strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      ) : index === 1 ? (
        // Chapters, stacking up year on year.
        <>
          {[0, 1, 2, 3].map((row) => (
            <Path
              key={row}
              d={`M ${88 + row * 4} ${150 - row * 26} h ${124 - row * 8} a 8 8 0 0 1 8 8 v 16 a 8 8 0 0 1 -8 8 h ${-(124 - row * 8)} a 8 8 0 0 1 -8 -8 v -16 a 8 8 0 0 1 8 -8 z`}
              fill={row === 3 ? tint : 'none'}
              stroke={tint}
              strokeWidth="3"
              opacity={row === 3 ? 0.9 : 0.45 + row * 0.12}
            />
          ))}
        </>
      ) : index === 2 ? (
        // Photo, message, and something you can hold.
        <>
          <Path d="M74 68 h72 a10 10 0 0 1 10 10 v56 a10 10 0 0 1 -10 10 h-72 a10 10 0 0 1 -10 -10 v-56 a10 10 0 0 1 10 -10 z" fill="none" stroke={tint} strokeWidth="3" />
          <Circle cx="98" cy="94" r="9" fill={tint} opacity={0.7} />
          <Path d="M70 128 l26 -24 l20 18 l18 -14 l22 20" stroke={tint} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Ellipse cx="206" cy="152" rx="28" ry="7" fill={tint} opacity={0.25} />
          <Path d="M206 82 a16 16 0 1 1 0.1 0 z" fill={tint} opacity={0.85} />
          <Path d="M192 104 q14 -8 28 0 l6 44 h-40 z" fill={tint} opacity={0.85} />
        </>
      ) : (
        // A door opening onto their story.
        <>
          <Path d="M108 158 v-84 a42 42 0 0 1 84 0 v84 z" fill="none" stroke={tint} strokeWidth="3" />
          <Path d="M118 158 v-80 a32 32 0 0 1 64 0 v80 z" fill={tint} opacity={0.12} />
          <Circle cx="170" cy="120" r="5" fill={tint} />
          <Path d="M84 158 h132" stroke={tint} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

export default function Onboarding() {
  const theme = useTheme();
  const router = useRouter();
  const { t, isRtl } = useI18n();
  const completeOnboarding = useSettings((state) => state.completeOnboarding);

  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    fade.setValue(0);
    rise.setValue(16);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: theme.motion.storytelling,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: theme.motion.storytelling,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, fade, rise, theme.motion.storytelling]);

  const slide = t.onboarding.slides[index];
  const isLast = index === slideCount - 1;

  const finish = () => {
    completeOnboarding();
    analytics.track('onboarding_completed');
    router.replace('/(auth)/sign-up');
  };

  const advance = () => {
    if (isLast) finish();
    else setIndex((current) => current + 1);
  };

  return (
    <Screen
      scroll={false}
      footer={
        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={isLast ? t.onboarding.start : t.common.continue}
            onPress={advance}
            emphasise={isLast}
          />
          <Button
            label={isLast ? t.onboarding.haveAccount : t.common.skip}
            variant="ghost"
            size="medium"
            onPress={() => {
              completeOnboarding();
              router.replace(isLast ? '/(auth)/sign-in' : '/(auth)/sign-up');
            }}
          />
        </View>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.xxl }}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <SlideArt index={index} tint={theme.colors.primary} soft={theme.colors.primarySoft} />
        </Animated.View>

        <Animated.View
          style={{ opacity: fade, transform: [{ translateY: rise }], gap: theme.spacing.md }}
        >
          <Text variant="display" align="center" autoAlign={false} accessibilityRole="header">
            {slide.title}
          </Text>
          <Text variant="body" color="textMuted" align="center" autoAlign={false}>
            {slide.body}
          </Text>
        </Animated.View>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: slideCount, now: index + 1 }}
        style={{
          flexDirection: isRtl ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          justifyContent: 'center',
          paddingBottom: theme.spacing.lg,
        }}
      >
        {Array.from({ length: slideCount }, (_, dot) => (
          <View
            key={dot}
            style={{
              width: dot === index ? 22 : 7,
              height: 7,
              borderRadius: theme.radius.pill,
              backgroundColor: dot === index ? theme.colors.primary : theme.colors.borderStrong,
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
