import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, View } from 'react-native';

import { T } from '@dd/components/ui';
import { DishdashaVisualEngineV2 } from '@dd/components/dishdasha/v2/DishdashaVisualEngineV2';
import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { useI18n } from '@dd/i18n';
import { buildGarmentSpec } from '@dd/services/ai/photorealistic';
import { theme } from '@dd/theme/tokens';
import { CAMERA_PRESETS, CUSTOMER_PRESETS, clampZoom, type CameraPresetId } from '@dd/render/cameraPresets';
import { fallbackAfterLoadFailure, selectRenderer } from '@dd/render/rendererAdapter';
import { detectWebglSupport } from '@dd/render/real3d/webglSupport';
import type { Real3DRenderer } from '@dd/render/real3d/Real3DRenderer';
import type { RendererSelection } from '@dd/render/types';
import { angularDistance } from '@dd/visual/garmentGeometry';

/**
 * GarmentViewer — the single component every screen uses to show a garment.
 *
 * It picks the renderer, owns the gestures, and hides all of it. Screens pass a
 * design; they never learn whether a mesh or the vector engine drew it. That is
 * what lets a professional GLB arrive later without touching the studio, the
 * review screen, compare, cart or the tailor's ticket.
 *
 * Customer mode shows the garment and four view buttons — no axes, no mesh
 * names, no FPS counter, no rulers, and no mention of which renderer won. The
 * developer inspector lives elsewhere.
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
 * If the GL surface has not produced a loaded renderer within this window,
 * something is wrong that we cannot see — a context that never arrives, a
 * stalled fetch — and a blank rectangle is the worst possible outcome. Fall
 * back to the working renderer instead.
 */
const LOAD_TIMEOUT_MS = 12000;

/**
 * Loads the GL surface only when the 3D path is actually selected. Metro has
 * no code splitting for native, so three.js is still in the bundle — but it is
 * never evaluated on a device that stays on the fallback, which is where the
 * startup cost would otherwise land.
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

/** Distance between the first two active touches, or null if there are fewer. */
const pinchDistance = (touches: { pageX: number; pageY: number }[]): number | null => {
  if (touches.length < 2) return null;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
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
  const zoomRef = useRef(1);
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
  const loadedRef = useRef(false);
  const containerRef = useRef<View | null>(null);

  const is3d = selection.kind === 'real3d';

  const applyAzimuth = useCallback(
    (next: number) => {
      const normalised = ((next % 360) + 360) % 360;
      azimuthRef.current = normalised;
      setAzimuth(normalised);
      // When a real mesh is mounted the camera orbits the SAME geometry; the
      // vector engine instead re-projects. One gesture, two implementations.
      const renderer = rendererRef.current;
      if (renderer) renderer.rotate(normalised - renderer.getViewState().azimuth);
      onAngleChange?.(normalised);
    },
    [onAngleChange],
  );

  const applyZoom = useCallback((next: number) => {
    const clamped = clampZoom(next);
    zoomRef.current = clamped;
    const renderer = rendererRef.current;
    if (!renderer) return;
    // The renderer's zoom is relative; convert the absolute target into the
    // ratio that gets it there, so a pinch cannot drift out of sync.
    const current = renderer.getViewState().zoom;
    if (current > 0) renderer.zoom(clamped / current);
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (e, g) => {
          if (!interactive) return false;
          // Two fingers always belong to the viewer: that is a pinch.
          if (e.nativeEvent.touches.length >= 2) return true;
          return Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4;
        },
        onPanResponderGrant: () => {
          dragStartRef.current = azimuthRef.current;
          pinchStartRef.current = null;
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches as { pageX: number; pageY: number }[];
          const distance = pinchDistance(touches);

          if (distance !== null) {
            // Pinch: scale relative to where the fingers started, so the
            // gesture is reversible within a single touch.
            if (!pinchStartRef.current) {
              pinchStartRef.current = { distance, zoom: zoomRef.current };
              dragStartRef.current = azimuthRef.current;
              return;
            }
            const start = pinchStartRef.current;
            if (start.distance > 0) applyZoom(start.zoom * (distance / start.distance));
            return;
          }

          // A finger lifted mid-gesture: restart the drag from here rather
          // than snapping by the accumulated offset.
          if (pinchStartRef.current) {
            pinchStartRef.current = null;
            dragStartRef.current = azimuthRef.current;
            return;
          }

          const degrees = (g.dx / Math.max(1, width)) * 180;
          applyAzimuth(dragStartRef.current + (dir === 'rtl' ? -degrees : degrees));
        },
        onPanResponderRelease: (_e, g) => {
          pinchStartRef.current = null;
          // The vector engine reads best at its canonical angles, so a slow
          // release near one settles onto it. A real mesh is continuous by
          // nature and snapping it would fight the gesture, so it does not.
          if (is3d || Math.abs(g.vx) >= 0.35) return;
          for (const id of CUSTOMER_PRESETS) {
            const target = CAMERA_PRESETS[id].azimuth;
            if (angularDistance(azimuthRef.current, target) < 14) {
              applyAzimuth(target);
              return;
            }
          }
        },
        onPanResponderTerminate: () => {
          pinchStartRef.current = null;
        },
      }),
    [interactive, width, dir, is3d, applyAzimuth, applyZoom],
  );

  const handleReady = useCallback((renderer: Real3DRenderer) => {
    rendererRef.current = renderer;
    loadedRef.current = true;
    renderer.setCamera('FRONT');
    renderer.rotate(azimuthRef.current);
  }, []);

  const handleFailed = useCallback(
    (reason: string) => {
      // A bad, missing or slow asset degrades to the working renderer rather
      // than showing the customer a broken screen.
      if (__DEV__) console.warn('[GarmentViewer] 3D unavailable:', reason);
      rendererRef.current = null;
      const next = fallbackAfterLoadFailure();
      setSelection(next);
      onSelection?.(next);
    },
    [onSelection],
  );

  // The design is the single source of truth, so every change to it is pushed
  // to whichever renderer is mounted — not only the one present at load time.
  useEffect(() => {
    rendererRef.current?.applyGarmentSpec(spec);
  }, [spec]);

  // A GL surface that never reports back leaves a blank rectangle. Give it a
  // bounded window, then fall back.
  useEffect(() => {
    if (!is3d) return;
    loadedRef.current = false;
    const timer = setTimeout(() => {
      if (!loadedRef.current) handleFailed('3D surface did not initialise in time');
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [is3d, selection.assetUri, handleFailed]);

  // Desktop browsers have no pinch. ctrl+wheel is the platform's zoom gesture
  // (it is also what a trackpad pinch sends), so only that zooms the garment —
  // a plain wheel must still scroll the page. Swallowing every wheel event
  // here would make the page feel stuck whenever the pointer is over the
  // garment, which is most of the studio.
  useEffect(() => {
    if (Platform.OS !== 'web' || !is3d || !interactive) return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      applyZoom(zoomRef.current * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [is3d, interactive, applyZoom]);

  const setPreset = (id: CameraPresetId) => {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setCamera(id);
      // setCamera resets zoom to the preset's; keep the two in step.
      zoomRef.current = renderer.getViewState().zoom;
    }
    azimuthRef.current = CAMERA_PRESETS[id].azimuth;
    setAzimuth(azimuthRef.current);
    onAngleChange?.(azimuthRef.current);
  };

  return (
    <View style={{ width, alignItems: 'center' }}>
      <View
        ref={containerRef}
        {...(interactive ? responder.panHandlers : {})}
        style={{ width, height }}
      >
        {is3d ? (
          /* Required lazily so three.js is not evaluated on a device that
             stays on the fallback. */
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
