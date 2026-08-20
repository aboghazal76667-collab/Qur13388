import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { occasionCatalogue } from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { useArchive } from '@/state/archive';
import { Banner, Card, Row, Screen, ScreenHeader, Text, Toggle } from '@/ui';

/**
 * Which days this family marks.
 *
 * Nothing is on by default and nothing is treated as universal. A family in
 * Muscat and a family in Manchester have different calendars, and a product
 * that ships Christmas as a default and Eid as an option has already told its
 * customers who it was built for.
 */
export default function Occasions() {
  const theme = useTheme();
  const { t, language, isRtl } = useI18n();
  const family = useArchive((state) => state.family);
  const setOccasions = useArchive((state) => state.setOccasions);

  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(family?.occasionKeys ?? []);
  }, [family?.occasionKeys]);

  const toggle = async (key: string, enabled: boolean) => {
    const next = enabled ? [...new Set([...selected, key])] : selected.filter((item) => item !== key);
    setSelected(next);
    try {
      await setOccasions(next);
    } catch (saveError) {
      setError(friendlyMessage(saveError, t.errors));
      setSelected(family?.occasionKeys ?? []);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t.settings.occasions} subtitle={t.settings.occasionsHint} />

      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.xl }}>
        {error ? <Banner tone="danger" body={error} /> : null}

        <Card padded={false}>
          {occasionCatalogue.map((occasion, index) => (
            <View key={occasion.key}>
              {index > 0 ? (
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginStart: theme.spacing.lg }} />
              ) : null}
              <Row
                label={language === 'ar' ? occasion.labelAr : occasion.labelEn}
                icon="calendar-outline"
                right={
                  <Toggle
                    accessibilityLabel={language === 'ar' ? occasion.labelAr : occasion.labelEn}
                    value={selected.includes(occasion.key)}
                    onValueChange={(value) => toggle(occasion.key, value)}
                  />
                }
              />
            </View>
          ))}
        </Card>

        <View
          style={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.backgroundAlt,
          }}
        >
          <Ionicons name="notifications-outline" size={18} color={theme.colors.textMuted} />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="bodyStrong">{t.future.remindersTitle}</Text>
            <Text variant="caption" color="textMuted">
              {t.future.remindersBody} · {t.common.comingSoon}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}
