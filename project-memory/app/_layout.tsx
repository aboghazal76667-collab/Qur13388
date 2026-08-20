import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { I18nProvider } from '@/i18n';
import { ThemeProvider, useTheme } from '@/theme';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * The app shell.
 *
 * Language and appearance are read from device settings, and the session is
 * restored, before anything renders — otherwise an Arabic-speaking parent sees
 * a flash of English, and a signed-in parent sees a flash of the sign-in
 * screen. Both are small things that make a product feel unfinished.
 */
function Navigator() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        <Stack.Screen name="child/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="memory/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const { language, appearance, hydrated, hydrate } = useSettings();
  const restore = useSession((state) => state.restore);
  const status = useSession((state) => state.status);

  useEffect(() => {
    hydrate().then(() => restore());
  }, [hydrate, restore]);

  const ready = hydrated && status !== 'unknown';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={appearance}>
          <I18nProvider language={language}>
            <Navigator />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
