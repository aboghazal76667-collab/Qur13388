import React from 'react';
import { Text } from 'react-native';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../src/theme/ThemeProvider';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Tab bar metrics, derived rather than eyeballed.
 *
 * The bar hands each item `BAR_HEIGHT - 2 * BAR_PADDING`, and the item spends
 * 10px of that on its own padding. Whatever is left has to hold the icon, the
 * gap and the full label line — otherwise the label box collapses and the
 * descenders on ل، ج، ي are clipped away.
 */
const ICON_SIZE = 22;
const ICON_GAP = 2;
const LABEL_HEIGHT = 16;
const ITEM_PADDING = 10;
const BAR_PADDING = 6;
/** Slack covers the margins react-navigation adds inside each tab item. */
const ITEM_SLACK = 12;
const BAR_HEIGHT =
  ICON_SIZE + ICON_GAP + LABEL_HEIGHT + ITEM_PADDING + BAR_PADDING * 2 + ITEM_SLACK;

export default function TabsLayout() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  const icon =
    (name: IconName, focusedName: IconName) =>
    ({ color, focused }: { color: ColorValue; size: number; focused: boolean }) => (
      <Ionicons name={focused ? focusedName : name} size={ICON_SIZE} color={color} />
    );

  /**
   * The default label renderer collapses its box to a few pixels and clips with
   * `overflow: hidden`, which cuts the descenders off Arabic labels (ل، ج، ي).
   * Rendering the label directly keeps the line box under our control.
   */
  const label =
    (text: string) =>
    ({ color }: { color: ColorValue; focused: boolean }) => (
      <Text
        numberOfLines={1}
        style={{
          color: color as string,
          fontSize: 11,
          lineHeight: LABEL_HEIGHT,
          height: LABEL_HEIGHT,
          textAlign: 'center',
          writingDirection: 'rtl',
        }}
      >
        {text}
      </Text>
    );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: BAR_HEIGHT + insets.bottom,
          paddingTop: BAR_PADDING,
          paddingBottom: BAR_PADDING + insets.bottom,
        },
        tabBarIconStyle: { marginBottom: ICON_GAP },
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'اسأل',
          tabBarIcon: icon('sparkles-outline', 'sparkles'),
          tabBarLabel: label('اسأل'),
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          title: 'المصحف',
          tabBarIcon: icon('book-outline', 'book'),
          tabBarLabel: label('المصحف'),
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: 'قارن',
          tabBarIcon: icon('git-compare-outline', 'git-compare'),
          tabBarLabel: label('قارن'),
        }}
      />
      <Tabs.Screen
        name="thinkers"
        options={{
          title: 'المفكرون',
          tabBarIcon: icon('people-outline', 'people'),
          tabBarLabel: label('المفكرون'),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'السجل',
          tabBarIcon: icon('time-outline', 'time'),
          tabBarLabel: label('السجل'),
        }}
      />
    </Tabs>
  );
}
