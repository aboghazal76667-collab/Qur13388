import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';

import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { angularDistance, nearestSnap, normalizeAngle } from '@dd/visual/garmentGeometry';
import type { RenderQuality } from '@dd/visual/quality';
import { theme } from '@dd/theme/tokens';
import { useI18n } from '@dd/i18n';
import { T } from '@dd/components/ui';
import { DishdashaVisualEngineV2 } from './DishdashaVisualEngineV2';

/**
 * Dishdasha360Viewer.
 *
 * Drag horizontally to turn the garment. The angle is CONTINUOUS — every
 * frame is computed from the same geometry at a new camera angle, so the
 * garment never jumps between pre-baked pictures and the configuration cannot
 * drift: fabric, colour, embroidery and furakha are the same objects at every
 * angle by construction.
 *
 * This is parametric 2.5D, NOT a 3D mesh. See docs/VISUAL_ENGINE_V2.md.
 * The public API here is deliberately provider-shaped so a real 3D backend can
 * replace the renderer without the studio changing.
 */
const SNAPS = [
  { angle: 0, key: 'front' as const },
  { angle: 90, key: 'side' as const },
  { angle: 180, key: 'back' as const },
];

export const Dishdasha360Viewer: React.FC<{
  config: DesignConfig;
  width: number;
  height: number;
  measurement?: MeasurementProfile | null;
  quality?: RenderQuality;
  /** Starting angle; also used to reset. */
  initialAngle?: number;
  onAngleChange?: (angle: number) => void;
  showSnapControls?: boolean;
  background?: string | null;
}> = ({
  config,
  width,
  height,
  measurement = null,
  quality = 'AUTO',
  initialAngle = 0,
  onAngleChange,
  showSnapControls = true,
  background = null,
}) => {
  const { t, dir } = useI18n();
  const [angle, setAngle] = useState(initialAngle);
  const angleRef = useRef(initialAngle);
  const startRef = useRef(initialAngle);

  const setBoth = useCallback(
    (next: number) => {
      const n = normalizeAngle(next);
      angleRef.current = n;
      setAngle(n);
      onAngleChange?.(n);
    },
    [onAngleChange],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Claim only clearly horizontal drags, so the screen can still scroll.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderGrant: () => {
          startRef.current = angleRef.current;
        },
        onPanResponderMove: (_e, g) => {
          // A full drag across the viewer turns the garment roughly half way
          // round, which is what feels natural on a phone.
          const degrees = (g.dx / Math.max(1, width)) * 180;
          // In RTL the garment should follow the finger, not mirror it.
          setBoth(startRef.current + (dir === 'rtl' ? -degrees : degrees));
        },
        onPanResponderRelease: (_e, g) => {
          // Gentle magnet: a slow release settles on front / side / back.
          if (Math.abs(g.vx) < 0.35) {
            const snap = nearestSnap(angleRef.current);
            if (angularDistance(angleRef.current, snap) < 16) setBoth(snap);
          }
        },
      }),
    [width, dir, setBoth],
  );

  const label = useMemo(() => {
    const a = normalizeAngle(angle);
    if (a < 25 || a > 335) return t('view.front');
    if (a > 155 && a < 205) return t('view.back');
    if (a >= 25 && a <= 155) return t('view.side');
    return t('view.side');
  }, [angle, t]);

  return (
    <View style={{ width, alignItems: 'center' }}>
      <View {...responder.panHandlers} style={{ width, height }}>
        <DishdashaVisualEngineV2
          config={config}
          width={width}
          height={height}
          angle={angle}
          measurement={measurement}
          quality={quality}
          background={background}
        />
      </View>

      {showSnapControls ? (
        <View
          style={{
            flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
            gap: theme.space.sm,
            alignItems: 'center',
            marginTop: theme.space.xs,
          }}
        >
          {SNAPS.map((s) => {
            const active = angularDistance(angle, s.angle) < 16;
            return (
              <Pressable
                key={s.key}
                onPress={() => setBoth(s.angle)}
                accessibilityRole="button"
                accessibilityLabel={t(`view.${s.key}` as const)}
                accessibilityState={{ selected: active }}
                hitSlop={6}
                style={{
                  paddingHorizontal: theme.space.md,
                  paddingVertical: 6,
                  minHeight: 32,
                  justifyContent: 'center',
                  borderRadius: theme.radius.pill,
                  backgroundColor: active ? theme.color.text : 'transparent',
                }}
              >
                <T variant="tiny" weight="600" color={active ? theme.color.onDark : theme.color.textMuted}>
                  {t(`view.${s.key}` as const)}
                </T>
              </Pressable>
            );
          })}
          <T variant="tiny" color={theme.color.textFaint}>
            {t('view.dragHint')}
          </T>
        </View>
      ) : (
        <T variant="tiny" color={theme.color.textFaint}>
          {label}
        </T>
      )}
    </View>
  );
};
