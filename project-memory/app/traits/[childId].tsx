import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { getBackend } from '@/data';
import {
  pastTraits,
  traitCategories,
  traitCategoryFor,
  traitValueKey,
  type ChildTrait,
  type TraitCategory,
} from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { Banner, Button, Card, Chip, Field, Screen, ScreenHeader, Text } from '@/ui';

/**
 * The identity editor.
 *
 * Designed against three failure modes.
 *
 * It must not become a questionnaire, so categories stay collapsed until
 * opened, nothing is required, and leaving at any point keeps what was entered.
 *
 * It must not be a set of dropdowns, so every category takes free text.
 * Suggestions save typing; they never limit the answer, and the Arabic
 * suggestions are written in Arabic rather than transliterated.
 *
 * And it must not overwrite history. Removing something a child has grown out
 * of *retires* it — the period closes and stays in the archive. That is the
 * whole reason this is a screen rather than a form with a save button.
 */
export default function ChildTraits() {
  const theme = useTheme();
  const { t, format, language, isRtl, formatNumber } = useI18n();
  const { childId } = useLocalSearchParams<{ childId: string }>();

  const [childName, setChildName] = useState('');
  const [traits, setTraits] = useState<ChildTrait[]>([]);
  const [openCategory, setOpenCategory] = useState<TraitCategory | null>(null);
  const [draft, setDraft] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!childId) return;
    try {
      const backend = getBackend();
      const [child, list] = await Promise.all([
        backend.children.get(childId),
        backend.traits.listForChild(childId),
      ]);
      setChildName(child?.firstName ?? '');
      setTraits(list);
    } catch (loadError) {
      setError(friendlyMessage(loadError, t.errors));
    }
  }, [childId, t.errors]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const current = useMemo(() => traits.filter((trait) => trait.isCurrent), [traits]);
  const past = useMemo(() => pastTraits(traits), [traits]);

  const valuesIn = (category: TraitCategory) =>
    current.filter((trait) => trait.category === category);

  const add = async (category: TraitCategory, value: string) => {
    const trimmed = value.trim();
    if (!childId || trimmed.length === 0) return;

    // Already recorded and still current — nothing to do, and quietly clearing
    // the field is friendlier than an error about duplicates.
    const key = traitValueKey(trimmed);
    if (valuesIn(category).some((trait) => trait.valueKey === key)) {
      setDraft('');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await getBackend().traits.record({
        childId,
        category,
        value: trimmed,
        customLabel: category === 'custom' ? customLabel : null,
      });
      setDraft('');
      if (category === 'custom') setCustomLabel('');
      await load();
    } catch (addError) {
      setError(friendlyMessage(addError, t.errors));
    } finally {
      setBusy(false);
    }
  };

  const retire = async (trait: ChildTrait) => {
    setBusy(true);
    try {
      // Closes the period rather than deleting it: the archive keeps what she
      // loved before.
      await getBackend().traits.retire(trait.id);
      await load();
    } catch (retireError) {
      setError(friendlyMessage(retireError, t.errors));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (trait: ChildTrait) => {
    setBusy(true);
    try {
      await getBackend().traits.restore(trait.id);
      await load();
    } catch (restoreError) {
      setError(friendlyMessage(restoreError, t.errors));
    } finally {
      setBusy(false);
    }
  };

  if (!childId) return null;

  return (
    <Screen>
      <ScreenHeader
        title={format(t.traits.editTitle, { name: childName })}
        subtitle={format(t.traits.introBody, { name: childName })}
      />

      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
        {error ? <Banner tone="danger" body={error} /> : null}

        {traitCategories.map((presentation) => {
          const values = valuesIn(presentation.category);
          const isOpen = openCategory === presentation.category;
          const suggestions =
            language === 'ar' ? presentation.suggestionsAr : presentation.suggestionsEn;
          const label = language === 'ar' ? presentation.labelAr : presentation.labelEn;

          return (
            <Card key={presentation.category} padded={false}>
              <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => {
                    setOpenCategory(isOpen ? null : presentation.category);
                    setDraft('');
                  }}
                  style={{
                    flexDirection: isRtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    minHeight: theme.minTouchTarget,
                  }}
                >
                  <Text variant="subheading" autoAlign={false}>
                    {presentation.glyph}
                  </Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{label}</Text>
                    {values.length > 0 ? (
                      <Text variant="caption" color="textMuted">
                        {values.map((trait) => trait.value).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textFaint}
                  />
                </Pressable>

                {isOpen ? (
                  <View style={{ gap: theme.spacing.md }}>
                    {values.length > 0 ? (
                      <View
                        style={{
                          flexDirection: isRtl ? 'row-reverse' : 'row',
                          flexWrap: 'wrap',
                          gap: theme.spacing.sm,
                        }}
                      >
                        {values.map((trait) => (
                          <Chip
                            key={trait.id}
                            label={`${trait.value}  ×`}
                            tone="primary"
                            selected
                            onPress={() => retire(trait)}
                          />
                        ))}
                      </View>
                    ) : null}

                    {suggestions.length > 0 ? (
                      <View style={{ gap: theme.spacing.sm }}>
                        <Text variant="micro" color="textFaint">
                          {t.traits.suggestions.toUpperCase()}
                        </Text>
                        <View
                          style={{
                            flexDirection: isRtl ? 'row-reverse' : 'row',
                            flexWrap: 'wrap',
                            gap: theme.spacing.sm,
                          }}
                        >
                          {suggestions
                            .filter(
                              (suggestion) =>
                                !values.some(
                                  (trait) => trait.valueKey === traitValueKey(suggestion),
                                ),
                            )
                            .map((suggestion) => (
                              <Chip
                                key={suggestion}
                                label={suggestion}
                                onPress={() => add(presentation.category, suggestion)}
                              />
                            ))}
                        </View>
                      </View>
                    ) : null}

                    {presentation.category === 'custom' ? (
                      <Field
                        label={t.traits.customLabel}
                        value={customLabel}
                        onChangeText={setCustomLabel}
                        hint={t.traits.customLabelHint}
                        maxLength={60}
                      />
                    ) : null}

                    <View style={{ gap: theme.spacing.sm }}>
                      <Field
                        label={t.traits.addYourOwn}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={label}
                        maxLength={120}
                        testID={`trait-input-${presentation.category}`}
                      />
                      <Button
                        label={t.traits.addValue}
                        size="small"
                        fullWidth={false}
                        disabled={draft.trim().length === 0 || busy}
                        onPress={() => add(presentation.category, draft)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            </Card>
          );
        })}

        {/* What the child has moved on from — the reason this screen retires
            rather than deletes. */}
        {past.length > 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="label" color="textFaint">
              {t.traits.usedToLove.toUpperCase()}
            </Text>
            <Card>
              <View style={{ gap: theme.spacing.md }}>
                {past.map((trait) => {
                  const presentation = traitCategoryFor(trait.category);
                  const years =
                    trait.ageMonthsAtRecord === null
                      ? null
                      : Math.floor(trait.ageMonthsAtRecord / 12);
                  return (
                    <View
                      key={trait.id}
                      style={{
                        flexDirection: isRtl ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                      }}
                    >
                      <Text variant="caption" autoAlign={false}>
                        {presentation.glyph}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" color="textMuted">
                          {trait.value}
                        </Text>
                        {years !== null ? (
                          <Text variant="micro" color="textFaint">
                            {format(t.child.ageYears, { count: formatNumber(years) })}
                          </Text>
                        ) : null}
                      </View>
                      <Chip label={t.traits.bringBack} onPress={() => restore(trait)} />
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        ) : null}

        <Banner tone="info" body={t.traits.personalisationNote} />
      </View>
    </Screen>
  );
}
