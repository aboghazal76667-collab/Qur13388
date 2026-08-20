import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';
import type { PickedPhoto } from '@/services/photos/picker';

/**
 * The strip of photos on a memory.
 *
 * Multi-photo from the start, because multi-view reconstruction is where the
 * 3D feature is going: a front shot, a full body and a three-quarter angle
 * give a far better figurine than one photo ever will. The tray shows which
 * photo is currently being scored.
 */
export function PhotoTray({
  photos,
  selectedIndex,
  onSelect,
  onRemove,
  onAdd,
  limit,
}: {
  photos: PickedPhoto[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  limit: number;
}) {
  const theme = useTheme();
  const { t, isRtl } = useI18n();
  const canAdd = photos.length < limit;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: isRtl ? 'row-reverse' : 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      {photos.map((photo, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={`${photo.uri}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${t.memory.photosLabel} ${index + 1}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(index)}
            style={{
              width: 96,
              height: 120,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              backgroundColor: theme.colors.placeholder,
            }}
          >
            <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.common.remove}
              onPress={() => onRemove(index)}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: theme.colors.scrim,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={15} color="#FFFFFF" />
            </Pressable>
          </Pressable>
        );
      })}

      {canAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.memory.addPhoto}
          onPress={onAdd}
          style={({ pressed }) => ({
            width: 96,
            height: 120,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
            backgroundColor: pressed ? theme.colors.backgroundAlt : 'transparent',
          })}
        >
          <Ionicons name="images-outline" size={22} color={theme.colors.textMuted} />
          <Text variant="micro" color="textMuted" autoAlign={false} align="center">
            {t.memory.addPhoto}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
