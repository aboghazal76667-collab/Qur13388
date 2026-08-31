import React from 'react';
import { Pressable, View, Text } from 'react-native';

import { theme } from '@dd/theme/tokens';
import { readableInk, mix, withAlpha } from '@dd/engine/color';
import { useI18n } from '@dd/i18n';
import { T } from './index';

/**
 * A colour swatch. Metallic threads get a diagonal sheen band so gold and
 * silver do not read as flat mustard and grey — the difference matters when
 * a customer is picking a thread he will see on cloth.
 */
export const Swatch: React.FC<{
  hex: string;
  label?: string;
  selected?: boolean;
  onPress?: () => void;
  size?: number;
  metallic?: boolean;
  disabled?: boolean;
}> = ({ hex, label, selected, onPress, size = 52, metallic, disabled }) => {
  const { dir } = useI18n();
  const ink = readableInk(hex);

  const body = (
    <View style={{ alignItems: 'center', gap: 6, width: size + 14, opacity: disabled ? 0.35 : 1 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.md,
          backgroundColor: hex,
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? theme.color.accent : theme.color.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {metallic ? (
          <View
            style={{
              position: 'absolute',
              width: size * 1.6,
              height: size * 0.34,
              backgroundColor: withAlpha(mix(hex, '#FFFFFF', 0.75), 0.65),
              transform: [{ rotate: '-38deg' }],
            }}
          />
        ) : null}
        {selected ? (
          <Text style={{ color: ink, fontSize: 16, fontWeight: '700' }}>✓</Text>
        ) : null}
      </View>
      {label ? (
        <Text
          numberOfLines={1}
          style={{
            fontSize: theme.font.tiny,
            color: selected ? theme.color.text : theme.color.textMuted,
            fontWeight: selected ? '700' : '500',
            writingDirection: dir,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress || disabled) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? hex}
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
};

/** Compact palette strip used on suggestion and design cards. */
export const PaletteStrip: React.FC<{
  hexes: string[];
  size?: number;
  label?: string;
}> = ({ hexes, size = 22, label }) => {
  const { dir } = useI18n();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', gap: 5 }}>
        {hexes.map((hex, i) => (
          <View
            key={`${hex}-${i}`}
            style={{
              width: size,
              height: size,
              borderRadius: size / 3,
              backgroundColor: hex,
              borderWidth: 1,
              borderColor: theme.color.border,
            }}
          />
        ))}
      </View>
      {label ? (
        <T variant="tiny" color={theme.color.textFaint}>
          {label}
        </T>
      ) : null}
    </View>
  );
};
