import React from 'react';
import { Image, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  /** Ring colour for milestone highlights. */
  ring?: boolean;
}

/** Deterministic warm tint per child, so each profile feels personal. */
function tintFor(name: string): { bg: string; fg: string } {
  const tints = [
    { bg: '#F0E2DA', fg: '#8A4E38' },
    { bg: '#E5EAE2', fg: '#4C6A50' },
    { bg: '#EFE6D2', fg: '#846327' },
    { bg: '#E6E3EE', fg: '#544C77' },
    { bg: '#F1E1E4', fg: '#8B4A57' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return tints[hash % tints.length];
}

export function Avatar({ name, uri, size = 64, ring = false }: AvatarProps) {
  const theme = useTheme();
  const tint = tintFor(name || '?');
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <View
      accessible
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: uri ? theme.colors.placeholder : tint.bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? 2 : 1,
        borderColor: ring ? theme.colors.accent : theme.colors.border,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text
          variant="title"
          autoAlign={false}
          align="center"
          style={{ color: tint.fg, fontSize: size * 0.4, lineHeight: size * 0.5 }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
