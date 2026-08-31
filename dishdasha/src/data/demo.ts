import { defaultComponentOptions } from '@dd/domain/garments';
import { OMANI_DISHDASHA } from '@dd/domain/garments';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import { getTailor } from '@dd/data/tailors';
import { calculatePrice } from '@dd/engine/pricing';
import { hashConfig, normalizeConfig } from '@dd/engine/design';
import type {
  Address,
  CustomerProfile,
  Design,
  DesignConfig,
  MeasurementProfile,
  NotificationPreferences,
  Order,
  OrderItem,
  PrivacySettings,
} from '@dd/domain/types';
import { addDays } from '@dd/utils/date';

/**
 * PRELOADED DEMO CUSTOMER.
 *
 * The point of this file is that the home screen is *personal* the first time
 * it is opened: a returning customer with tailor-verified measurements, a
 * usual off-white dishdasha, two embroidery favourites and real order history.
 * An empty app cannot demonstrate the product's actual thesis.
 */
export const DEMO_CUSTOMER_ID = 'cus_demo_001';

const daysAgo = (n: number) => addDays(new Date().toISOString(), -n);

export const DEMO_CUSTOMER: CustomerProfile = {
  id: DEMO_CUSTOMER_ID,
  name: 'سالم',
  phone: '+968 9000 0000',
  email: 'demo@example.om',
  language: 'ar',
  ageRange: '35-49',
  favoriteTailorId: 'tlr_al_asalah',
  isDemo: true,
  createdAt: daysAgo(420),
};

export const DEMO_NOTIFICATION_PREFS: NotificationPreferences = {
  operational: true,
  // Marketing consent is off until the customer opts in. Never pre-ticked.
  marketing: false,
  seasonalReminders: false,
};

export const DEMO_PRIVACY: PrivacySettings = {
  storeTryOnPhotos: false,
  personalisation: true,
};

export const DEMO_ADDRESSES: Address[] = [
  {
    id: 'adr_demo_home',
    label: { ar: 'المنزل', en: 'Home' },
    line1: 'طريق السلطان قابوس، مبنى 12',
    area: 'الخوير',
    city: 'مسقط',
    phone: '+968 9000 0000',
    isDefault: true,
  },
  {
    id: 'adr_demo_work',
    label: { ar: 'العمل', en: 'Work' },
    line1: 'برج التجارة، الطابق 4',
    area: 'القرم',
    city: 'مسقط',
    phone: '+968 9000 0001',
    isDefault: false,
  },
];

export const DEMO_MEASUREMENTS: MeasurementProfile[] = [
  {
    id: 'msr_demo_current',
    customerId: DEMO_CUSTOMER_ID,
    name: 'مقاسي الحالي',
    templateId: 'tpl_om_dishdasha_default',
    garmentTypeId: 'OMANI_DISHDASHA',
    unit: 'cm',
    status: 'tailor_verified',
    measuredBy: 'خياط الأصالة — فرع روي',
    tailorBusinessId: 'tlr_al_asalah',
    measuredAt: daysAgo(95),
    notes: 'يفضل الكم أطول قليلاً من المعتاد.',
    fitPreference: 'regular',
    values: {
      total_length: 146,
      shoulder: 47,
      chest: 104,
      waist: 98,
      seat: 102,
      sleeve_length: 62,
      neck: 41,
      armhole: 49,
      cuff_width: 24,
      bottom_width: 132,
    },
    customValues: [{ label: 'ارتفاع الفراخة', value: 18 }],
    updatedAt: daysAgo(95),
    deletedAt: null,
  },
  {
    id: 'msr_demo_formal',
    customerId: DEMO_CUSTOMER_ID,
    name: 'مقاس رسمي',
    templateId: 'tpl_om_dishdasha_default',
    garmentTypeId: 'OMANI_DISHDASHA',
    unit: 'cm',
    status: 'customer_entered',
    measuredBy: null,
    tailorBusinessId: null,
    measuredAt: daysAgo(30),
    notes: 'أضيق قليلاً للمناسبات.',
    fitPreference: 'slim',
    values: {
      total_length: 147,
      shoulder: 46,
      chest: 101,
      waist: 95,
      seat: 100,
      sleeve_length: 62,
      neck: 40,
      armhole: 48,
      cuff_width: 23,
      bottom_width: 126,
    },
    customValues: [],
    updatedAt: daysAgo(30),
    deletedAt: null,
  },
];

const cfg = (partial: Partial<DesignConfig>): DesignConfig =>
  normalizeConfig({
    garmentTypeId: 'OMANI_DISHDASHA',
    fabricId: 'fab_nasim_cotton',
    baseColorId: 'col_off_white',
    embroideryPatternId: 'emb_01',
    threadColorIds: ['th_navy', 'th_silver'],
    furakhaColorId: 'th_navy',
    componentOptions: defaultComponentOptions(OMANI_DISHDASHA),
    ...partial,
  });

/** The customer's signature configuration — drives "order my usual". */
export const DEMO_USUAL_CONFIG = cfg({});

const priceFor = (config: DesignConfig, quantity: number, tailorId: string) =>
  calculatePrice({
    config,
    fabric: getFabric(config.fabricId),
    pattern: getPattern(config.embroideryPatternId),
    tailor: getTailor(tailorId),
    quantity,
    fulfilment: 'pickup',
  });

const item = (
  id: string,
  config: DesignConfig,
  quantity: number,
  tailorId: string,
  measurement: MeasurementProfile,
): OrderItem => ({
  id,
  config,
  configHash: hashConfig(config),
  quantity,
  measurementProfileId: measurement.id,
  measurementSnapshot: measurement,
  price: priceFor(config, quantity, tailorId),
  notes: null,
});

export const DEMO_ORDERS: Order[] = [
  {
    id: 'ord_demo_3',
    number: 'OD-2508-7412',
    customerId: DEMO_CUSTOMER_ID,
    tailorBusinessId: 'tlr_al_asalah',
    branchId: 'br_asalah_ruwi',
    items: [item('oit_3', DEMO_USUAL_CONFIG, 2, 'tlr_al_asalah', DEMO_MEASUREMENTS[0])],
    status: 'stitching',
    history: [
      { status: 'received', at: daysAgo(6), by: null, note: null },
      { status: 'confirmed', at: daysAgo(6), by: 'Demo Owner', note: null },
      { status: 'fabric_allocated', at: daysAgo(5), by: 'Demo Cutter', note: null },
      { status: 'cutting', at: daysAgo(4), by: 'Demo Cutter', note: null },
      { status: 'stitching', at: daysAgo(2), by: 'Demo Tailor', note: null },
    ],
    fulfilment: 'pickup',
    addressId: null,
    addressSnapshot: null,
    price: priceFor(DEMO_USUAL_CONFIG, 2, 'tlr_al_asalah'),
    payment: {
      id: 'pay_demo_3',
      orderId: 'ord_demo_3',
      provider: 'mock',
      providerRef: 'sim_demo0003',
      amount: priceFor(DEMO_USUAL_CONFIG, 2, 'tlr_al_asalah').total,
      currency: 'OMR',
      status: 'paid',
      isSimulated: true,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
    expectedReadyAt: addDays(new Date().toISOString(), 2),
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
  },
  {
    id: 'ord_demo_2',
    number: 'OD-2506-3180',
    customerId: DEMO_CUSTOMER_ID,
    tailorBusinessId: 'tlr_al_asalah',
    branchId: 'br_asalah_ruwi',
    items: [
      item(
        'oit_2',
        cfg({
          fabricId: 'fab_amjad_premium',
          baseColorId: 'col_ivory',
          embroideryPatternId: 'emb_03',
          threadColorIds: ['th_deep_green', 'th_gold', 'th_ivory'],
          furakhaColorId: 'th_gold',
        }),
        1,
        'tlr_al_asalah',
        DEMO_MEASUREMENTS[0],
      ),
    ],
    status: 'delivered',
    history: [
      { status: 'received', at: daysAgo(74), by: null, note: null },
      { status: 'confirmed', at: daysAgo(74), by: 'Demo Owner', note: null },
      { status: 'ready', at: daysAgo(67), by: 'Demo Tailor', note: null },
      { status: 'delivered', at: daysAgo(66), by: 'Demo Owner', note: null },
    ],
    fulfilment: 'pickup',
    addressId: null,
    addressSnapshot: null,
    price: priceFor(
      cfg({ fabricId: 'fab_amjad_premium', baseColorId: 'col_ivory', embroideryPatternId: 'emb_03', threadColorIds: ['th_deep_green', 'th_gold', 'th_ivory'] }),
      1,
      'tlr_al_asalah',
    ),
    payment: null,
    expectedReadyAt: daysAgo(67),
    createdAt: daysAgo(74),
    updatedAt: daysAgo(66),
  },
  {
    id: 'ord_demo_1',
    number: 'OD-2503-9055',
    customerId: DEMO_CUSTOMER_ID,
    tailorBusinessId: 'tlr_muscat_atelier',
    branchId: 'br_atelier_azaiba',
    items: [
      item(
        'oit_1',
        cfg({
          fabricId: 'fab_sahil_poplin',
          baseColorId: 'col_soft_white',
          embroideryPatternId: 'emb_08',
          threadColorIds: ['th_pearl_grey'],
          furakhaColorId: 'th_pearl_grey',
        }),
        3,
        'tlr_muscat_atelier',
        DEMO_MEASUREMENTS[0],
      ),
    ],
    status: 'delivered',
    history: [
      { status: 'received', at: daysAgo(160), by: null, note: null },
      { status: 'confirmed', at: daysAgo(159), by: null, note: null },
      { status: 'delivered', at: daysAgo(150), by: null, note: null },
    ],
    fulfilment: 'delivery',
    addressId: 'adr_demo_home',
    addressSnapshot: DEMO_ADDRESSES[0],
    price: priceFor(
      cfg({ fabricId: 'fab_sahil_poplin', baseColorId: 'col_soft_white', embroideryPatternId: 'emb_08', threadColorIds: ['th_pearl_grey'] }),
      3,
      'tlr_muscat_atelier',
    ),
    payment: null,
    expectedReadyAt: daysAgo(152),
    createdAt: daysAgo(160),
    updatedAt: daysAgo(150),
  },
];

const design = (
  id: string,
  name: string,
  config: DesignConfig,
  isFavorite: boolean,
  ageDays: number,
): Design => ({
  id,
  customerId: DEMO_CUSTOMER_ID,
  name,
  config,
  configHash: hashConfig(config),
  measurementProfileId: 'msr_demo_current',
  tailorBusinessId: 'tlr_al_asalah',
  aiRecommendationId: null,
  priceSnapshot: priceFor(config, 1, 'tlr_al_asalah'),
  previewAssetId: null,
  isFavorite,
  createdAt: daysAgo(ageDays),
  updatedAt: daysAgo(ageDays),
  deletedAt: null,
});

export const DEMO_DESIGNS: Design[] = [
  design('dsg_demo_1', 'دشداشتي المعتادة', DEMO_USUAL_CONFIG, true, 90),
  design(
    'dsg_demo_2',
    'العيد — أخضر وذهبي',
    cfg({
      fabricId: 'fab_amjad_premium',
      baseColorId: 'col_ivory',
      embroideryPatternId: 'emb_03',
      threadColorIds: ['th_deep_green', 'th_gold', 'th_ivory'],
      furakhaColorId: 'th_gold',
    }),
    true,
    60,
  ),
  design(
    'dsg_demo_3',
    'رسمي رمادي',
    cfg({
      fabricId: 'fab_bahja_twill',
      baseColorId: 'col_stone_grey',
      embroideryPatternId: 'emb_04',
      threadColorIds: ['th_graphite', 'th_platinum'],
      furakhaColorId: 'th_graphite',
    }),
    false,
    28,
  ),
  design(
    'dsg_demo_4',
    'صيفي خفيف',
    cfg({
      fabricId: 'fab_reeh_linen',
      baseColorId: 'col_sand',
      embroideryPatternId: 'emb_09',
      threadColorIds: ['th_ivory', 'th_sand'],
      furakhaColorId: 'th_ivory',
    }),
    false,
    14,
  ),
  design(
    'dsg_demo_5',
    'كحلي شتوي',
    cfg({
      fabricId: 'fab_jabal_winter',
      baseColorId: 'col_navy',
      embroideryPatternId: 'emb_14',
      threadColorIds: ['th_platinum', 'th_pearl_grey'],
      furakhaColorId: 'th_platinum',
    }),
    false,
    7,
  ),
];

export const DEMO_FAVORITE_PATTERN_IDS = ['emb_01', 'emb_03'];
export const DEMO_FAVORITE_FABRIC_IDS = ['fab_nasim_cotton', 'fab_amjad_premium'];
