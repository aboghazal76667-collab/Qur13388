import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme, type TypographyToken } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyToken;
  /** Palette key, or an explicit colour for photography overlays. */
  color?: 'text' | 'textMuted' | 'textFaint' | 'primary' | 'onPrimary' | 'danger' | 'success' | 'accent' | 'warning';
  align?: TextStyle['textAlign'];
  /** Centre-aligned copy shouldn't flip with direction; body copy should. */
  autoAlign?: boolean;
}

/**
 * Every piece of text in the app goes through here so that typography,
 * colour and writing direction stay consistent — and so Arabic gets correct
 * alignment without every screen remembering to ask.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  autoAlign = true,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const { isRtl, direction } = useI18n();

  const resolvedAlign: TextStyle['textAlign'] =
    align ?? (autoAlign ? (isRtl ? 'right' : 'left') : undefined);

  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[color], textAlign: resolvedAlign, writingDirection: direction },
        style,
      ]}
    />
  );
}
