import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View, type ImageResizeMode, type StyleProp, type ViewStyle } from 'react-native';

import { getBackend } from '@/data';
import { log } from '@/lib/log';
import { useTheme } from '@/theme';
import type { Asset } from '@/domain';

export interface AssetImageProps {
  asset: Asset | null | undefined;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
}

/**
 * Renders a stored asset.
 *
 * Screens never hold a URL. They hold an `Asset`, and this component asks the
 * backend to mint a viewer-scoped link at render time — which is what makes
 * expiring signed URLs practical rather than a source of broken images.
 */
export function AssetImage({ asset, style, resizeMode = 'cover', accessibilityLabel }: AssetImageProps) {
  const theme = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);

    if (!asset) return undefined;

    getBackend()
      .assets.resolveUrl(asset)
      .then((resolved) => {
        if (!cancelled) setUri(resolved);
      })
      .catch((error) => {
        log.warn('could not resolve asset url', { error: String(error), assetId: asset.id });
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [asset]);

  return (
    <View
      style={[
        { backgroundColor: theme.colors.placeholder, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        style,
      ]}
    >
      {uri && !failed ? (
        <Image
          accessibilityLabel={accessibilityLabel}
          source={{ uri }}
          resizeMode={resizeMode}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%' }}
        />
      ) : failed ? null : (
        <ActivityIndicator color={theme.colors.textFaint} />
      )}
    </View>
  );
}
