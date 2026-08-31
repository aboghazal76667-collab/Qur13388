import React, { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Badge, Button, Card, Loading, Notice, Row, Section, T } from '@dd/components/ui';
import { PaletteStrip } from '@dd/components/ui/Swatch';
import type { ExtractedPalette } from '@dd/services/ai/types';
import { useI18n } from '@dd/i18n';
import { colorExtractionService } from '@dd/services/ai';
import { track } from '@dd/services/analytics';
import { theme } from '@dd/theme/tokens';

/**
 * KUMMA / MUSSAR COLOUR MATCHING (experimental).
 *
 * Nothing is read from the photo until the customer both consents and taps.
 * On web the extraction is genuine canvas quantisation; on native it is
 * simulated and labelled as such — see services/ai/colorExtraction.ts.
 */
export default function KummaMatch() {
  const router = useRouter();
  const { t, L } = useI18n();

  const [consent, setConsent] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [palette, setPalette] = useState<ExtractedPalette | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(L({ ar: 'لم يتم منح الإذن.', en: 'Permission was not granted.' }));
        return;
      }
      const picked =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (picked.canceled || !picked.assets[0]) return;
      const uri = picked.assets[0].uri;
      setPhotoUri(uri);
      setPalette(null);
      await extract(uri);
    } catch {
      setError(L({ ar: 'تعذّر فتح الكاميرا أو المعرض.', en: 'Could not open the camera or gallery.' }));
    }
  };

  const extract = async (uri: string) => {
    setLoading(true);
    try {
      const result = await colorExtractionService.extract(uri);
      setPalette(result);
      track('kumma_match_used', { simulated: result.isSimulated });
    } catch {
      setError(t('preview.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('kumma.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <Row gap={theme.space.sm}>
          <Badge label={t('kumma.experimental')} tone="warning" />
        </Row>
        <T variant="small" color={theme.color.textMuted}>
          {t('kumma.intro')}
        </T>

        <Card>
          <View style={{ gap: theme.space.md }}>
            <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
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
                  {t('kumma.consent')}
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
          <Card padded={false}>
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
            <View style={{ padding: theme.space.md }}>
              <Button label={t('kumma.remove')} onPress={() => { setPhotoUri(null); setPalette(null); }} variant="danger" full />
            </View>
          </Card>
        ) : null}

        {loading ? <Loading /> : null}
        {error ? <Notice text={error} tone="warning" /> : null}

        {palette ? (
          <Section title={t('kumma.extracted')}>
            <Card>
              <View style={{ gap: theme.space.md }}>
                <PaletteStrip hexes={palette.hexes} size={30} />
                {palette.isSimulated ? (
                  <Notice
                    tone="warning"
                    text={L({
                      ar: 'استخراج الألوان على الهاتف محاكاة في هذه النسخة — النتائج توضيحية وليست قراءة فعلية للصورة.',
                      en: 'On-device colour extraction is simulated in this build — results are illustrative, not a real read of the photo.',
                    })}
                  />
                ) : (
                  <Notice
                    tone="success"
                    text={L({ ar: 'تم استخراج الألوان فعلياً من الصورة على جهازك.', en: 'Colours were genuinely extracted from the photo on your device.' })}
                  />
                )}
                <Button
                  label={t('kumma.suggest')}
                  onPress={() =>
                    router.push({
                      pathname: '/stylist',
                      params: { inspiration: palette.hexes.join(','), auto: '1' },
                    })
                  }
                  full
                />
              </View>
            </Card>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}
