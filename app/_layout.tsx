import React, { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

// Arabic-first: force RTL so every default alignment, drawer edge and back
// gesture follows the reading direction rather than being flipped per-view.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { palette, isDark } = useTheme();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerTitleStyle: { fontWeight: '700' },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.background },
          animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="analysis/[id]" options={{ title: 'نتيجة التحليل' }} />
        <Stack.Screen name="surah/[id]" options={{ title: 'السورة' }} />
        <Stack.Screen name="verse/[key]" options={{ title: 'الآية' }} />
        <Stack.Screen name="word/[form]" options={{ title: 'تحليل الكلمة' }} />
        <Stack.Screen name="thinker/[id]" options={{ title: 'المفكر' }} />
        <Stack.Screen name="search" options={{ title: 'البحث' }} />
        <Stack.Screen name="favorites" options={{ title: 'المحفوظات' }} />
        <Stack.Screen name="graph" options={{ title: 'خريطة المعرفة' }} />
        <Stack.Screen name="settings" options={{ title: 'الإعدادات' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
