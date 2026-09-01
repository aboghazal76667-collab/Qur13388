import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PixelRatio, Platform, View } from 'react-native';

import { theme } from '@dd/theme/tokens';
import type { AssetManifest } from '../assetManifest';
import { resolveTier, type RenderTier } from '../quality3d';
import { Real3DRenderer, type GLContextLike } from './Real3DRenderer';
import { markNativeGlAvailable } from './webglSupport';

/**
 * The GL drawing surface, split by platform.
 *
 *   web    — a plain <canvas>, three.js creates its own WebGL context
 *   native — expo-gl's GLView, which ships in Expo Go for SDK 57
 *
 * This is the ONLY file that knows which platform it is on. Real3DRenderer
 * receives a context and does not care where it came from, which is what keeps
 * the renderer testable and the platform split to a single seam.
 *
 * expo-gl is imported through a guarded runtime require so that a web bundle,
 * or an environment without the native module, degrades to the fallback
 * instead of failing to load.
 */
export type GLSurfaceProps = {
  width: number;
  height: number;
  assetUri: string | null;
  manifest: AssetManifest | null;
  onReady: (renderer: Real3DRenderer) => void;
  onFailed: (reason: string) => void;
};

const loadExpoGl = (): { GLView: React.ComponentType<Record<string, unknown>> } | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-gl') as { GLView: React.ComponentType<Record<string, unknown>> };
  } catch {
    return null;
  }
};

export const GLSurface: React.FC<GLSurfaceProps> = ({
  width,
  height,
  assetUri,
  manifest,
  onReady,
  onFailed,
}) => {
  const rendererRef = useRef<Real3DRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const [tier] = useState<RenderTier>(() =>
    resolveTier({
      pixelRatio: PixelRatio.get(),
      triangleCount: manifest?.triangleCount ?? 0,
      isDetailView: false,
    }),
  );

  const start = useCallback(
    async (gl: GLContextLike) => {
      try {
        const renderer = new Real3DRenderer({
          gl,
          width,
          height,
          pixelRatio: PixelRatio.get(),
          tier,
        });
        const result = await renderer.loadGarment(assetUri, manifest);
        if (!result.ok) {
          renderer.dispose();
          onFailed(result.reason);
          return;
        }
        rendererRef.current = renderer;
        onReady(renderer);

        const loop = () => {
          if (!rendererRef.current) return;
          rendererRef.current.render();
          frameRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (error) {
        onFailed(error instanceof Error ? error.message : 'GL initialisation failed');
      }
    },
    [assetUri, manifest, width, height, tier, onReady, onFailed],
  );

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    [],
  );

  // ── web ──────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context =
      canvas.getContext('webgl2') ?? (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!context) {
      onFailed('WebGL context unavailable');
      return;
    }
    void start(context as unknown as GLContextLike);
    // Starting once per canvas is intentional: the renderer owns its scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (Platform.OS === 'web') {
    return React.createElement('canvas', {
      ref: canvasRef,
      width,
      height,
      style: { width, height, display: 'block', backgroundColor: theme.color.bgSunken },
    });
  }

  // ── native ───────────────────────────────────────────────────────────────
  const expoGl = loadExpoGl();
  if (!expoGl) {
    // Not an error the customer sees: the adapter falls back.
    onFailed('expo-gl is not available in this build');
    return <View style={{ width, height, backgroundColor: theme.color.bgSunken }} />;
  }

  const { GLView } = expoGl;
  return (
    <GLView
      style={{ width, height }}
      onContextCreate={(gl: GLContextLike) => {
        markNativeGlAvailable();
        void start(gl);
      }}
    />
  );
};
