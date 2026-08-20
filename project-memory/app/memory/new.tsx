import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { memoryKindPresentation, todayIso, type MemoryKind } from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { log } from '@/lib/log';
import {
  assessCollection,
  readinessAnalyzer,
  viewRoles,
  type AnalysedPhoto,
  type ViewRole,
} from '@/services/readiness';
import { maxPhotosPerMemory, pickPhotos, type PickedPhoto } from '@/services/photos/picker';
import { useArchive } from '@/state/archive';
import { ReadinessPanel, roleLabel } from '@/features/readiness/ReadinessPanel';
import { PhotoTray } from '@/features/memory/PhotoTray';
import { Banner, Button, Card, Chip, DateField, Field, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Creating a memory.
 *
 * Two steps: what kind of moment this was, then the moment itself. The kind
 * comes first because it pre-fills the title, and a parent should never be
 * handed an empty form and a blinking cursor.
 */
export default function NewMemory() {
  const theme = useTheme();
  const router = useRouter();
  const { t, language, isRtl } = useI18n();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const addMemory = useArchive((state) => state.addMemory);

  const [kind, setKind] = useState<MemoryKind | null>(null);
  const [title, setTitle] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [futureMessage, setFutureMessage] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [analysed, setAnalysed] = useState<Record<string, AnalysedPhoto>>({});
  const [roles, setRoles] = useState<Record<string, ViewRole>>({});
  const [analysing, setAnalysing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const analyzer = useMemo(() => readinessAnalyzer(), []);

  /**
   * Photos are analysed as they arrive, so feedback is already on screen by the
   * time the parent looks for it. Analysis decodes real pixels, so it is done
   * once per photo and cached by URI rather than repeated on every render.
   */
  useEffect(() => {
    const pending = photos.filter((photo) => !analysed[photo.uri]);
    if (pending.length === 0) return;

    let cancelled = false;
    setAnalysing(true);
    Promise.all(
      pending.map(async (photo) => {
        try {
          return await analyzer.analyze(photo.uri, photo.uri, roles[photo.uri] ?? 'unspecified');
        } catch (analysisError) {
          // A photo we cannot decode must not block the memory. It is simply
          // left unassessed rather than reported as bad.
          log.warn('could not analyse photo', { error: String(analysisError) });
          return null;
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setAnalysed((current) => {
          const next = { ...current };
          results.forEach((result, index) => {
            if (result) next[pending[index].uri] = result;
          });
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setAnalysing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [photos, analysed, roles, analyzer]);

  /** Re-assessed whenever a photo or a declared role changes. */
  const readiness = useMemo(() => {
    const list = photos
      .map((photo) => analysed[photo.uri])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ ...item, role: roles[item.photoId] ?? item.role }));
    if (list.length === 0) return null;
    return assessCollection(list, analyzer.capabilities, analyzer.id, analyzer.version);
  }, [photos, analysed, roles, analyzer]);

  const choosePhotos = async () => {
    try {
      const picked = await pickPhotos(maxPhotosPerMemory - photos.length);
      if (picked.length > 0) {
        setPhotos((current) => [...current, ...picked].slice(0, maxPhotosPerMemory));
      }
    } catch (error) {
      setFormError(friendlyMessage(error, t.errors));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
    setSelectedPhoto((current) => Math.max(0, Math.min(current, photos.length - 2)));
  };

  const selectKind = (next: MemoryKind) => {
    setKind(next);
    const presentation = memoryKindPresentation.find((item) => item.kind === next);
    if (presentation && title.trim().length === 0) {
      setTitle(language === 'ar' ? presentation.suggestionAr : presentation.suggestionEn);
    }
  };

  const save = async () => {
    setFormError(null);
    if (title.trim().length === 0) {
      setErrors({ title: t.errors.titleRequired });
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      const memory = await addMemory({
        childId: childId!,
        kind: kind ?? 'custom',
        title,
        occurredOn: occurredOn || todayIso(),
        note,
        futureMessage,
        // The report travels with the photo so the backend can key it to the
        // asset id the file actually gets.
        photos: photos.map((photo) => ({
          uri: photo.uri,
          role: roles[photo.uri] ?? 'unspecified',
          signals: analysed[photo.uri]?.signals ?? null,
        })),
      });
      router.replace(`/memory/${memory.id}`);
    } catch (error) {
      setFormError(friendlyMessage(error, t.errors));
      setSaving(false);
    }
  };

  if (!childId) {
    return (
      <Screen>
        <ScreenHeader title={t.errors.notFound} />
      </Screen>
    );
  }

  /* ------------------------------------------------------- step 1: kind */

  if (!kind) {
    return (
      <Screen>
        <ScreenHeader title={t.memory.newTitle} subtitle={t.memory.kindQuestion} />

        <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xl }}>
          {memoryKindPresentation.map((presentation) => (
            <Pressable
              key={presentation.kind}
              accessibilityRole="button"
              accessibilityLabel={language === 'ar' ? presentation.labelAr : presentation.labelEn}
              onPress={() => selectKind(presentation.kind)}
              style={({ pressed }) => ({
                flexDirection: isRtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.lg,
                padding: theme.spacing.lg,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.backgroundAlt : theme.colors.surface,
                minHeight: theme.minTouchTarget + 16,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Ionicons name={presentation.icon} size={20} color={theme.colors.primary} />
              </View>
              <Text variant="subheading" style={{ flex: 1 }}>
                {language === 'ar' ? presentation.labelAr : presentation.labelEn}
              </Text>
              <Ionicons
                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={theme.colors.textFaint}
              />
            </Pressable>
          ))}
        </View>
      </Screen>
    );
  }

  /* ---------------------------------------------------- step 2: details */

  const selected = photos[selectedPhoto];

  return (
    <Screen
      footer={<Button label={t.memory.saveMemory} onPress={save} loading={saving} emphasise />}
    >
      <ScreenHeader title={t.memory.detailsTitle} onBack={() => setKind(null)} />

      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
        {formError ? <Banner tone="danger" body={formError} /> : null}

        <Field
          label={t.memory.titleLabel}
          value={title}
          onChangeText={setTitle}
          placeholder={t.memory.titlePlaceholder}
          error={errors.title}
          maxLength={120}
          testID="memory-title"
        />

        <DateField label={t.memory.dateLabel} value={occurredOn} onChange={setOccurredOn} />

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="label" color="textMuted">
              {t.memory.photosLabel}
            </Text>
            <Text variant="caption" color="textFaint">
              {t.memory.photosHint}
            </Text>
          </View>

          <PhotoTray
            photos={photos}
            selectedIndex={selectedPhoto}
            onSelect={setSelectedPhoto}
            onRemove={removePhoto}
            onAdd={choosePhotos}
            limit={maxPhotosPerMemory}
          />

          {photos.length > 0 ? (
            <View style={{ gap: theme.spacing.md }}>
              {/* The role is asked for, not guessed: the analyser cannot
                  classify a viewing angle and does not pretend to. */}
              <Text variant="label" color="textMuted">
                {t.readiness.rolePrompt}
              </Text>
              <View
                style={{
                  flexDirection: isRtl ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.sm,
                }}
              >
                {viewRoles.map((role) => {
                  const active = (roles[selected?.uri ?? ''] ?? 'unspecified') === role;
                  return (
                    <Chip
                      key={role}
                      label={roleLabel(role, t)}
                      selected={active}
                      tone={active ? 'primary' : 'neutral'}
                      onPress={() => {
                        if (!selected) return;
                        setRoles((current) => ({ ...current, [selected.uri]: role }));
                      }}
                    />
                  );
                })}
              </View>

              <ReadinessPanel
                readiness={readiness}
                analysing={analysing && !readiness}
                selectedPhotoId={selected?.uri ?? null}
              />
            </View>
          ) : null}
        </View>

        <Field
          label={t.memory.noteLabel}
          value={note}
          onChangeText={setNote}
          placeholder={t.memory.notePlaceholder}
          multiline
          maxLength={2000}
          optional
        />

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Field
              label={t.memory.futureMessageLabel}
              value={futureMessage}
              onChangeText={setFutureMessage}
              placeholder={t.memory.futureMessagePlaceholder}
              hint={t.memory.futureMessageHint}
              multiline
              maxLength={2000}
              optional
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
