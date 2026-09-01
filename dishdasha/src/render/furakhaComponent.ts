/**
 * FURAKHA AS A SEMANTIC COMPONENT.
 *
 * The furakha is a defining feature of the Omani dishdasha and must remain its
 * own component in every representation. Baking it into the body texture would
 * make it impossible to recolour, resize or hang correctly — so the asset
 * contract requires separate geometry and the manifest validator rejects an
 * asset without it.
 *
 * Deliberately does not choose an implementation. A 3D asset may realise this
 * as geometry, curves, bones or a cloth/hair approximation; the domain only
 * states what it is and where it attaches.
 */
import { getOmaniStyle } from '@dd/domain/omaniStyles';
import type { Mm } from '@dd/visual/units';

export type FurakhaLengthKey = 'short' | 'medium' | 'long' | 'none';

export type FurakhaSpec = {
  present: boolean;
  cordLengthMm: Mm;
  cordThicknessMm: Mm;
  headRadiusMm: Mm;
  tasselLengthMm: Mm;
  threadHex: string;
  secondaryHex: string | null;
  /**
   * Attachment as a fraction of the neckline's front drop, so it stays at the
   * neckline whatever the garment's size.
   */
  attachmentDrop: number;
  /** It hangs under gravity: it never rotates with the cloth. */
  gravityAligned: true;
  material: 'cotton' | 'silk' | 'metallic';
};

export const buildFurakhaSpec = (
  lengthKey: FurakhaLengthKey,
  threadHex: string,
  secondaryHex: string | null = null,
  metallic = false,
  styleId = 'om_standard',
): FurakhaSpec => {
  const profile = getOmaniStyle(styleId).furakhaProfile;
  const present = lengthKey !== 'none';
  return {
    present,
    cordLengthMm: present ? profile.cordLengths[lengthKey] : 0,
    cordThicknessMm: profile.cordThickness,
    headRadiusMm: profile.tasselHeadRadius,
    tasselLengthMm: profile.skirtLength,
    threadHex,
    secondaryHex,
    attachmentDrop: profile.attachmentDrop,
    gravityAligned: true,
    material: metallic ? 'metallic' : 'cotton',
  };
};

/** Parses the component option id used throughout the app. */
export const furakhaLengthFromOption = (optionId: string | undefined): FurakhaLengthKey => {
  const key = (optionId ?? 'furakha_medium').replace('furakha_', '');
  return key === 'short' || key === 'medium' || key === 'long' || key === 'none' ? key : 'medium';
};
