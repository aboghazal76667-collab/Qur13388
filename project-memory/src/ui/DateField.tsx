import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Field } from './Field';
import { Text } from './Text';

/**
 * A three-part date entry.
 *
 * We deliberately avoid the native date picker: it needs a config-plugin build
 * on Android, and plain numeric entry behaves identically on both platforms in
 * Expo Go — which is where this gets tested first.
 *
 * The three parts are held locally rather than derived from `value`, because a
 * partially typed date has no ISO representation. Deriving them would mean the
 * first digit a parent types has nowhere to live, and the field could never be
 * completed.
 */
export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  error?: string | null;
  hint?: string;
}

interface Parts {
  day: string;
  month: string;
  year: string;
}

function partsFrom(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { day: '', month: '', year: '' };
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) };
}

function toIso({ day, month, year }: Parts): string {
  if (!day || !month || year.length !== 4) return '';
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  if (dayNumber < 1 || dayNumber > 31 || monthNumber < 1 || monthNumber > 12) return '';
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
}

const digitsOnly = (input: string, max: number) => input.replace(/\D/g, '').slice(0, max);

export function DateField({ label, value, onChange, error, hint }: DateFieldProps) {
  const theme = useTheme();
  const { isRtl, formatDate } = useI18n();
  const [parts, setParts] = useState<Parts>(() => partsFrom(value));

  // Re-sync when the value is changed from outside (a reset, or a loaded row).
  useEffect(() => {
    if (toIso(parts) === value) return;
    setParts(partsFrom(value));
    // `parts` is intentionally excluded: this effect exists to follow the
    // prop, and including it would fight the user's own typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (patch: Partial<Parts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(toIso(next));
  };

  const iso = toIso(parts);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>

      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field
            label="DD"
            value={parts.day}
            onChangeText={(next) => update({ day: digitsOnly(next, 2) })}
            keyboardType="number-pad"
            placeholder="12"
            maxLength={2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="MM"
            value={parts.month}
            onChangeText={(next) => update({ month: digitsOnly(next, 2) })}
            keyboardType="number-pad"
            placeholder="04"
            maxLength={2}
          />
        </View>
        <View style={{ flex: 1.4 }}>
          <Field
            label="YYYY"
            value={parts.year}
            onChangeText={(next) => update({ year: digitsOnly(next, 4) })}
            keyboardType="number-pad"
            placeholder="2021"
            maxLength={4}
          />
        </View>
      </View>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : iso ? (
        <Text variant="caption" color="textFaint">
          {formatDate(iso, 'long')}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
