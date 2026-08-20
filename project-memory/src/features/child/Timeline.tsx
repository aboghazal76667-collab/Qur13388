import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { presentationFor, type Memory } from '@/domain';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { AssetImage } from '@/components/AssetImage';
import { Card, Text } from '@/ui';
import type { Asset } from '@/domain';

/**
 * A child's timeline.
 *
 * Memories are grouped by year, newest first, with a continuous rail down the
 * side. The rail is the point: it makes the archive look like something that
 * continues, rather than a list that happens to have three items in it today.
 */

export interface TimelineProps {
  memories: Memory[];
  coversByMemoryId: Record<string, Asset | null>;
  onSelect: (memory: Memory) => void;
}

interface YearGroup {
  year: number;
  memories: Memory[];
}

function groupByYear(memories: Memory[]): YearGroup[] {
  const buckets = new Map<number, Memory[]>();
  for (const memory of memories) {
    const year = Number(memory.occurredOn.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const existing = buckets.get(year);
    if (existing) existing.push(memory);
    else buckets.set(year, [memory]);
  }

  return [...buckets.entries()]
    .map(([year, items]) => ({
      year,
      memories: items.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    }))
    .sort((a, b) => b.year - a.year);
}

export function Timeline({ memories, coversByMemoryId, onSelect }: TimelineProps) {
  const theme = useTheme();
  const { language, isRtl, formatDate } = useI18n();
  const groups = useMemo(() => groupByYear(memories), [memories]);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {groups.map((group) => (
        <View key={group.year} style={{ gap: theme.spacing.md }}>
          <View
            style={{
              flexDirection: isRtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <Text variant="heading" color="primary" autoAlign={false}>
              {/* A year is a label, not a quantity — never "2,026". */}
              {String(group.year)}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
          </View>

          <View style={{ gap: theme.spacing.md }}>
            {group.memories.map((memory) => {
              const presentation = presentationFor(memory.kind);
              const cover = coversByMemoryId[memory.id] ?? null;

              return (
                <Card
                  key={memory.id}
                  padded={false}
                  onPress={() => onSelect(memory)}
                  accessibilityLabel={memory.title}
                >
                  <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                    {cover ? (
                      <AssetImage
                        asset={cover}
                        accessibilityLabel={memory.title}
                        style={{ width: 96, height: 104 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 96,
                          height: 104,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.colors.primarySoft,
                        }}
                      >
                        <Ionicons name={presentation.icon} size={26} color={theme.colors.primary} />
                      </View>
                    )}

                    <View
                      style={{
                        flex: 1,
                        padding: theme.spacing.lg,
                        gap: theme.spacing.xs,
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="label" color="textFaint">
                        {language === 'ar' ? presentation.labelAr : presentation.labelEn}
                      </Text>
                      <Text variant="subheading" numberOfLines={2}>
                        {memory.title}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {formatDate(memory.occurredOn, 'long')}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
