import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

/**
 * Direction is expressed per-view (`row-reverse`, `textAlign: 'right'`,
 * `writingDirection: 'rtl'`), deliberately, rather than through
 * `I18nManager.forceRTL`.
 *
 * forceRTL flips the meaning of every flex direction in the tree, so the same
 * component would lay out one way and then the opposite way once the flag took
 * effect. On iOS the flag only applies after a native restart, which Expo Go
 * does not perform on reload — the first launch would render one direction and
 * every reload after it the other. React Native Web ignores the call entirely
 * and reports isRTL as false, so a forceRTL layout would also disagree with
 * itself between phone and browser.
 *
 * Being explicit costs a few extra style properties and buys identical layout
 * on every platform, on every launch.
 */

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
