import type { GarmentType, GarmentTypeId } from './types';

/**
 * Garment registry.
 *
 * Only OMANI_DISHDASHA is enabled. The other GCC garments are intentionally
 * absent from the data (not merely hidden) — adding one means adding a record
 * here plus its motifs and measurement template, with no core changes.
 */
export const OMANI_DISHDASHA: GarmentType = {
  id: 'OMANI_DISHDASHA',
  name: { ar: 'الدشداشة العُمانية', en: 'Omani Dishdasha' },
  country: 'OM',
  enabled: true,
  zones: ['body', 'collar', 'placket', 'chest', 'cuff', 'furakha', 'pocket', 'hem'],
  defaultMeasurementTemplateId: 'tpl_om_dishdasha_default',
  baseTailoringPrice: 8.5,
  components: [
    {
      id: 'collar',
      zone: 'collar',
      customizable: true,
      label: { ar: 'الياقة', en: 'Collar' },
      options: [
        {
          id: 'collar_round_classic',
          label: { ar: 'مدورة كلاسيكية', en: 'Classic round' },
          description: { ar: 'الياقة العُمانية المعتادة بحافة نظيفة.', en: 'The familiar Omani round neckline with a clean edge.' },
          surcharge: 0,
          isDefault: true,
        },
        {
          id: 'collar_round_piped',
          label: { ar: 'مدورة بحاشية', en: 'Round with piping' },
          description: { ar: 'حاشية رفيعة حول الرقبة تبرز التطريز.', en: 'A fine piped edge that frames the embroidery.' },
          surcharge: 1.2,
        },
        {
          id: 'collar_band_low',
          label: { ar: 'ياقة قصيرة', en: 'Low band' },
          description: { ar: 'شريط منخفض بمظهر عصري هادئ.', en: 'A low band for a quieter modern look.' },
          surcharge: 1.5,
        },
      ],
    },
    {
      id: 'cuff',
      zone: 'cuff',
      customizable: true,
      label: { ar: 'الأساور', en: 'Cuffs' },
      options: [
        { id: 'cuff_plain', label: { ar: 'سادة', en: 'Plain' }, surcharge: 0, isDefault: true },
        { id: 'cuff_stitched', label: { ar: 'بخياطة بارزة', en: 'Topstitched' }, surcharge: 0.8 },
        { id: 'cuff_embroidered', label: { ar: 'مطرّزة', en: 'Embroidered' }, surcharge: 2.5 },
      ],
    },
    {
      id: 'pocket',
      zone: 'pocket',
      customizable: true,
      label: { ar: 'الجيب', en: 'Pocket' },
      options: [
        { id: 'pocket_single', label: { ar: 'جيب واحد', en: 'Single' }, surcharge: 0, isDefault: true },
        { id: 'pocket_hidden', label: { ar: 'جيب مخفي', en: 'Hidden' }, surcharge: 1 },
        { id: 'pocket_none', label: { ar: 'بدون جيب', en: 'None' }, surcharge: 0 },
      ],
    },
    {
      id: 'furakha_length',
      zone: 'furakha',
      customizable: true,
      label: { ar: 'طول الفراخة', en: 'Furakha length' },
      options: [
        { id: 'furakha_short', label: { ar: 'قصيرة', en: 'Short' }, surcharge: 0 },
        { id: 'furakha_medium', label: { ar: 'متوسطة', en: 'Medium' }, surcharge: 0, isDefault: true },
        { id: 'furakha_long', label: { ar: 'طويلة', en: 'Long' }, surcharge: 0.5 },
        { id: 'furakha_none', label: { ar: 'بدون فراخة', en: 'None' }, surcharge: 0 },
      ],
    },
  ],
};

export const GARMENT_TYPES: GarmentType[] = [OMANI_DISHDASHA];

export const getGarmentType = (id: GarmentTypeId): GarmentType =>
  GARMENT_TYPES.find((g) => g.id === id) ?? OMANI_DISHDASHA;

/** Everything the customer UI is allowed to offer today. */
export const enabledGarmentTypes = () => GARMENT_TYPES.filter((g) => g.enabled);

export const defaultComponentOptions = (garment: GarmentType): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const component of garment.components) {
    const fallback = component.options.find((o) => o.isDefault) ?? component.options[0];
    if (fallback) out[component.id] = fallback.id;
  }
  return out;
};
