import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Asset, LikenessAspect, LikenessVerdict } from '@/domain';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { AssetImage } from '@/components/AssetImage';
import { Button, Card, Chip, Field, Text } from '@/ui';

/**
 * "Does this look like your child?"
 *
 * The parent is the only person who can answer that, and until now the answer
 * was lost the moment they closed the screen. It is asked beside the source
 * photographs, because judging a likeness from memory is a different and worse
 * question than judging it against the picture it came from.
 *
 * Kept coarse deliberately: a five-star scale invites precision nobody has,
 * whereas "the face needs work" is easy to give and directly actionable.
 */
export function LikenessReview({
  sourcePhotos,
  submitted,
  onSubmit,
}: {
  sourcePhotos: Asset[];
  submitted: boolean;
  onSubmit: (verdict: LikenessVerdict, aspects: LikenessAspect[], note: string) => Promise<void>;
}) {
  const theme = useTheme();
  const { t, isRtl } = useI18n();

  const [verdict, setVerdict] = useState<LikenessVerdict | null>(null);
  const [aspects, setAspects] = useState<LikenessAspect[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (submitted) {
    return (
      <Card>
        <View
          style={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <Ionicons name="heart-outline" size={20} color={theme.colors.success} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" color="success">
              {t.likeness.thanks}
            </Text>
            <Text variant="caption" color="textMuted">
              {t.likeness.thanksBody}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const aspectOptions: { key: LikenessAspect; label: string }[] = [
    { key: 'face', label: t.likeness.aspectFace },
    { key: 'body', label: t.likeness.aspectBody },
    { key: 'clothes', label: t.likeness.aspectClothes },
    { key: 'overall', label: t.likeness.aspectOverall },
  ];

  const toggleAspect = (key: LikenessAspect) => {
    setAspects((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const send = async (chosen: LikenessVerdict) => {
    setBusy(true);
    try {
      await onSubmit(chosen, chosen === 'good' ? [] : aspects, note);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="subheading">{t.likeness.question}</Text>
          <Text variant="caption" color="textMuted">
            {t.likeness.subtitle}
          </Text>
        </View>

        {/* The comparison. Judging a likeness from memory is a worse question
            than judging it against the photograph it came from. */}
        {sourcePhotos.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="micro" color="textFaint">
              {t.likeness.comparePhotos.toUpperCase()}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: isRtl ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {sourcePhotos.map((photo) => (
                <AssetImage
                  key={photo.id}
                  asset={photo}
                  style={{ width: 76, height: 94, borderRadius: theme.radius.md }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {verdict !== 'needs_work' ? (
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                label={t.likeness.looksGreat}
                size="medium"
                onPress={() => send('good')}
                loading={busy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t.likeness.needsWork}
                variant="secondary"
                size="medium"
                onPress={() => setVerdict('needs_work')}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="label" color="textMuted">
              {t.likeness.whatNeedsWork}
            </Text>
            <View
              style={{
                flexDirection: isRtl ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
              }}
            >
              {aspectOptions.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={aspects.includes(option.key)}
                  tone={aspects.includes(option.key) ? 'primary' : 'neutral'}
                  onPress={() => toggleAspect(option.key)}
                />
              ))}
            </View>

            <Field
              label={t.likeness.noteLabel}
              value={note}
              onChangeText={setNote}
              placeholder={t.likeness.notePlaceholder}
              multiline
              maxLength={500}
              optional
            />

            <Button label={t.likeness.submit} onPress={() => send('needs_work')} loading={busy} />
          </View>
        )}

        <Text variant="micro" color="textFaint">
          {t.likeness.why}
        </Text>
      </View>
    </Card>
  );
}
