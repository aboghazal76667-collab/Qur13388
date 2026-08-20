import React, { useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
  optional?: boolean;
  testID?: string;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  multiline = false,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = 'sentences',
  autoComplete,
  maxLength,
  optional = false,
  testID,
}: FieldProps) {
  const theme = useTheme();
  const { t, isRtl, direction } = useI18n();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: theme.spacing.sm, alignItems: 'baseline' }}>
        <Text variant="label" color="textMuted">
          {label}
        </Text>
        {optional ? (
          <Text variant="micro" color="textFaint">
            {t.common.optional}
          </Text>
        ) : null}
      </View>

      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={!secureTextEntry}
        maxLength={maxLength}
        style={[
          theme.typography.body,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            minHeight: multiline ? 120 : theme.minTouchTarget + 6,
            textAlign: isRtl ? 'right' : 'left',
            writingDirection: direction,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
