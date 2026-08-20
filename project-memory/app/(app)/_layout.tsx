import React, { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { useArchive } from '@/state/archive';
import { useSession } from '@/state/session';

export default function AppLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const status = useSession((state) => state.status);
  const load = useArchive((state) => state.load);

  useEffect(() => {
    if (status === 'signed_in') load();
  }, [status, load]);

  if (status !== 'signed_in') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...theme.typography.micro, marginTop: 2 },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="family"
        options={{
          title: t.family.title,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: t.memory.archiveTitle,
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings.title,
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
