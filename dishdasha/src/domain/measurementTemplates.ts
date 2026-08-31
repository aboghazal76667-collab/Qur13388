import type { MeasurementTemplate } from './types';

/**
 * PLATFORM DEFAULT template for the Omani dishdasha.
 *
 * Tailors measure differently, so this is one template among many rather than
 * a universal truth: a workshop may clone it, drop fields, or add its own.
 * Ranges are generous sanity bounds, not fit advice.
 */
export const OMANI_DISHDASHA_DEFAULT_TEMPLATE: MeasurementTemplate = {
  id: 'tpl_om_dishdasha_default',
  garmentTypeId: 'OMANI_DISHDASHA',
  name: { ar: 'القالب العُماني الافتراضي', en: 'Omani default template' },
  tailorBusinessId: null,
  allowsCustomFields: true,
  fields: [
    {
      key: 'total_length',
      label: { ar: 'الطول الكلي', en: 'Total length' },
      howTo: {
        ar: 'من أعلى الكتف عند الرقبة نزولاً حتى الطول المرغوب فوق الكعب.',
        en: 'From the top of the shoulder at the neck down to the desired length above the ankle.',
      },
      unit: 'cm', min: 110, max: 175, typical: 145, required: true, illustration: 'length',
    },
    {
      key: 'shoulder',
      label: { ar: 'عرض الكتف', en: 'Shoulder width' },
      howTo: {
        ar: 'من طرف الكتف الأيمن إلى طرف الكتف الأيسر من الخلف.',
        en: 'Across the back from one shoulder point to the other.',
      },
      unit: 'cm', min: 36, max: 60, typical: 46, required: true, illustration: 'shoulder',
    },
    {
      key: 'chest',
      label: { ar: 'محيط الصدر', en: 'Chest circumference' },
      howTo: {
        ar: 'حول أوسع نقطة في الصدر مع إبقاء الشريط أفقياً وغير مشدود.',
        en: 'Around the fullest part of the chest, tape level and not tight.',
      },
      unit: 'cm', min: 76, max: 150, typical: 102, required: true, illustration: 'chest',
    },
    {
      key: 'waist',
      label: { ar: 'محيط الوسط', en: 'Waist' },
      howTo: {
        ar: 'حول الوسط عند أضيق نقطة طبيعية.',
        en: 'Around the natural waistline.',
      },
      unit: 'cm', min: 66, max: 150, typical: 96, required: true, illustration: 'waist',
    },
    {
      key: 'seat',
      label: { ar: 'محيط الأرداف', en: 'Hip / seat' },
      howTo: {
        ar: 'حول أوسع نقطة في الأرداف. بعض الخياطين لا يستخدمونه.',
        en: 'Around the fullest part of the seat. Some tailors do not use it.',
      },
      unit: 'cm', min: 70, max: 150, typical: 100, required: false, illustration: 'hip',
    },
    {
      key: 'sleeve_length',
      label: { ar: 'طول الكم', en: 'Sleeve length' },
      howTo: {
        ar: 'من طرف الكتف حتى نهاية الكم عند الرسغ.',
        en: 'From the shoulder point to the end of the sleeve at the wrist.',
      },
      unit: 'cm', min: 45, max: 78, typical: 62, required: true, illustration: 'sleeve',
    },
    {
      key: 'neck',
      label: { ar: 'محيط الرقبة', en: 'Neck' },
      howTo: {
        ar: 'حول قاعدة الرقبة مع ترك إصبع من السعة.',
        en: 'Around the base of the neck leaving one finger of ease.',
      },
      unit: 'cm', min: 32, max: 52, typical: 40, required: true, illustration: 'neck',
    },
    {
      key: 'armhole',
      label: { ar: 'فتحة الإبط', en: 'Armhole' },
      howTo: {
        ar: 'حول فتحة الإبط مروراً بأعلى الكتف.',
        en: 'Around the armhole passing over the shoulder point.',
      },
      unit: 'cm', min: 36, max: 68, typical: 48, required: false, illustration: 'armhole',
    },
    {
      key: 'cuff_width',
      label: { ar: 'عرض الأسورة', en: 'Cuff width' },
      howTo: {
        ar: 'محيط نهاية الكم المرغوب عند الرسغ.',
        en: 'Desired circumference of the sleeve opening at the wrist.',
      },
      unit: 'cm', min: 16, max: 34, typical: 24, required: true, illustration: 'cuff',
    },
    {
      key: 'bottom_width',
      label: { ar: 'عرض الذيل', en: 'Bottom width' },
      howTo: {
        ar: 'اتساع الدشداشة عند الأسفل — يحدد مقدار الانسدال.',
        en: 'Sweep of the garment at the hem — controls the drape.',
      },
      unit: 'cm', min: 90, max: 190, typical: 130, required: false, illustration: 'bottom',
    },
  ],
};

/** A shorter template: a workshop that measures only the essentials. */
export const OMANI_DISHDASHA_QUICK_TEMPLATE: MeasurementTemplate = {
  id: 'tpl_om_dishdasha_quick',
  garmentTypeId: 'OMANI_DISHDASHA',
  name: { ar: 'القالب المختصر', en: 'Quick template' },
  tailorBusinessId: null,
  allowsCustomFields: true,
  fields: OMANI_DISHDASHA_DEFAULT_TEMPLATE.fields.filter((f) =>
    ['total_length', 'shoulder', 'chest', 'sleeve_length', 'neck', 'cuff_width'].includes(f.key),
  ),
};

export const MEASUREMENT_TEMPLATES: MeasurementTemplate[] = [
  OMANI_DISHDASHA_DEFAULT_TEMPLATE,
  OMANI_DISHDASHA_QUICK_TEMPLATE,
];

export const getMeasurementTemplate = (id: string): MeasurementTemplate =>
  MEASUREMENT_TEMPLATES.find((t) => t.id === id) ?? OMANI_DISHDASHA_DEFAULT_TEMPLATE;
