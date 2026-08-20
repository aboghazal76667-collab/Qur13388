import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { useArchive } from '@/state/archive';
import { useSession } from '@/state/session';
import { ChildCard } from '@/features/family/ChildCard';
import { Banner, Button, Card, EmptyState, Text } from '@/ui';

/**
 * The family dashboard — the first thing a parent sees after signing in.
 */
export default function FamilyDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const profile = useSession((state) => state.profile);
  const { family, children, memoriesByChild, error, load } = useArchive();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greeting = family?.name ?? profile?.displayName ?? t.family.title;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />
      }
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.xl,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xxxl,
        gap: theme.spacing.xl,
      }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="label" color="textFaint">
          {t.family.title.toUpperCase()}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {greeting}
        </Text>
        <Text variant="body" color="textMuted">
          {t.family.subtitle}
        </Text>
      </View>

      {error ? <Banner tone="danger" body={friendlyMessage(error, t.errors)} /> : null}

      {children.length === 0 ? (
        <Card padded>
          <EmptyState
            icon="heart-outline"
            title={t.family.emptyTitle}
            body={t.family.emptyBody}
            actionLabel={t.family.addChild}
            onAction={() => router.push('/child/new')}
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.lg }}>
          {children.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              memoryCount={(memoriesByChild[child.id] ?? []).length}
              onPress={() => router.push(`/child/${child.id}`)}
            />
          ))}

          <Button
            label={t.family.addChild}
            variant="secondary"
            icon={<Ionicons name="add" size={20} color={theme.colors.text} />}
            onPress={() => router.push('/child/new')}
          />
        </View>
      )}
    </ScrollView>
  );
}
