import React, { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Badge, Button, Card, Loading, Notice, Row, T } from '@dd/components/ui';
import type { PreviewAsset } from '@dd/domain/types';
import { useI18n } from '@dd/i18n';
import {
  assessPhoto,
  buildGarmentSpec,
  virtualTryOnProviderV2,
  type PhotoQuality,
} from '@dd/services/ai';
import { activeMeasurements } from '@dd/store/profileStore';
import { useDesignStore } from '@dd/store/designStore';
import { useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';
import { nowIso } from '@dd/utils/date';

/**
 * OPTIONAL TRY-ON PHOTO.
 *
 * Three rules this screen exists to hold:
 *  - Nothing happens until the customer ticks consent and taps deliberately.
 *  - The photo is session-scoped: it is not persisted unless the privacy
 *    setting says so, and "delete photo" removes it immediately.
 *  - Designing and buying never require a photo.
 */
export default function PhotoConsent() {
  const { t, L } = useI18n();
  const config = useDesignStore((s) => s.config);
  const privacy = useProfileStore((s) => s.privacy);
  const setPrivacy = useProfileStore((s) => s.setPrivacy);

  const [consent, setConsent] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<PhotoQuality | null>(null);
  const measurements = useProfileStore((s) => s.measurements);
  const selectedMeasurementId = useProfileStore((s) => s.selectedMeasurementId);
  const measurement =
    activeMeasurements(measurements).find((m) => m.id === selectedMeasurementId) ?? null;

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(L({ ar: 'لم يتم منح الإذن للوصول للصور.', en: 'Permission to access photos was not granted.' }));
        return;
      }
      const picked =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (!picked.canceled && picked.assets[0]) {
        const a = picked.assets[0];
        setPhotoUri(a.uri);
        // Framing check only — no biometric or body-shape inference.
        setQuality(assessPhoto(a.width ?? 0, a.height ?? 0));
      }
    } catch {
      setError(L({ ar: 'تعذّر فتح الكاميرا أو المعرض.', en: 'Could not open the camera or gallery.' }));
    }
  };

  const render = async () => {
    if (!photoUri || !consent) return;
    setLoading(true);
    setError(null);
    try {
      const { asset } = await virtualTryOnProviderV2.render({
        // The exact configured design travels with the photo, so the model has
        // no room to invent a different dishdasha.
        spec: buildGarmentSpec(config, measurement, 0),
        customerPhotoUri: photoUri,
        consentAt: nowIso(),
        photoQuality: quality ?? undefined,
      });
      setResult(asset);
    } catch {
      setError(t('preview.failed'));
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = () => {
    setPhotoUri(null);
    setResult(null);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('preview.tryOn') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <Notice text={t('preview.tryOnOptional')} tone="info" />

        <Card>
          <View style={{ gap: theme.space.sm }}>
            <T variant="small" weight="700">
              {t('tryon.guidance')}
            </T>
            {(['tryon.fullBody', 'tryon.standing', 'tryon.lighting', 'tryon.frontFacing'] as const).map((k) => (
              <T key={k} variant="tiny" color={theme.color.textMuted}>
                · {t(k)}
              </T>
            ))}
          </View>
        </Card>

        <Card>
          <View style={{ gap: theme.space.md }}>
            <Pressable
              onPress={() => setConsent(!consent)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
            >
              <Row gap={theme.space.md} align="flex-start">
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: consent ? theme.color.accent : theme.color.borderStrong,
                    backgroundColor: consent ? theme.color.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {consent ? <T variant="tiny" color="#FFFFFF" weight="700">✓</T> : null}
                </View>
                <T variant="small" style={{ flex: 1 }}>
                  {L({
                    ar: 'أوافق على استخدام هذه الصورة لإنشاء معاينة لي فقط. لن تُحفظ إلا إذا فعّلت ذلك في إعدادات الخصوصية.',
                    en: 'I agree to this photo being used to generate a preview for me only. It is not stored unless I enable that in privacy settings.',
                  })}
                </T>
              </Row>
            </Pressable>

            <Row gap={theme.space.sm}>
              <Button label={t('kumma.camera')} onPress={() => pick('camera')} disabled={!consent} variant="secondary" style={{ flex: 1 }} />
              <Button label={t('kumma.gallery')} onPress={() => pick('library')} disabled={!consent} variant="secondary" style={{ flex: 1 }} />
            </Row>
          </View>
        </Card>

        {photoUri ? (
          <Card>
            <View style={{ gap: theme.space.md }}>
              <Row justify="space-between">
                <T variant="small" weight="700">
                  {L({ ar: 'الصورة المختارة', en: 'Selected photo' })}
                </T>
                <Badge label={privacy.storeTryOnPhotos ? L({ ar: 'ستُحفظ', en: 'Will be stored' }) : L({ ar: 'مؤقتة', en: 'Session only' })} tone={privacy.storeTryOnPhotos ? 'warning' : 'success'} />
              </Row>
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: 260, borderRadius: theme.radius.md }} resizeMode="cover" />
              {quality && !quality.acceptable ? (
                <Notice tone="warning" text={t('tryon.qualityPoor')} />
              ) : null}
              <Button
                label={t('preview.generate')}
                onPress={render}
                loading={loading}
                disabled={Boolean(quality && !quality.acceptable)}
                full
              />
              <Button label={t('kumma.remove')} onPress={deletePhoto} variant="danger" full />
              <Pressable onPress={() => setPrivacy({ storeTryOnPhotos: !privacy.storeTryOnPhotos })} accessibilityRole="switch">
                <T variant="tiny" color={theme.color.accent}>
                  {privacy.storeTryOnPhotos
                    ? L({ ar: 'إيقاف حفظ صور التجربة', en: 'Stop storing try-on photos' })
                    : L({ ar: 'السماح بحفظ صور التجربة', en: 'Allow storing try-on photos' })}
                </T>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {loading ? <Loading label={t('preview.generating')} /> : null}
        {error ? <Notice text={error} tone="warning" /> : null}
        {result ? (
          <Card>
            <View style={{ gap: theme.space.md }}>
              <T variant="small" weight="700">
                {t('tryon.beforeAfter')}
              </T>
              <Notice text={t('preview.simulated')} tone="warning" />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
