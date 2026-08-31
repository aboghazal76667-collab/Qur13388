import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND, fullBrandName } from '@dd/config/brand';
import { ENV } from '@dd/config/env';
import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { Badge, Button, Card, Notice, Row, T } from '@dd/components/ui';
import { DEMO_USUAL_CONFIG } from '@dd/data/demo';
import { useI18n } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';
import { useSessionStore } from '@dd/store/sessionStore';

/**
 * Welcome screen. Demo mode never forces registration: "تجربة التطبيق" loads
 * the seeded account instantly, because an empty first run cannot demonstrate
 * what this product actually is.
 */
export default function Welcome() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const signInDemo = useSessionStore((s) => s.signInDemo);
  const signIn = useSessionStore((s) => s.signIn);
  const [mode, setMode] = useState<'landing' | 'signin'>('landing');

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <View style={{ flex: 1, padding: theme.space.lg, gap: theme.space.lg }}>
        <Row justify="space-between">
          <Row gap={theme.space.sm}>
            <T variant="heading">{fullBrandName(lang)}</T>
            {ENV.DEMO_MODE ? <Badge label={t('auth.demoBadge')} tone="warning" /> : null}
          </Row>
          <Pressable
            onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.language')}
            hitSlop={10}
          >
            <T variant="small" color={theme.color.accent} weight="700">
              {lang === 'ar' ? 'English' : 'العربية'}
            </T>
          </Pressable>
        </Row>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <DishdashaFigure config={DEMO_USUAL_CONFIG} width={230} height={360} realistic />
        </View>

        <View style={{ gap: theme.space.sm }}>
          <T variant="display">{t('welcome.title')}</T>
          <T variant="body" color={theme.color.textMuted}>
            {t('welcome.subtitle')}
          </T>
        </View>

        {mode === 'landing' ? (
          <View style={{ gap: theme.space.md }}>
            <Button
              label={t('welcome.demo')}
              onPress={() => {
                signInDemo();
                router.replace('/(tabs)');
              }}
              size="lg"
              full
            />
            <T variant="tiny" color={theme.color.textFaint} center>
              {t('welcome.demoHint')}
            </T>
            <Row gap={theme.space.md}>
              <Button
                label={t('welcome.login')}
                variant="secondary"
                onPress={() => setMode('signin')}
                style={{ flex: 1 }}
              />
              <Button
                label={t('welcome.signup')}
                variant="secondary"
                onPress={() => setMode('signin')}
                style={{ flex: 1 }}
              />
            </Row>
          </View>
        ) : (
          <Card>
            <View style={{ gap: theme.space.md }}>
              <T variant="heading">{t('welcome.login')}</T>
              <Notice text={t('auth.otpSoon')} tone="info" />
              <Button
                label={`${t('auth.phone')} — ${t('auth.continue')}`}
                onPress={() => {
                  signIn('phone');
                  router.replace('/(tabs)');
                }}
                full
              />
              <Button
                label={`${t('auth.email')} — ${t('auth.continue')}`}
                variant="secondary"
                onPress={() => {
                  signIn('email');
                  router.replace('/(tabs)');
                }}
                full
              />
              <Button label={t('common.back')} variant="ghost" onPress={() => setMode('landing')} />
            </View>
          </Card>
        )}

        <T variant="tiny" color={theme.color.textFaint} center>
          {BRAND.codename}
        </T>
      </View>
    </SafeAreaView>
  );
}
