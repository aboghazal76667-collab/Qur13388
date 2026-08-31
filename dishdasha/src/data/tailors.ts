import type { StaffMember, TailorBusiness } from '@dd/domain/types';

/**
 * THREE DEMO TAILORS. Fictional businesses created for the prototype and
 * flagged `isDemoData` so the UI can label them. No real business is
 * represented; ratings are deliberately null rather than invented.
 */
export const TAILORS: TailorBusiness[] = [
  {
    id: 'tlr_al_asalah',
    name: { ar: 'خياط الأصالة (تجريبي)', en: 'Al Asalah Tailoring (demo)' },
    logoInitials: 'أص',
    logoColor: '#174A3B',
    about: {
      ar: 'ورشة تقليدية تركز على القص العُماني الكلاسيكي والتطريز اليدوي الدقيق.',
      en: 'A traditional workshop focused on the classic Omani cut and precise hand-finished embroidery.',
    },
    serviceAreas: [
      { ar: 'مسقط', en: 'Muscat' },
      { ar: 'السيب', en: 'Seeb' },
    ],
    productionDays: { min: 5, max: 8 },
    startingPrice: 14,
    offersPickup: true,
    offersDelivery: true,
    deliveryFee: 1.5,
    freeDeliveryOver: 45,
    ratingAverage: null,
    ratingCount: 0,
    measurementTemplateId: 'tpl_om_dishdasha_default',
    fabricIds: [],
    patternIds: [],
    isDemoData: true,
    active: true,
    branches: [
      { id: 'br_asalah_ruwi', tailorBusinessId: 'tlr_al_asalah', name: { ar: 'فرع روي', en: 'Ruwi branch' }, area: { ar: 'روي', en: 'Ruwi' }, phone: '+968 0000 0001' },
      { id: 'br_asalah_seeb', tailorBusinessId: 'tlr_al_asalah', name: { ar: 'فرع السيب', en: 'Seeb branch' }, area: { ar: 'السيب', en: 'Seeb' }, phone: '+968 0000 0002' },
    ],
  },
  {
    id: 'tlr_muscat_atelier',
    name: { ar: 'أتيليه مسقط (تجريبي)', en: 'Muscat Atelier (demo)' },
    logoInitials: 'مس',
    logoColor: '#25384F',
    about: {
      ar: 'أسلوب معاصر بخامات فاخرة، وتنفيذ سريع لمن يحتاج دشداشة قبل المناسبة.',
      en: 'A contemporary studio with premium materials and quick turnaround before an occasion.',
    },
    serviceAreas: [
      { ar: 'مسقط', en: 'Muscat' },
      { ar: 'بوشر', en: 'Bawshar' },
      { ar: 'العذيبة', en: 'Azaiba' },
    ],
    productionDays: { min: 3, max: 6 },
    startingPrice: 19,
    offersPickup: true,
    offersDelivery: true,
    deliveryFee: 2.0,
    freeDeliveryOver: 60,
    ratingAverage: null,
    ratingCount: 0,
    measurementTemplateId: 'tpl_om_dishdasha_default',
    fabricIds: [],
    patternIds: [],
    isDemoData: true,
    active: true,
    branches: [
      { id: 'br_atelier_azaiba', tailorBusinessId: 'tlr_muscat_atelier', name: { ar: 'فرع العذيبة', en: 'Azaiba branch' }, area: { ar: 'العذيبة', en: 'Azaiba' }, phone: '+968 0000 0003' },
    ],
  },
  {
    id: 'tlr_nizwa_house',
    name: { ar: 'بيت نزوى للخياطة (تجريبي)', en: 'Nizwa Tailoring House (demo)' },
    logoInitials: 'نز',
    logoColor: '#8A4B32',
    about: {
      ar: 'خياطة اقتصادية موثوقة للاستخدام اليومي، مع أسعار مناسبة للطلبات المتعددة.',
      en: 'Dependable everyday tailoring with prices suited to multi-garment orders.',
    },
    serviceAreas: [
      { ar: 'نزوى', en: 'Nizwa' },
      { ar: 'بهلاء', en: 'Bahla' },
      { ar: 'إزكي', en: 'Izki' },
    ],
    productionDays: { min: 6, max: 10 },
    startingPrice: 11,
    offersPickup: true,
    offersDelivery: false,
    deliveryFee: 0,
    freeDeliveryOver: null,
    ratingAverage: null,
    ratingCount: 0,
    measurementTemplateId: 'tpl_om_dishdasha_quick',
    fabricIds: [],
    patternIds: [],
    isDemoData: true,
    active: true,
    branches: [
      { id: 'br_nizwa_main', tailorBusinessId: 'tlr_nizwa_house', name: { ar: 'الفرع الرئيسي', en: 'Main branch' }, area: { ar: 'نزوى', en: 'Nizwa' }, phone: '+968 0000 0004' },
    ],
  },
];

export const STAFF: StaffMember[] = [
  { id: 'stf_1', tailorBusinessId: 'tlr_al_asalah', branchId: 'br_asalah_ruwi', name: 'Demo Owner', role: 'owner' },
  { id: 'stf_2', tailorBusinessId: 'tlr_al_asalah', branchId: 'br_asalah_ruwi', name: 'Demo Tailor', role: 'tailor' },
  { id: 'stf_3', tailorBusinessId: 'tlr_al_asalah', branchId: 'br_asalah_seeb', name: 'Demo Cutter', role: 'cutter' },
];

export const getTailor = (id: string | null): TailorBusiness | undefined =>
  id ? TAILORS.find((t) => t.id === id) : undefined;

export const activeTailors = () => TAILORS.filter((t) => t.active);
