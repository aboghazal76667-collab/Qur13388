import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';

import { T } from '@dd/components/ui';
import { DishdashaVisualEngineV2 } from '@dd/components/dishdasha/v2/DishdashaVisualEngineV2';
import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { useI18n } from '@dd/i18n';
import { buildGarmentSpec } from '@dd/services/ai/photorealistic';
import { theme } from '@dd/theme/tokens';
import { CAMERA_PRESETS, CUSTOMER_PRESETS, type CameraPresetId } from '@dd/render/cameraPresets';
import { fallbackAfterLoadFailure, selectRenderer } from '@dd/render/rendererAdapter';
import { detectWebglSupport } from '@dd/render/real3d/webglSupport';
import type { Real3DRenderer } from '@dd/render/real3d/Real3DRenderer';
import type { RendererSelection } from '@dd/render/types';
import { angularDistance } from '@dd/visual/garmentGeometry';

/**
 * GarmentViewer — the single component every screen uses to show a garment.
 *
 * It picks the renderer, owns the gesture, and hides all of it. Screens pass a
 * design; they never learn whether a mesh or the vector engine drew it. That is
 * what lets a professional GLB arrive later without touching the studio, the
 * review screen, compare, cart or the tailor's ticket.
 *
 * Customer mode shows the garment and four view buttons — no axes, no mesh
 * names, no FPS counter, no rulers. The developer inspector lives elsewhere.
 */
export type GarmentViewerProps = {
  config: DesignConfig;
  measurement?: MeasurementProfile | null;
  width: number;
  height: number;
  /** Fixed angle for cards and thumbnails; omit to allow rotation. */
  angle?: number;
  interactive?: boolean;
  showViewControls?: boolean;
  /** DEV only. Never set from a customer screen. */
  forceRenderer?: 'real3d' | 'v2fallback' | null;
  onSelection?: (selection: RendererSelection) => void;
  /** Reported on every rotation, so compare can share one camera angle. */
  onAngleChange?: (angle: number) => void;
};

/**
 * Loads the GL surface only when the 3D path is actually selected. Metro has
 * no code splitting for native, so three.js is still in the bundle — but it is
 * never evaluated, which is where the startup cost would otherwise land.
 */
const LazyGLSurface: React.FC<{
  width: number;
  height: number;
  assetUri: string | null;
  manifest: RendererSelection['manifest'];
  onReady: (renderer: Real3DRenderer) => void;
  onFailed: (reason: string) => void;
}> = (props) => {
  const mod = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('@dd/render/real3d/GLSurface') as typeof import('@dd/render/real3d/GLSurface');
    } catch {
      return null;
    }
  }, []);
  if (!mod) {
    props.onFailed('3D renderer module unavailable');
    return null;
  }
  return <mod.GLSurface {...props} />;
};

export const GarmentViewer: React.FC<GarmentViewerProps> = ({
  config,
  measurement = null,
  width,
  height,
  angle,
  interactive = true,
  showViewControls = true,
  forceRenderer = null,
  onSelection,
  onAngleChange,
}) => {
  const { t, dir } = useI18n();

  const spec = useMemo(
    () => buildGarmentSpec(config, measurement, angle ?? 0),
    [config, measurement, angle],
  );

  const [selection, setSelection] = useState<RendererSelection>(() => {
    const chosen = selectRenderer({
      styleId: 'om_standard',
      webglAvailable: detectWebglSupport(),
      force: forceRenderer,
    });
    onSelection?.(chosen);
    return chosen;
  });

  const [azimuth, setAzimuth] = useState(angle ?? 0);
  const azimuthRef = useRef(azimuth);
  const dragStartRef = useRef(azimuth);
  const rendererRef = useRef<Real3DRenderer | null>(null);

  const applyAzimuth = useCallback((next: number) => {
    const normalised = ((next % 360) + 360) % 360;
    azimuthRef.current = normalised;
    setAzimuth(normalised);
    // When a real mesh is mounted the camera moves; the vector engine instead
    // re-projects. Same gesture, same angle, two implementations.
    rendererRef.current?.rotate(normalised - rendererRef.current.getViewState().azimuth);
    onAngleChange?.(normalised);
  }, [onAngleChange]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          interactive && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderGrant: () => {
          dragStartRef.current = azimuthRef.current;
        },
        onPanResponderMove: (_e, g) => {
          const degrees = (g.dx / Math.max(1, width)) * 180;
          applyAzimuth(dragStartRef.current + (dir === 'rtl' ? -degrees : degrees));
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.vx) < 0.35) {
            for (const id of CUSTOMER_PRESETS) {
              const target = CAMERA_PRESETS[id].azimuth;
              if (angularDistance(azimuthRef.current, target) < 14) {
                applyAzimuth(target);
                return;
              }
            }
          }
        },
      }),
    [interactive, width, dir, applyAzimuth],
  );

  const handleReady = useCallback((renderer: Real3DRenderer) => {
    rendererRef.current = renderer;
    renderer.applyGarmentSpec(spec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const handleFailed = useCallback(
    (reason: string) => {
      // A bad or missing asset degrades to the working renderer rather than
      // showing the customer a broken screen.
      if (__DEV__) console.warn('[GarmentViewer] 3D unavailable:', reason);
      const next = fallbackAfterLoadFailure();
      setSelection(next);
      onSelection?.(next);
    },
    [onSelection],
  );

  const setPreset = (id: CameraPresetId) => {
    applyAzimuth(CAMERA_PRESETS[id].azimuth);
    rendererRef.current?.setCamera(id);
  };

  return (
    <View style={{ width, alignItems: 'center' }}>
      <View {...(interactive ? responder.panHandlers : {})} style={{ width, height }}>
        {selection.kind === 'real3d' ? (
          /* Required lazily: three.js is ~600 KB and no customer reaches this
             branch while the asset registry is empty, so it is never parsed. */
          <LazyGLSurface
            width={width}
            height={height}
            assetUri={selection.assetUri}
            manifest={selection.manifest}
            onReady={handleReady}
            onFailed={handleFailed}
          />
        ) : (
          <DishdashaVisualEngineV2
            config={config}
            measurement={measurement}
            width={Math.min(width, height * 0.72)}
            height={height}
            angle={azimuth}
          />
        )}
      </View>

      {showViewControls && interactive ? (
        <View
          style={{
            flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
            gap: theme.space.sm,
            alignItems: 'center',
            marginTop: theme.space.xs,
          }}
        >
          {CUSTOMER_PRESETS.map((id) => {
            const active = angularDistance(azimuth, CAMERA_PRESETS[id].azimuth) < 14;
            const label =
              id === 'FRONT' ? t('view.front')
              : id === 'SIDE' ? t('view.side')
              : id === 'BACK' ? t('view.back')
              : '45°';
            return (
              <Pressable
                key={id}
                onPress={() => setPreset(id)}
                accessibilityRole="button"
                accessibilityLabel={label}
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
                  {label}
                </T>
              </Pressable>
            );
          })}
          <T variant="tiny" color={theme.color.textFaint}>
            {t('view.dragHint')}
          </T>
        </View>
      ) : null}
    </View>
  );
};
