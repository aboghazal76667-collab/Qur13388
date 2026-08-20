import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ageOn, nextBirthday, type Child } from '@/domain';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Avatar, Card, Text } from '@/ui';

import { describeAge, describeMemoryCount } from '@/features/child/age';

import { useAvatarUri } from './useAvatar';

/**
 * A child on the family dashboard.
 *
 * The card leads with the child, not with data: their name, their face, how
 * old they are, and what is coming up. The memory count is deliberately quiet —
 * this is not a scoreboard.
 */
export function ChildCard({
  child,
  memoryCount,
  onPress,
}: {
  child: Child;
  memoryCount: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t, format, formatDate, formatNumber, isRtl } = useI18n();
  const avatarUri = useAvatarUri(child.avatarAssetId);

  const age = ageOn(child.dateOfBirth);
  const birthday = nextBirthday(child.dateOfBirth);

  const ageLabel = describeAge(child.dateOfBirth, t, formatNumber);

  return (
    <Card onPress={onPress} accessibilityLabel={`${child.firstName}, ${ageLabel}`} padded={false}>
      <View
        style={{
          flexDirection: isRtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.lg,
          padding: theme.spacing.lg,
        }}
      >
        <Avatar name={child.firstName} uri={avatarUri} size={68} ring={birthday !== null && birthday.daysAway <= 14} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="heading">{child.nickname || child.firstName}</Text>
          <Text variant="caption" color="textMuted">
            {ageLabel} · {format(t.child.born, { date: formatDate(child.dateOfBirth, 'medium') })}
          </Text>
          <Text variant="caption" color="textFaint">
            {describeMemoryCount(memoryCount, t, formatNumber)}
          </Text>
        </View>

        <Ionicons
          name={isRtl ? 'chevron-back' : 'chevron-forward'}
          size={20}
          color={theme.colors.textFaint}
        />
      </View>

      {birthday && birthday.daysAway <= 30 ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            backgroundColor: theme.colors.accentSoft,
            flexDirection: isRtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <Ionicons name="gift-outline" size={16} color={theme.colors.accent} />
          <Text variant="label" color="accent">
            {formatDate(birthday.date, 'long')}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
