import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { parseIsoDate, todayIso, type Child } from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { pickAvatar } from '@/services/photos/picker';
import { useArchive } from '@/state/archive';
import { Avatar, Banner, Button, DateField, Field, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Add a child.
 *
 * Four fields, three of them optional. We ask for a first name and a birthday
 * because the product cannot build a timeline without them, and we ask for
 * nothing else — no surname, no address, no school. That restraint is a
 * product decision, not an oversight.
 */
export default function NewChild() {
  const theme = useTheme();
  const router = useRouter();
  const { t, format } = useI18n();
  const addChild = useArchive((state) => state.addChild);

  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Child | null>(null);

  const choosePhoto = async () => {
    try {
      const picked = await pickAvatar();
      if (picked) setAvatarUri(picked.uri);
    } catch (error) {
      setFormError(friendlyMessage(error, t.errors));
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    if (firstName.trim().length === 0) next.firstName = t.errors.nameRequired;
    if (!dateOfBirth) next.dateOfBirth = t.errors.dobRequired;
    else {
      const parsed = parseIsoDate(dateOfBirth);
      if (!parsed) next.dateOfBirth = t.errors.dobRequired;
      else if (dateOfBirth > todayIso()) next.dateOfBirth = t.errors.dobFuture;
    }
    setErrors(next);
    return Object.values(next).every((value) => !value);
  };

  const save = async () => {
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const child = await addChild({
        firstName,
        nickname: nickname.trim() || null,
        dateOfBirth,
        avatarUri,
      });
      // The invitation to describe the child comes *after* creation, never
      // before it: a parent must be able to add a child in under a minute, and
      // a questionnaire in front of that would cost us the child entirely.
      setCreated(child);
    } catch (error) {
      setFormError(friendlyMessage(error, t.errors));
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Screen
        footer={
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label={format(t.traits.introStart, { name: created.firstName })}
              onPress={() => router.replace(`/traits/${created.id}`)}
              emphasise
            />
            <Button
              label={t.traits.addLater}
              variant="ghost"
              size="medium"
              onPress={() => router.replace(`/child/${created.id}`)}
            />
          </View>
        }
      >
        <ScreenHeader showBack={false} />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: theme.spacing.xl,
            paddingVertical: theme.spacing.xxxl,
          }}
        >
          <Avatar name={created.firstName} uri={avatarUri} size={96} />
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="title" align="center" autoAlign={false} accessibilityRole="header">
              {format(t.traits.introTitle, { name: created.firstName })}
            </Text>
            <Text variant="body" color="textMuted" align="center" autoAlign={false}>
              {format(t.traits.introBody, { name: created.firstName })}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={<Button label={t.child.create} onPress={save} loading={saving} emphasise />}
    >
      <ScreenHeader title={t.child.newTitle} subtitle={t.child.newSubtitle} />

      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
        {formError ? <Banner tone="danger" body={formError} /> : null}

        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={avatarUri ? t.child.changePhoto : t.child.choosePhoto}
            onPress={choosePhoto}
            style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
          >
            <View>
              <Avatar name={firstName || '·'} uri={avatarUri} size={112} />
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: theme.colors.background,
                }}
              >
                <Ionicons name="camera-outline" size={18} color={theme.colors.onPrimary} />
              </View>
            </View>
          </Pressable>
          <Text variant="caption" color="textFaint">
            {avatarUri ? t.child.changePhoto : `${t.child.choosePhoto} · ${t.common.optional}`}
          </Text>
        </View>

        <Field
          label={t.child.firstName}
          value={firstName}
          onChangeText={setFirstName}
          error={errors.firstName}
          autoCapitalize="words"
          maxLength={40}
          testID="child-first-name"
        />

        <Field
          label={t.child.nickname}
          value={nickname}
          onChangeText={setNickname}
          autoCapitalize="words"
          maxLength={40}
          optional
        />

        <DateField
          label={t.child.dateOfBirth}
          value={dateOfBirth}
          onChange={setDateOfBirth}
          error={errors.dateOfBirth}
        />

        <Banner tone="info" body={t.child.privacyNote} />
      </View>
    </Screen>
  );
}
