import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { nextBirthday, occasionLabel, type Child, type ChildTrait } from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { getBackend } from '@/data';
import { useArchive } from '@/state/archive';
import { describeAge, describeMemoryCount, describeTurning } from '@/features/child/age';
import { AboutChild } from '@/features/traits/AboutChild';
import { Timeline } from '@/features/child/Timeline';
import { useMemoryCovers } from '@/features/child/useChildScreen';
import { useAvatarUri } from '@/features/family/useAvatar';
import { Avatar, Banner, Button, Card, EmptyState, Row, RowGroup, Screen, ScreenHeader, Text } from '@/ui';

/**
 * A child's profile: who they are, and everything kept for them.
 */
export default function ChildProfile() {
  const theme = useTheme();
  const router = useRouter();
  const { t, format, formatDate, formatNumber, isRtl, language } = useI18n();
  const { childId } = useLocalSearchParams<{ childId: string }>();

  const family = useArchive((state) => state.family);
  const children = useArchive((state) => state.children);
  const memoriesByChild = useArchive((state) => state.memoriesByChild);
  const loadChild = useArchive((state) => state.loadChild);
  const removeChild = useArchive((state) => state.removeChild);

  const [child, setChild] = useState<Child | null>(null);
  const [traits, setTraits] = useState<ChildTrait[]>([]);
  const [error, setError] = useState<string | null>(null);

  const memories = memoriesByChild[childId ?? ''] ?? [];
  const covers = useMemoryCovers(memories);
  const avatarUri = useAvatarUri(child?.avatarAssetId ?? null);

  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      const cached = children.find((item) => item.id === childId);
      if (cached) setChild(cached);
      else {
        getBackend()
          .children.get(childId)
          .then(setChild)
          .catch((loadError) => setError(friendlyMessage(loadError, t.errors)));
      }
      loadChild(childId);
      // Identity is a small read and belongs with the profile, not behind a tap.
      getBackend()
        .traits.listForChild(childId)
        .then(setTraits)
        .catch(() => setTraits([]));
    }, [childId, children, loadChild, t.errors]),
  );

  if (!childId) return null;

  if (!child) {
    return (
      <Screen>
        <ScreenHeader />
        {error ? <Banner tone="danger" body={error} /> : <Text color="textMuted">{t.common.loading}</Text>}
      </Screen>
    );
  }

  const birthday = nextBirthday(child.dateOfBirth);
  const ageLabel = describeAge(child.dateOfBirth, t, formatNumber);

  const confirmDelete = () => {
    Alert.alert(
      t.child.deleteChild,
      format(t.child.deleteChildConfirm, { name: child.firstName }),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await removeChild(child.id);
              router.replace('/(app)/family');
            } catch (deleteError) {
              setError(friendlyMessage(deleteError, t.errors));
            }
          },
        },
      ],
    );
  };

  const upcoming = [
    ...(birthday
      ? [
          {
            key: 'birthday',
            label: occasionLabel('birthday', language),
            value: `${formatDate(birthday.date, 'long')} · ${describeTurning(
              birthday.turning,
              t,
              formatNumber,
            )}`,
            icon: 'gift-outline' as const,
          },
        ]
      : []),
    ...(family?.occasionKeys ?? [])
      .filter((key) => key !== 'birthday')
      .slice(0, 3)
      .map((key) => ({
        key,
        label: occasionLabel(key, language),
        value: t.settings.occasionsHint,
        icon: 'calendar-outline' as const,
      })),
  ];

  return (
    <Screen
      footer={
        <Button
          label={t.child.addMemory}
          onPress={() => router.push(`/memory/new?childId=${child.id}`)}
          icon={<Ionicons name="add" size={20} color={theme.colors.onPrimary} />}
          emphasise
        />
      }
    >
      <ScreenHeader showBack />

      {error ? <Banner tone="danger" body={error} /> : null}

      <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.lg }}>
        <Avatar name={child.firstName} uri={avatarUri} size={104} />
        <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
          <Text variant="title" align="center" autoAlign={false} accessibilityRole="header">
            {child.firstName}
          </Text>
          {child.nickname ? (
            <Text variant="caption" color="textFaint" align="center" autoAlign={false}>
              {child.nickname}
            </Text>
          ) : null}
          <Text variant="body" color="textMuted" align="center" autoAlign={false}>
            {ageLabel} · {format(t.child.born, { date: formatDate(child.dateOfBirth, 'long') })}
          </Text>
        </View>
      </View>

      <View style={{ paddingBottom: theme.spacing.xl }}>
        <AboutChild
          childName={child.firstName}
          traits={traits}
          onEdit={() => router.push(`/traits/${child.id}`)}
        />
      </View>

      {upcoming.length > 0 ? (
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}>
          <Text variant="label" color="textFaint">
            {t.child.upcoming.toUpperCase()}
          </Text>
          <Card padded={false}>
            {upcoming.map((item, index) => (
              <View key={item.key}>
                {index > 0 ? (
                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginStart: theme.spacing.lg }} />
                ) : null}
                <Row label={item.label} value={item.value} icon={item.icon} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text variant="heading">{t.child.timeline}</Text>
          <Text variant="caption" color="textFaint">
            {describeMemoryCount(memories.length, t, formatNumber)}
          </Text>
        </View>

        {memories.length === 0 ? (
          <Card>
            <EmptyState
              icon="book-outline"
              title={t.child.emptyTimelineTitle}
              body={t.child.emptyTimelineBody}
            />
          </Card>
        ) : (
          <Timeline
            memories={memories}
            coversByMemoryId={covers}
            onSelect={(memory) => router.push(`/memory/${memory.id}`)}
          />
        )}
      </View>

      <RowGroup>
        <Row label={t.child.deleteChild} icon="trash-outline" destructive onPress={confirmDelete} />
      </RowGroup>
    </Screen>
  );
}
