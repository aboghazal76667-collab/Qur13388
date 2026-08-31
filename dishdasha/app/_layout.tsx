import React, { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@dd/components/ui/ErrorBoundary';
import { I18nProvider } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';
import { track } from '@dd/services/analytics';
import { useSessionStore } from '@dd/store/sessionStore';

export default function RootLayout() {
  const language = useSessionStore((s) => s.language);
  const setLanguage = useSessionStore((s) => s.setLanguage);

  useEffect(() => {
    track('app_open', { language });
    // Fires once per cold start; language is read at mount deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetLanguage = useCallback(
    (next: 'ar' | 'en') => setLanguage(next),
    [setLanguage],
  );

  return (
    <SafeAreaProvider>
      <I18nProvider lang={language} setLang={handleSetLanguage}>
        <ErrorBoundary lang={language}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.color.bg },
              headerTitleStyle: { fontWeight: '700', color: theme.color.text },
              headerTintColor: theme.color.accent,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.color.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </ErrorBoundary>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
