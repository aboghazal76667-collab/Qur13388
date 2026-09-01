/**
 * FABRIC DIGITAL TWIN — data model and pipeline contract.
 *
 * The goal: a customer designs with the fabric his tailor actually has on the
 * shelf, photographed rather than approximated.
 *
 * STATUS: DATA MODEL AND INTERFACE ONLY. No capture, no colour calibration and
 * no texture extraction are implemented. `implemented` is false and every
 * method refuses, so the admin screen can show this as planned rather than
 * appearing broken — and so nobody mistakes the model for a working scanner.
 */
import type { FabricMaterial } from '@dd/visual/materials';
import type { Mm } from '@dd/visual/units';
import type { Pbr } from './materials3d';

export type TwinStage =
  | 'draft'
  | 'photos_captured'
  | 'white_balanced'
  | 'colour_calibrated'
  | 'texture_extracted'
  | 'tiled'
  | 'pbr_generated'
  | 'awaiting_approval'
  | 'published'
  | 'rejected';

/** What the tailor is asked to photograph. */
export type TwinCaptureSet = {
  /** Flat lay of the bolt, for overall colour. */
  frontPhotoRef: string | null;
  /** Macro of the weave, for the normal and roughness maps. */
  closeTextureRef: string | null;
  /** Raking light, which is what reveals weave depth. Optional but better. */
  angledLightRef: string | null;
};

export type TwinMetadata = {
  supplier: string;
  code: string;
  colourName: string;
  weightGsm: number | null;
  season: 'summer' | 'winter' | 'all_year';
  pricePerGarment: number;
  inStock: boolean;
  /** Physical width of the captured area, needed to derive weave pitch. */
  capturedWidthMm: Mm | null;
};

export type FabricDigitalTwin = {
  id: string;
  tailorBusinessId: string;
  stage: TwinStage;
  capture: TwinCaptureSet;
  metadata: TwinMetadata;
  /** Recovered against a colour reference card, not eyeballed. */
  calibratedColourHex: string | null;
  /** Seamless tile produced from the macro shot. */
  tileRef: string | null;
  /** Derived material, reviewed by an admin before publishing. */
  material: FabricMaterial | null;
  pbr: Pbr | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TwinGate = { ok: boolean; reasons: string[] };

/**
 * Publishing gate. A twin without a calibrated colour or a physical capture
 * width would render at the wrong hue or the wrong weave scale, so both are
 * required rather than advisory.
 */
export const canPublishTwin = (twin: FabricDigitalTwin): TwinGate => {
  const reasons: string[] = [];
  if (!twin.capture.frontPhotoRef) reasons.push('front fabric photograph missing');
  if (!twin.capture.closeTextureRef) reasons.push('close texture photograph missing');
  if (!twin.calibratedColourHex) reasons.push('colour not calibrated against a reference card');
  if (!twin.metadata.capturedWidthMm) reasons.push('physical capture width unknown — weave scale cannot be derived');
  if (!twin.metadata.supplier) reasons.push('supplier missing');
  if (!twin.metadata.code) reasons.push('fabric code missing');
  if (!twin.material) reasons.push('material profile not generated');
  return { ok: reasons.length === 0, reasons };
};

export interface FabricDigitalTwinPipeline {
  readonly implemented: boolean;
  create(tailorBusinessId: string, metadata: TwinMetadata): Promise<FabricDigitalTwin>;
  attachCapture(twinId: string, capture: Partial<TwinCaptureSet>): Promise<FabricDigitalTwin>;
  advance(twin: FabricDigitalTwin): Promise<FabricDigitalTwin>;
  publish(twin: FabricDigitalTwin): Promise<FabricDigitalTwin>;
}

export class UnimplementedFabricTwinPipeline implements FabricDigitalTwinPipeline {
  readonly implemented = false;
  async create(): Promise<FabricDigitalTwin> {
    throw new Error('Fabric digital twin capture is not implemented (architecture only).');
  }
  async attachCapture(): Promise<FabricDigitalTwin> {
    throw new Error('Fabric digital twin capture is not implemented (architecture only).');
  }
  async advance(): Promise<FabricDigitalTwin> {
    throw new Error('Fabric digital twin capture is not implemented (architecture only).');
  }
  async publish(twin: FabricDigitalTwin): Promise<FabricDigitalTwin> {
    const gate = canPublishTwin(twin);
    if (!gate.ok) throw new Error(`cannot publish: ${gate.reasons.join('; ')}`);
    throw new Error('Fabric digital twin capture is not implemented (architecture only).');
  }
}

export const fabricTwinPipeline: FabricDigitalTwinPipeline = new UnimplementedFabricTwinPipeline();
