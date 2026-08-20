import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { useI18n } from '@/i18n';
import { log } from '@/lib/log';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

/**
 * Renders the actual generated model.
 *
 * Not a stand-in and not a rendered still: this loads the GLB the provider
 * produced for this specific request and draws it with a real renderer, so
 * turning it shows the geometry rather than sliding a picture. That distinction
 * is the whole point of the screen — a parent judging whether a figurine looks
 * like their child has to be looking at the figurine.
 *
 * The model arrives as bytes rather than a URL because our files live in a
 * private bucket behind expiring links; the caller resolves the link and hands
 * over the data.
 */

export type ModelViewerState = 'loading' | 'ready' | 'error';

export interface ModelViewerProps {
  /** GLB bytes for this job's model. */
  data: ArrayBuffer | null;
  /** Null while the caller is still resolving the file. */
  loading?: boolean;
  size?: number;
  onStateChange?: (state: ModelViewerState) => void;
}

/** Frames the camera so any model fills the view regardless of its scale. */
function frameObject(object: THREE.Object3D, camera: THREE.PerspectiveCamera): number {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());

  // Recentre on the origin so rotation happens about the model, not about
  // wherever the exporter happened to place it.
  object.position.sub(centre);

  const extent = Math.max(size.x, size.y, size.z) || 1;
  const distance = (extent / 2) / Math.tan((camera.fov * Math.PI) / 360);
  return distance * 1.9;
}

export function ModelViewer({ data, loading = false, size = 280, onStateChange }: ModelViewerProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [state, setState] = useState<ModelViewerState>('loading');

  // Gesture state lives in refs: the render loop reads it every frame, and
  // routing it through React state would re-render at 60fps for nothing.
  const rotation = useRef({ x: 0.15, y: 0.6 });
  const gestureStart = useRef({ x: 0.15, y: 0.6 });
  const zoom = useRef(1);
  const zoomStart = useRef(1);
  const pinchStart = useRef<number | null>(null);
  const disposed = useRef(false);

  const report = useCallback(
    (next: ModelViewerState) => {
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange],
  );

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
    };
  }, []);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStart.current = { ...rotation.current };
        zoomStart.current = zoom.current;
        pinchStart.current = null;
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) {
          // Pinch to zoom, clamped so the model can never be lost off-screen.
          const [a, b] = touches;
          const spread = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          if (pinchStart.current === null) {
            pinchStart.current = spread;
            zoomStart.current = zoom.current;
          } else if (pinchStart.current > 0) {
            zoom.current = Math.max(0.45, Math.min(3, zoomStart.current * (spread / pinchStart.current)));
          }
          return;
        }

        rotation.current = {
          y: gestureStart.current.y + gesture.dx / 160,
          // Vertical rotation stops short of the poles, where the model would
          // flip and feel broken.
          x: Math.max(-1.1, Math.min(1.1, gestureStart.current.x + gesture.dy / 220)),
        };
      },
      onPanResponderRelease: () => {
        pinchStart.current = null;
      },
    }),
  ).current;

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      try {
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;

        const renderer = new THREE.WebGLRenderer({
          canvas: {
            width,
            height,
            style: {},
            addEventListener: () => {},
            removeEventListener: () => {},
            clientHeight: height,
            getContext: () => gl,
          } as unknown as HTMLCanvasElement,
          context: gl as unknown as WebGLRenderingContext,
          antialias: true,
        });
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(theme.colors.backgroundAlt), 1);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);

        // Three lights rather than one: a figurine lit from a single source
        // reads as a flat silhouette and tells a parent nothing about the face.
        scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(2, 3, 4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.5);
        fill.position.set(-3, 1, -2);
        scene.add(fill);

        const pivot = new THREE.Group();
        scene.add(pivot);

        let baseDistance = 3;

        if (data) {
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(data, '');
          pivot.add(gltf.scene);
          baseDistance = frameObject(gltf.scene, camera);
          report('ready');
        } else {
          report('error');
        }

        const render = () => {
          if (disposed.current) return;
          pivot.rotation.y = rotation.current.y;
          pivot.rotation.x = rotation.current.x;
          camera.position.set(0, 0, baseDistance / zoom.current);
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
          gl.endFrameEXP();
          requestAnimationFrame(render);
        };
        render();
      } catch (error) {
        log.error('model viewer failed', { error: String(error) });
        report('error');
      }
    },
    [data, report, theme.colors.backgroundAlt],
  );

  const showOverlay = loading || state === 'loading' || state === 'error';

  return (
    <View style={{ gap: theme.spacing.md, alignItems: 'center' }}>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t.threeD.preview}
        accessibilityHint={t.threeD.previewHint}
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
          backgroundColor: theme.colors.backgroundAlt,
        }}
      >
        {data ? (
          <GLView style={{ width: size, height: size }} onContextCreate={onContextCreate} />
        ) : null}

        {showOverlay ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              backgroundColor: theme.colors.backgroundAlt,
            }}
          >
            {state === 'error' && !loading ? (
              <Text variant="caption" color="textMuted" align="center" autoAlign={false}>
                {t.errors.generic}
              </Text>
            ) : (
              <ActivityIndicator color={theme.colors.primary} />
            )}
          </View>
        ) : null}
      </View>

      <Text variant="caption" color="textFaint" align="center" autoAlign={false}>
        {t.threeD.previewHint}
      </Text>
    </View>
  );
}
