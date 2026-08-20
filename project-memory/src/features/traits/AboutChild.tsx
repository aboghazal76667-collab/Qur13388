import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { currentTraits, groupTraits, traitCategoryFor, type ChildTrait } from '@/domain';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Card, Text } from '@/ui';

/**
 * "About Ghazal" — the compact identity panel on the child profile.
 *
 * Two rules keep this from becoming a settings form. It shows only what the
 * parent has actually told us: no empty fields, no placeholder rows, nothing
 * for twenty categories nobody filled in. And it never shows an unconfirmed
 * suggestion as fact — `currentTraits` filters to parent-authored entries, so
 * anything the system merely proposed stays out of the child's portrait until
 * a human agrees with it.
 */
export function AboutChild({
  childName,
  traits,
  onEdit,
}: {
  childName: string;
  traits: ChildTrait[];
  onEdit: () => void;
}) {
  const theme = useTheme();
  const { t, format, language, isRtl } = useI18n();

  const current = currentTraits(traits);
  const groups = groupTraits(current);

  // Personality reads as a sentence rather than a row of chips — "Curious ·
  // Imaginative · Gentle" is how a parent would describe their child out loud.
  const personality = groups.find((group) => group.category === 'personality');
  const chipGroups = groups.filter((group) => group.category !== 'personality');

  if (current.length === 0) {
    return (
      <Card onPress={onEdit} accessibilityLabel={format(t.traits.introStart, { name: childName })}>
        <View
          style={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{format(t.traits.introTitle, { name: childName })}</Text>
            <Text variant="caption" color="textMuted">
              {format(t.traits.emptyBody, { name: childName })}
            </Text>
          </View>
          <Ionicons
            name={isRtl ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={theme.colors.textFaint}
          />
        </View>
      </Card>
    );
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRtl ? 'row-reverse' : 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="label" color="textFaint">
          {format(t.traits.aboutTitle, { name: childName }).toUpperCase()}
        </Text>
        <Text
          variant="label"
          color="primary"
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={format(t.traits.editTitle, { name: childName })}
        >
          {t.traits.edit}
        </Text>
      </View>

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <View
            style={{
              flexDirection: isRtl ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {chipGroups.flatMap((group) =>
              group.traits.map((trait) => {
                const presentation = traitCategoryFor(trait.category);
                return (
                  <View
                    key={trait.id}
                    accessible
                    accessibilityLabel={`${
                      language === 'ar' ? presentation.labelAr : presentation.labelEn
                    }: ${trait.value}`}
                    style={{
                      flexDirection: isRtl ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.xs,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.backgroundAlt,
                    }}
                  >
                    <Text variant="caption" autoAlign={false}>
                      {presentation.glyph}
                    </Text>
                    <Text variant="label" autoAlign={false}>
                      {trait.value}
                    </Text>
                  </View>
                );
              }),
            )}
          </View>

          {personality ? (
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="micro" color="textFaint">
                {(language === 'ar'
                  ? traitCategoryFor('personality').labelAr
                  : traitCategoryFor('personality').labelEn
                ).toUpperCase()}
              </Text>
              <Text variant="body" color="textMuted">
                {personality.traits.map((trait) => trait.value).join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </View>
  );
}
