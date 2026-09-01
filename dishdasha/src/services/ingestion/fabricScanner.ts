/**
 * TAILOR FABRIC SCANNER — pipeline definition.
 *
 * The commercial goal: a customer eventually designs with the fabric his
 * tailor actually has on the shelf, photographed rather than approximated.
 *
 * STATUS: interfaces and stage contracts only. No computer vision is
 * implemented in this sprint — deliberately, because building it while the
 * base garment still looked wrong would have been the wrong order of work.
 * The stages are defined now so the data model and the admin flow are settled.
 */
import type { FabricMaterial } from '@dd/visual/materials';
import type { Mm } from '@dd/visual/units';

export type ScanStage =
  | 'uploaded'
  | 'cropped'
  | 'white_balanced'
  | 'colour_calibrated'
  | 'texture_extracted'
  | 'tiled'
  | 'profiled'
  | 'awaiting_approval'
  | 'published'
  | 'rejected';

export const SCAN_STAGES: ScanStage[] = [
  'uploaded',
  'cropped',
  'white_balanced',
  'colour_calibrated',
  'texture_extracted',
  'tiled',
  'profiled',
  'awaiting_approval',
  'published',
];

/**
 * Capture conditions the tailor is asked to meet. Without a reference card in
 * frame there is no way to recover true colour from a phone photo, so the
 * pipeline requires one rather than guessing.
 */
export type CaptureGuidance = {
  requiresColourReferenceCard: true;
  requiresFlatLay: true;
  minResolution: { width: number; height: number };
  /** Physical size of the captured area, needed to derive the weave pitch. */
  requiresScaleReference: true;
};

export const CAPTURE_GUIDANCE: CaptureGuidance = {
  requiresColourReferenceCard: true,
  requiresFlatLay: true,
  minResolution: { width: 1600, height: 1600 },
  requiresScaleReference: true,
};

export type FabricScanDraft = {
  id: string;
  tailorBusinessId: string;
  stage: ScanStage;
  sourcePhotoRef: string;
  /** Physical width of the photographed area, from the scale reference. */
  capturedWidth: Mm | null;
  /** Recovered after white balance against the reference card. */
  calibratedColourHex: string | null;
  /** A seamless swatch, once extracted. */
  tileRef: string | null;
  /** Derived material profile, reviewed by an admin before publishing. */
  material: FabricMaterial | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface FabricScannerPipeline {
  readonly implemented: boolean;
  guidance(): CaptureGuidance;
  submit(tailorBusinessId: string, photoRef: string): Promise<FabricScanDraft>;
  advance(draft: FabricScanDraft): Promise<FabricScanDraft>;
  approve(draftId: string): Promise<FabricScanDraft>;
  reject(draftId: string, reason: string): Promise<FabricScanDraft>;
}

/**
 * Placeholder implementation. It reports `implemented: false` and refuses,
 * rather than pretending to process a photo — the admin screen reads that flag
 * and shows the feature as planned, not broken.
 */
export class UnimplementedFabricScanner implements FabricScannerPipeline {
  readonly implemented = false;
  guidance() {
    return CAPTURE_GUIDANCE;
  }
  async submit(): Promise<FabricScanDraft> {
    throw new Error('Fabric scanning is not implemented yet (architecture only).');
  }
  async advance(): Promise<FabricScanDraft> {
    throw new Error('Fabric scanning is not implemented yet (architecture only).');
  }
  async approve(): Promise<FabricScanDraft> {
    throw new Error('Fabric scanning is not implemented yet (architecture only).');
  }
  async reject(): Promise<FabricScanDraft> {
    throw new Error('Fabric scanning is not implemented yet (architecture only).');
  }
}

export const fabricScanner: FabricScannerPipeline = new UnimplementedFabricScanner();
