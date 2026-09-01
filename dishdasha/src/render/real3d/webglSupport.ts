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
    // this SDK. Availability is confirmed when GLView actually hands us a
    // context; assuming it here would be optimistic, so we say no until the
    // surface reports otherwise.
    cached = false;
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
