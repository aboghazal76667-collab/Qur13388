import React, { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getBackend } from '@/data';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { Banner, Button, Field, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Sign-in and sign-up share this form.
 *
 * Validation is done here and phrased for a person, not a parser. The social
 * buttons are present because Apple and Google sign-in are part of the plan,
 * and they say plainly that they are not connected yet rather than failing
 * silently when tapped.
 */
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const language = useSettings((state) => state.language);
  const signIn = useSession((state) => state.signIn);
  const signUp = useSession((state) => state.signUp);
  const busy = useSession((state) => state.busy);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState(false);

  const isSignUp = mode === 'sign-up';

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t.errors.invalidEmail;
    if (password.length < 8) next.password = t.errors.weakPassword;
    if (isSignUp && displayName.trim().length === 0) next.displayName = t.errors.nameRequired;
    setFieldErrors(next);
    return Object.values(next).every((value) => !value);
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;

    try {
      if (isSignUp) {
        await signUp({
          email,
          password,
          displayName,
          familyName: familyName.trim() || displayName.trim(),
          language,
        });
      } else {
        await signIn({ email, password });
      }
      router.replace('/(app)/family');
    } catch (error) {
      setFormError(friendlyMessage(error, t.errors));
    }
  };

  const social = (provider: 'apple' | 'google') => {
    if (!getBackend().auth.isSocialAvailable(provider)) {
      setSocialNotice(true);
      return;
    }
    // Reached only once credentials are configured.
    getBackend()
      .auth.signInWithProvider(provider)
      .then(() => router.replace('/(app)/family'))
      .catch((error) => setFormError(friendlyMessage(error, t.errors)));
  };

  return (
    <Screen
      footer={
        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={isSignUp ? t.auth.createAccount : t.auth.signIn}
            onPress={submit}
            loading={busy}
            emphasise
          />
          <Button
            label={isSignUp ? t.auth.hasAccount : t.auth.noAccount}
            variant="ghost"
            size="medium"
            onPress={() => router.replace(isSignUp ? '/(auth)/sign-in' : '/(auth)/sign-up')}
          />
        </View>
      }
    >
      <ScreenHeader
        showBack={false}
        title={isSignUp ? t.auth.signUpTitle : t.auth.signInTitle}
        subtitle={isSignUp ? t.auth.signUpSubtitle : t.auth.signInSubtitle}
      />

      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.xl }}>
        {formError ? <Banner tone="danger" title={t.errors.genericTitle} body={formError} /> : null}
        {socialNotice ? <Banner tone="info" body={t.auth.socialUnavailable} /> : null}

        {isSignUp ? (
          <>
            <Field
              label={t.auth.displayName}
              value={displayName}
              onChangeText={setDisplayName}
              error={fieldErrors.displayName}
              autoCapitalize="words"
              autoComplete="name"
              testID="auth-name"
            />
            <Field
              label={t.auth.familyName}
              value={familyName}
              onChangeText={setFamilyName}
              hint={t.auth.familyNameHint}
              autoCapitalize="words"
              optional
              testID="auth-family"
            />
          </>
        ) : null}

        <Field
          label={t.auth.email}
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="auth-email"
        />
        <Field
          label={t.auth.password}
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          hint={isSignUp ? t.auth.passwordHint : undefined}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          testID="auth-password"
        />

        <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
          <Button
            label={t.auth.continueWithApple}
            variant="secondary"
            size="medium"
            icon={<Ionicons name="logo-apple" size={18} color={theme.colors.text} />}
            onPress={() => social('apple')}
          />
          <Button
            label={t.auth.continueWithGoogle}
            variant="secondary"
            size="medium"
            icon={<Ionicons name="logo-google" size={16} color={theme.colors.text} />}
            onPress={() => social('google')}
          />
        </View>

        <Text variant="caption" color="textFaint">
          {t.auth.privacyNote}
        </Text>
      </View>
    </Screen>
  );
}
