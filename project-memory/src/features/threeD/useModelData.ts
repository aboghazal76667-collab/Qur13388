import { useEffect, useState } from 'react';
import { Asset as ExpoAsset } from 'expo-asset';

import { getBackend } from '@/data';
import { log } from '@/lib/log';
import type { ThreeDModel } from '@/domain';

/**
 * Resolves a model to the bytes the viewer needs.
 *
 * Two sources, one code path. A provider-generated model lives in the family's
 * private bucket and is reached through an expiring link; the demo figurine is
 * bundled with the app. Both end up as an ArrayBuffer handed to the same
 * renderer, which is what makes the demo a genuine exercise of the real viewer
 * rather than a separate pretend one.
 */
export type ModelSource = 'provider' | 'demo' | 'none';

export interface ModelData {
  data: ArrayBuffer | null;
  source: ModelSource;
  loading: boolean;
  error: boolean;
}

/** The bundled stand-in. Generic on purpose — it is nobody's child. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const demoFigurine = require('../../../assets/demo-figurine.glb');

export function useModelData(model: ThreeDModel | null): ModelData {
  const [state, setState] = useState<ModelData>({
    data: null,
    source: 'none',
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, source: 'none', loading: true, error: false });

    if (!model) {
      setState({ data: null, source: 'none', loading: false, error: false });
      return undefined;
    }

    const load = async (): Promise<void> => {
      // A real generated model, stored privately alongside the photographs.
      if (model.assetId) {
        const backend = getBackend();
        const asset = await backend.assets.get(model.assetId);
        const url = await backend.assets.resolveUrl(asset);
        if (!url) throw new Error('could not resolve model url');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`model fetch ${response.status}`);
        const data = await response.arrayBuffer();
        if (!cancelled) setState({ data, source: 'provider', loading: false, error: false });
        return;
      }

      // No provider file: show the bundled demo, clearly labelled as one.
      const bundled = ExpoAsset.fromModule(demoFigurine);
      await bundled.downloadAsync();
      const uri = bundled.localUri ?? bundled.uri;
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`demo model fetch ${response.status}`);
      const data = await response.arrayBuffer();
      if (!cancelled) setState({ data, source: 'demo', loading: false, error: false });
    };

    load().catch((error) => {
      log.warn('could not load model data', { error: String(error) });
      if (!cancelled) setState({ data: null, source: 'none', loading: false, error: true });
    });

    return () => {
      cancelled = true;
    };
  }, [model]);

  return state;
}
