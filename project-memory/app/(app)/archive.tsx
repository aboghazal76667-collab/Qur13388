import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { useArchive } from '@/state/archive';
import { Timeline } from '@/features/child/Timeline';
import { useMemoryCovers } from '@/features/child/useChildScreen';
import { Card, Chip, EmptyState, Text } from '@/ui';

/**
 * The whole archive, across every child.
 *
 * This is the view that makes the product feel like an archive rather than a
 * photo folder: one continuous history a family can scroll back through, with
 * a filter for reading one child's story on its own.
 */
export default function Archive() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRtl } = useI18n();
  const { children, memoriesByChild, load } = useArchive();
  const [childFilter, setChildFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const memories = useMemo(() => {
    const all = Object.entries(memoriesByChild)
      .filter(([childId]) => !childFilter || childId === childFilter)
      .flatMap(([, items]) => items);
    return all.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  }, [memoriesByChild, childFilter]);

  const covers = useMemoryCovers(memories);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
        <Text variant="title" accessibilityRole="header">
          {t.memory.archiveTitle}
        </Text>
        <Text variant="body" color="textMuted">
          {t.memory.archiveSubtitle}
        </Text>
      </View>

      {children.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <Chip
            label={t.family.title}
            selected={childFilter === null}
            tone={childFilter === null ? 'primary' : 'neutral'}
            onPress={() => setChildFilter(null)}
          />
          {children.map((child) => (
            <Chip
              key={child.id}
              label={child.firstName}
              selected={childFilter === child.id}
              tone={childFilter === child.id ? 'primary' : 'neutral'}
              onPress={() => setChildFilter(child.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {memories.length === 0 ? (
        <Card>
          <EmptyState icon="albums-outline" title={t.memory.archiveEmpty} />
        </Card>
      ) : (
        <Timeline
          memories={memories}
          coversByMemoryId={covers}
          onSelect={(memory) => router.push(`/memory/${memory.id}`)}
        />
      )}
    </ScrollView>
  );
}
