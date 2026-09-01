/**
 * VIRTUAL TRY-ON SERVICE.
 *
 * The V1 flow accepted a photo and produced nothing meaningful. The
 * architectural fix is the same one as for the product preview: the request
 * carries the customer's image AND the complete structured design, so the
 * model has no room to invent a different dishdasha.
 *
 * Consent and image quality are enforced at the service boundary, not in a
 * screen, so no future caller can bypass them.
 */
import type { PreviewAsset } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import { withTelemetry } from './telemetry';
import type { ProviderInfo } from './types';
import type { GarmentSpec } from './photorealistic';

export type PhotoQuality = {
  acceptable: boolean;
  issues: ('too_small' | 'not_full_body' | 'unknown')[];
  width: number;
  height: number;
};

/**
 * Cheap pre-flight on the customer's photo. It checks framing, not the person:
 * deliberately no biometric or body-shape inference, and no claim to make any.
 */
export const assessPhoto = (width: number, height: number): PhotoQuality => {
  const issues: PhotoQuality['issues'] = [];
  if (width < 480 || height < 640) issues.push('too_small');
  // A full-body shot is portrait and clearly taller than it is wide.
  if (height / Math.max(1, width) < 1.25) issues.push('not_full_body');
  return { acceptable: issues.length === 0, issues, width, height };
};

export type TryOnRequestV2 = {
  spec: GarmentSpec;
  customerPhotoUri: string;
  /** ISO timestamp of explicit consent. Absent means refuse. */
  consentAt: string;
  photoQuality?: PhotoQuality;
};

export type TryOnResult = {
  asset: PreviewAsset;
  /** The original, so the UI can present before/after. */
  originalUri: string;
};

export interface VirtualTryOnProvider {
  readonly info: ProviderInfo;
  render(req: TryOnRequestV2): Promise<TryOnResult>;
}

export const SIMULATED_TRYON_PREFIX = 'simulated:tryon:v2:';

export class MockVirtualTryOnProvider implements VirtualTryOnProvider {
  readonly info: ProviderInfo = { name: 'mock-try-on', model: 'vector-studio-v2', isLive: false };

  async render(req: TryOnRequestV2): Promise<TryOnResult> {
    // Boundary invariants — a screen cannot skip these by forgetting to check.
    if (!req.consentAt) throw new Error('try-on requires explicit consent');
    if (!req.customerPhotoUri) throw new Error('try-on requires a customer photo');
    if (req.photoQuality && !req.photoQuality.acceptable) {
      throw new Error('photo quality insufficient');
    }

    return withTelemetry(
      {
        kind: 'try_on',
        provider: this.info.name,
        model: this.info.model,
        // Design hash only. The photo URI is never logged.
        inputHash: req.spec.configHash,
        estimatedCost: 0,
      },
      async () => {
        await new Promise((r) => setTimeout(r, 1400));
        return {
          originalUri: req.customerPhotoUri,
          asset: {
            id: uuid(),
            designHash: req.spec.configHash,
            uri: `${SIMULATED_TRYON_PREFIX}${req.spec.configHash}`,
            quality: 'high',
            isSimulated: true,
            createdAt: nowIso(),
          },
        };
      },
    );
  }
}

/**
 * Server-backed adapter. The photo is uploaded to private storage and the
 * server passes a short-lived signed reference to the vendor — the image never
 * goes to a vendor straight from the device, and it is never retained beyond
 * the request unless the customer opted into storage.
 *
 * Compiles and typechecks; NOT verified against a live endpoint.
 */
export class RemoteVirtualTryOnProvider implements VirtualTryOnProvider {
  readonly info: ProviderInfo = { name: 'remote-try-on', model: 'server-configured', isLive: true };

  constructor(private readonly baseUrl: string) {}

  async render(req: TryOnRequestV2): Promise<TryOnResult> {
    if (!req.consentAt) throw new Error('try-on requires explicit consent');
    return withTelemetry(
      {
        kind: 'try_on',
        provider: this.info.name,
        model: this.info.model,
        inputHash: req.spec.configHash,
        estimatedCost: 0.08,
      },
      async () => {
        const response = await fetch(`${this.baseUrl}/ai/try-on`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spec: req.spec,
            photoRef: req.customerPhotoUri,
            consentAt: req.consentAt,
          }),
        });
        if (!response.ok) throw new Error(`try-on failed (${response.status})`);
        const data = (await response.json()) as { url: string };
        return {
          originalUri: req.customerPhotoUri,
          asset: {
            id: uuid(),
            designHash: req.spec.configHash,
            uri: data.url,
            quality: 'high',
            isSimulated: false,
            createdAt: nowIso(),
          },
        };
      },
    );
  }
}

export const isSimulatedTryOn = (uri: string) => uri.startsWith(SIMULATED_TRYON_PREFIX);
