import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getBackend } from '@/data';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { exportFamilyData } from '@/features/settings/exportData';
import { useArchive } from '@/state/archive';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Row, RowGroup, Screen, ScreenHeader, Text, Toggle } from '@/ui';

/**
 * Privacy controls.
 *
 * Everything a parent can actually do about their data lives on one screen and
 * is reachable in two taps: read what we hold, take a copy, delete a child,
 * delete everything, close the account. Controls that only exist in a policy
 * document are not controls.
 */
export default function Privacy() {
  const theme = useTheme();
  const router = useRouter();
  const { t, isRtl, format, formatNumber } = useI18n();

  const profile = useSession((state) => state.profile);
  const updateProfile = useSession((state) => state.updateProfile);
  const deleteAccount = useSession((state) => state.deleteAccount);
  const clearArchive = useArchive((state) => state.clear);
  const load = useArchive((state) => state.load);

  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'danger'; body: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    try {
      const result = await exportFamilyData();
      setNotice({
        tone: 'success',
        body: format(t.privacy.exportSaved, {
          children: formatNumber(result.children),
          memories: formatNumber(result.memories),
          path: result.path ?? '—',
        }),
      });
    } catch (error) {
      setNotice({ tone: 'danger', body: friendlyMessage(error, t.errors) });
    } finally {
      setBusy(false);
    }
  };

  const deleteEverything = () => {
    Alert.alert(t.privacy.deleteEverything, t.privacy.deleteEverythingConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await getBackend().family.deleteAllContent();
            clearArchive();
            await load();
            router.replace('/(app)/family');
          } catch (error) {
            setNotice({ tone: 'danger', body: friendlyMessage(error, t.errors) });
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const closeAccount = () => {
    Alert.alert(t.settings.deleteAccount, t.settings.deleteAccountConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
            clearArchive();
            router.replace('/(auth)/sign-up');
          } catch (error) {
            setNotice({ tone: 'danger', body: friendlyMessage(error, t.errors) });
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title={t.settings.privacyTitle} subtitle={t.privacy.heading} />

      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
        {notice ? <Banner tone={notice.tone} body={notice.body} /> : null}

        <View style={{ gap: theme.spacing.md }}>
          {t.privacy.points.map((point) => (
            <Card key={point.title}>
              <View
                style={{
                  flexDirection: isRtl ? 'row-reverse' : 'row',
                  gap: theme.spacing.md,
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.success} />
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text variant="bodyStrong">{point.title}</Text>
                  <Text variant="caption" color="textMuted">
                    {point.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <Card>
          <View
            style={{
              flexDirection: isRtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.lg,
            }}
          >
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="bodyStrong">{t.privacy.trainingOptInTitle}</Text>
              <Text variant="caption" color="textMuted">
                {t.privacy.trainingOptInBody}
              </Text>
            </View>
            <Toggle
              accessibilityLabel={t.privacy.trainingOptInTitle}
              value={profile?.allowsModelTraining ?? false}
              onValueChange={(value) => {
                updateProfile({ allowsModelTraining: value }).catch((error) =>
                  setNotice({ tone: 'danger', body: friendlyMessage(error, t.errors) }),
                );
              }}
            />
          </View>
        </Card>

        <RowGroup>
          <Row label={t.privacy.exportData} icon="download-outline" onPress={exportData} />
          <Row label={t.privacy.deleteEverything} icon="trash-outline" destructive onPress={deleteEverything} />
          <Row label={t.settings.deleteAccount} icon="person-remove-outline" destructive onPress={closeAccount} />
        </RowGroup>

        {busy ? <Button label={t.common.loading} loading disabled /> : null}
      </View>
    </Screen>
  );
}
