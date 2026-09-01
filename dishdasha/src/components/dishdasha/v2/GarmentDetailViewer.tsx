import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { buildFrame, measurementsFromProfile } from '@dd/visual/garmentGeometry';
import { getOmaniStyle } from '@dd/domain/omaniStyles';
import { CANVAS, type MmRegion } from '@dd/visual/units';
import { useI18n, type StringKey } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';
import { T } from '@dd/components/ui';
import { DishdashaVisualEngineV2 } from './DishdashaVisualEngineV2';

/**
 * GarmentDetailViewer.
 *
 * Crops millimetre space rather than magnifying a bitmap, so zooming in
 * reveals more geometry — individual stitches, the weave, the bound neckline
 * edge — instead of enlarging the same picture. Each target is a real region
 * in millimetres, computed from the same frame the full garment uses, so a
 * detail can never show something the garment does not have.
 */
export type DetailTarget = 'neckline' | 'shaq' | 'furakha' | 'cuff' | 'shoulder' | 'back';

const TARGETS: { key: DetailTarget; labelKey: StringKey; angle: number }[] = [
  { key: 'neckline', labelKey: 'detail.neckline', angle: 0 },
  { key: 'shaq', labelKey: 'detail.shaq', angle: 0 },
  { key: 'furakha', labelKey: 'detail.furakha', angle: 0 },
  { key: 'cuff', labelKey: 'detail.cuff', angle: 0 },
  { key: 'shoulder', labelKey: 'detail.shoulder', angle: 32 },
  { key: 'back', labelKey: 'detail.back', angle: 180 },
];

/** Regions in millimetres, derived from the live garment frame. */
export const regionFor = (
  target: DetailTarget,
  config: DesignConfig,
  measurement: MeasurementProfile | null,
): MmRegion => {
  const style = getOmaniStyle('om_standard');
  const frame = buildFrame(measurementsFromProfile(measurement), style);
  const cx = CANVAS.centreX;
  const furakhaKey = (config.componentOptions.furakha_length ?? 'furakha_medium').replace('furakha_', '');
  const cord =
    furakhaKey === 'none'
      ? 0
      : style.furakhaProfile.cordLengths[(furakhaKey as 'short' | 'medium' | 'long')] ?? 150;

  switch (target) {
    case 'neckline':
      return { x: cx - 150, y: frame.shoulder.y - 40, w: 300, h: 240 };
    case 'shaq':
      return { x: cx - 110, y: frame.shaq.top - 20, w: 220, h: frame.shaq.bottom - frame.shaq.top + 60 };
    case 'furakha':
      return { x: cx - 90, y: frame.shoulder.y + frame.neck.frontDrop - 20, w: 180, h: cord + 110 };
    case 'cuff':
      return { x: cx - 700, y: frame.sleeve.hemY - 130, w: 320, h: 240 };
    case 'shoulder':
      return { x: cx - 340, y: frame.shoulder.y - 50, w: 340, h: 300 };
    case 'back':
      return { x: cx - 220, y: frame.shoulder.y + 60, w: 440, h: 420 };
    default:
      return { x: 0, y: 0, w: CANVAS.width, h: CANVAS.height };
  }
};

export const GarmentDetailViewer: React.FC<{
  config: DesignConfig;
  measurement?: MeasurementProfile | null;
  width: number;
  height: number;
  target?: DetailTarget;
  onTargetChange?: (target: DetailTarget) => void;
}> = ({ config, measurement = null, width, height, target, onTargetChange }) => {
  const { t, dir } = useI18n();
  const [internal, setInternal] = useState<DetailTarget>('neckline');
  const active = target ?? internal;
  const entry = TARGETS.find((x) => x.key === active) ?? TARGETS[0];

  const region = useMemo(
    () => regionFor(active, config, measurement),
    [active, config, measurement],
  );

  const select = (next: DetailTarget) => {
    setInternal(next);
    onTargetChange?.(next);
  };

  return (
    <View style={{ gap: theme.space.sm }}>
      <View
        style={{
          width,
          height,
          backgroundColor: theme.color.bgSunken,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DishdashaVisualEngineV2
          config={config}
          width={width}
          height={height}
          angle={entry.angle}
          measurement={measurement}
          region={region}
          quality="HIGH"
          showGround={false}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.space.sm, flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}
      >
        {TARGETS.map((x) => {
          const selected = x.key === active;
          return (
            <Pressable
              key={x.key}
              onPress={() => select(x.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                paddingHorizontal: theme.space.md,
                paddingVertical: 7,
                minHeight: 34,
                justifyContent: 'center',
                borderRadius: theme.radius.pill,
                backgroundColor: selected ? theme.color.text : theme.color.surface,
                borderWidth: 1,
                borderColor: selected ? theme.color.text : theme.color.border,
              }}
            >
              <T variant="tiny" weight="600" color={selected ? theme.color.onDark : theme.color.textMuted}>
                {t(x.labelKey)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <T variant="tiny" color={theme.color.textFaint}>
        {`${Math.round(region.w)} × ${Math.round(region.h)} ${t('detail.mm')}`}
      </T>
    </View>
  );
};

export const DETAIL_TARGETS = TARGETS;
