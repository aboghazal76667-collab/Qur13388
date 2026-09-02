/**
 * WebGL capability probe.
 *
 * Kept tiny and side-effect free so the adapter can ask before committing to
 * the 3D path. A failed probe is a normal outcome, not an error: it just means
 * this device gets the V2 fallback.
 */
import { Platform } from 'react-native';

let cached: boolean | null = null;

export const detectWebglSupport = (): boolean => {
  if (cached !== null) return cached;

  if (Platform.OS !== 'web') {
    // On native the GL context comes from expo-gl, which ships in Expo Go for
    // this SDK. The context itself only arrives when GLView mounts, so the
    // best answer available here is whether the native module is installed at
    // all. Saying "no" instead would be a deadlock: the 3D path would never be
    // selected, so GLView would never mount, so nothing would ever report a
    // context. A module that is present but fails to produce a context is
    // caught by the load-failure fallback, which is where it belongs.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const gl = require('expo-gl') as { GLView?: unknown };
      cached = Boolean(gl?.GLView);
    } catch {
      cached = false;
    }
    return cached;
  }

  try {
    const g = globalThis as { document?: Document };
    if (!g.document) {
      cached = false;
      return cached;
    }
    const canvas = g.document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    cached = Boolean(context);
  } catch {
    cached = false;
  }
  return cached;
};

/** Native GL becomes available once expo-gl gives us a live context. */
export const markNativeGlAvailable = () => {
  cached = true;
};

export const resetWebglProbe = () => {
  cached = null;
};
