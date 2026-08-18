import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

import { useTheme } from '../../src/theme/ThemeProvider';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { palette } = useTheme();

  const icon =
    (name: IconName, focusedName: IconName) =>
    ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
      <Ionicons name={focused ? focusedName : name} size={size} color={color} />
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
        },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'اسأل', tabBarIcon: icon('sparkles-outline', 'sparkles') }}
      />
      <Tabs.Screen
        name="quran"
        options={{ title: 'المصحف', tabBarIcon: icon('book-outline', 'book') }}
      />
      <Tabs.Screen
        name="compare"
        options={{ title: 'قارن', tabBarIcon: icon('git-compare-outline', 'git-compare') }}
      />
      <Tabs.Screen
        name="thinkers"
        options={{ title: 'المفكرون', tabBarIcon: icon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'السجل', tabBarIcon: icon('time-outline', 'time') }}
      />
    </Tabs>
  );
}
