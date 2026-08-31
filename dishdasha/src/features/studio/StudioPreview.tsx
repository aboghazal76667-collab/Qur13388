import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import type { ZoomTarget } from '@dd/components/dishdasha/geometry';
import { Row, T } from '@dd/components/ui';
import type { DesignConfig } from '@dd/domain/types';
import { useI18n } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';

const ZOOMS: { key: ZoomTarget; labelKey: 'studio.zoom.full' | 'studio.zoom.neck' | 'studio.zoom.chest' | 'studio.zoom.sleeve' | 'studio.zoom.furakha' }[] = [
  { key: 'full', labelKey: 'studio.zoom.full' },
  { key: 'neck', labelKey: 'studio.zoom.neck' },
  { key: 'chest', labelKey: 'studio.zoom.chest' },
  { key: 'sleeve', labelKey: 'studio.zoom.sleeve' },
  { key: 'furakha', labelKey: 'studio.zoom.furakha' },
];

/**
 * The persistent preview. It never unmounts while the customer moves between
 * steps, so the garment is always on screen and every change is visible the
 * instant it is made.
 */
export const StudioPreview: React.FC<{
  config: DesignConfig;
  zoom: ZoomTarget;
  onZoomChange: (zoom: ZoomTarget) => void;
  height?: number;
}> = ({ config, zoom, onZoomChange, height = 260 }) => {
  const { t } = useI18n();
  const isDetail = zoom !== 'full';

  return (
    <View style={{ backgroundColor: theme.color.bgSunken, gap: theme.space.sm, paddingBottom: theme.space.sm }}>
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <DishdashaFigure
          config={config}
          // Detail views are square-ish crops; the full figure keeps its ratio.
          width={isDetail ? height * 1.05 : height * 0.64}
          height={height}
          zoom={zoom}
          transparentBackground
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.space.lg, gap: theme.space.sm }}
      >
        <Row gap={theme.space.sm}>
          {ZOOMS.map((z) => {
            const selected = z.key === zoom;
            return (
              <Pressable
                key={z.key}
                onPress={() => onZoomChange(z.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  paddingHorizontal: theme.space.md,
                  paddingVertical: 7,
                  borderRadius: theme.radius.pill,
                  backgroundColor: selected ? theme.color.text : theme.color.surface,
                  borderWidth: 1,
                  borderColor: selected ? theme.color.text : theme.color.border,
                }}
              >
                <T variant="tiny" weight="600" color={selected ? theme.color.onDark : theme.color.textMuted}>
                  {t(z.labelKey)}
                </T>
              </Pressable>
            );
          })}
        </Row>
      </ScrollView>
    </View>
  );
};
