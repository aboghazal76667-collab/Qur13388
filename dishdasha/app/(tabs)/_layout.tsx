import React from 'react';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';

export default function TabsLayout() {
  const { t } = useI18n();

  const icon =
    (name: React.ComponentProps<typeof Ionicons>['name']) =>
    ({ color, size }: { color: ColorValue; size: number }) => (
      <Ionicons name={name} color={color as string} size={size} />
    );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textFaint,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: theme.color.bg },
        headerTitleStyle: { fontWeight: '700', color: theme.color.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.color.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tab.home'), headerShown: false, tabBarIcon: icon('home-outline') }}
      />
      <Tabs.Screen
        name="design"
        options={{ title: t('tab.design'), headerShown: false, tabBarIcon: icon('color-palette-outline') }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: t('tab.orders'), tabBarIcon: icon('receipt-outline') }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: t('tab.saved'), tabBarIcon: icon('bookmark-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tab.profile'), tabBarIcon: icon('person-outline') }}
      />
    </Tabs>
  );
}
