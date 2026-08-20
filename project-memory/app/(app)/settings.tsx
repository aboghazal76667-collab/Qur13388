import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBackend } from '@/data';
import { useI18n, type Language } from '@/i18n';
import { env } from '@/lib/env';
import { useTheme, type AppearancePreference } from '@/theme';
import { useArchive } from '@/state/archive';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { Chip, Row, RowGroup, Text } from '@/ui';

/**
 * Settings.
 *
 * Language and appearance sit at the top because they are the two things a
 * parent is most likely to want to change, and privacy sits directly under
 * them rather than buried at the bottom of a legal section.
 */
export default function Settings() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language, isRtl } = useI18n();

  const profile = useSession((state) => state.profile);
  const signOut = useSession((state) => state.signOut);
  const updateProfile = useSession((state) => state.updateProfile);
  const clearArchive = useArchive((state) => state.clear);
  const family = useArchive((state) => state.family);

  const setLanguage = useSettings((state) => state.setLanguage);
  const appearance = useSettings((state) => state.appearance);
  const setAppearance = useSettings((state) => state.setAppearance);

  const [busy, setBusy] = useState(false);

  const adminAvailable = getBackend().admin.isAvailable() && (profile?.isStaff ?? false);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    // Kept on the profile too, so the choice follows the parent to a new phone.
    updateProfile({ language: next }).catch(() => undefined);
  };

  const confirmSignOut = () => {
    Alert.alert(t.settings.signOut, '', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.signOut,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await signOut();
          clearArchive();
          setBusy(false);
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const appearanceOptions: { key: AppearancePreference; label: string }[] = [
    { key: 'system', label: t.settings.appearanceSystem },
    { key: 'light', label: t.settings.appearanceLight },
    { key: 'dark', label: t.settings.appearanceDark },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.xl,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xxxl,
        gap: theme.spacing.xl,
      }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text variant="title" accessibilityRole="header">
        {t.settings.title}
      </Text>

      <RowGroup title={t.settings.account}>
        <Row label={profile?.displayName ?? '—'} value={profile?.email ?? ''} icon="person-outline" />
        <Row label={family?.name ?? '—'} value={t.auth.familyName} icon="home-outline" />
      </RowGroup>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="label" color="textFaint">
          {t.settings.language.toUpperCase()}
        </Text>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
          <Chip
            label="English"
            selected={language === 'en'}
            tone={language === 'en' ? 'primary' : 'neutral'}
            onPress={() => changeLanguage('en')}
          />
          <Chip
            label="العربية"
            selected={language === 'ar'}
            tone={language === 'ar' ? 'primary' : 'neutral'}
            onPress={() => changeLanguage('ar')}
          />
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="label" color="textFaint">
          {t.settings.appearance.toUpperCase()}
        </Text>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {appearanceOptions.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              selected={appearance === option.key}
              tone={appearance === option.key ? 'primary' : 'neutral'}
              onPress={() => setAppearance(option.key)}
            />
          ))}
        </View>
      </View>

      <RowGroup title={t.settings.privacy}>
        <Row
          label={t.settings.privacyTitle}
          icon="lock-closed-outline"
          onPress={() => router.push('/privacy')}
        />
        <Row
          label={t.settings.occasions}
          value={t.settings.occasionsHint}
          icon="calendar-outline"
          onPress={() => router.push('/occasions')}
        />
        <Row
          label={t.settings.plans}
          value={t.settings.plansHint}
          icon="pricetag-outline"
          onPress={() => router.push('/plans')}
        />
      </RowGroup>

      {adminAvailable ? (
        <RowGroup>
          <Row label={t.settings.admin} icon="construct-outline" onPress={() => router.push('/admin')} />
        </RowGroup>
      ) : null}

      <RowGroup>
        <Row
          label={t.settings.version}
          value={`${env.appVersion} · ${t.settings.backendMode}: ${getBackend().key}`}
          icon="information-circle-outline"
        />
        <Row label={t.settings.signOut} icon="log-out-outline" onPress={confirmSignOut} />
      </RowGroup>

      {busy ? (
        <Text variant="caption" color="textFaint">
          {t.common.loading}
        </Text>
      ) : null}
    </ScrollView>
  );
}
