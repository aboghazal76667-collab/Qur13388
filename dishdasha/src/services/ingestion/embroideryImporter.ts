/**
 * TAILOR EMBROIDERY IMPORTER — pipeline definition.
 *
 * The moat: a customer designs with embroidery his chosen tailor can actually
 * sew, because the tailor uploaded it. Until then the catalogue is our own
 * original demo artwork.
 *
 * STATUS: interfaces and stage contracts only. No image processing in this
 * sprint. The physical-dimension step is mandatory in the contract because
 * that is precisely the field whose absence caused the V1 scale failure.
 */
import type { EmbroideryZoneId } from '@dd/domain/omaniStyles';
import type { EmbroideryPhysical } from '@dd/visual/embroideryScale';
import { validatePhysical } from '@dd/visual/embroideryScale';

export type ImportStage =
  | 'uploaded'
  | 'isolated'
  | 'repeat_identified'
  | 'channels_identified'
  | 'dimensioned'
  | 'colours_mapped'
  | 'preview_ready'
  | 'awaiting_verification'
  | 'published'
  | 'rejected';

export const IMPORT_STAGES: ImportStage[] = [
  'uploaded',
  'isolated',
  'repeat_identified',
  'channels_identified',
  'dimensioned',
  'colours_mapped',
  'preview_ready',
  'awaiting_verification',
  'published',
];

export type EmbroideryImportDraft = {
  id: string;
  tailorBusinessId: string;
  stage: ImportStage;
  sourceRef: string;
  sourceKind: 'photo' | 'scan' | 'vector' | 'machine_file';
  /** Set at the `dimensioned` stage. Publishing without it is refused. */
  physical: EmbroideryPhysical | null;
  channelCount: 1 | 2 | 3 | null;
  threadColourIds: string[];
  allowedZones: EmbroideryZoneId[];
  /** The tailor confirms this is their own pattern and they may license it. */
  ownershipConfirmed: boolean;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportGateResult = { ok: boolean; reasons: string[] };

/**
 * Publishing gate. Enforced in the contract rather than left to a reviewer's
 * attention: without measured millimetres a pattern would fall back to a
 * derived profile and could land on the garment at the wrong size.
 */
export const canPublish = (draft: EmbroideryImportDraft): ImportGateResult => {
  const reasons: string[] = [];
  if (!draft.ownershipConfirmed) reasons.push('ownership not confirmed by the tailor');
  if (!draft.channelCount) reasons.push('thread channels not identified');
  if (!draft.physical) {
    reasons.push('physical dimensions not measured');
  } else {
    for (const issue of validatePhysical(draft.physical)) reasons.push(issue.message);
  }
  if (draft.allowedZones.length === 0) reasons.push('no garment zones selected');
  return { ok: reasons.length === 0, reasons };
};

export interface TailorEmbroideryImporter {
  readonly implemented: boolean;
  submit(tailorBusinessId: string, sourceRef: string, kind: EmbroideryImportDraft['sourceKind']): Promise<EmbroideryImportDraft>;
  advance(draft: EmbroideryImportDraft): Promise<EmbroideryImportDraft>;
  publish(draft: EmbroideryImportDraft): Promise<EmbroideryImportDraft>;
}

export class UnimplementedEmbroideryImporter implements TailorEmbroideryImporter {
  readonly implemented = false;
  async submit(): Promise<EmbroideryImportDraft> {
    throw new Error('Embroidery import is not implemented yet (architecture only).');
  }
  async advance(): Promise<EmbroideryImportDraft> {
    throw new Error('Embroidery import is not implemented yet (architecture only).');
  }
  async publish(draft: EmbroideryImportDraft): Promise<EmbroideryImportDraft> {
    const gate = canPublish(draft);
    if (!gate.ok) throw new Error(`cannot publish: ${gate.reasons.join('; ')}`);
    throw new Error('Embroidery import is not implemented yet (architecture only).');
  }
}

export const embroideryImporter: TailorEmbroideryImporter = new UnimplementedEmbroideryImporter();
