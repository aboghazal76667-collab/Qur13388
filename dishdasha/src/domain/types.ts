/**
 * Core domain model.
 *
 * GCC EXPANSION RULE: nothing here is named after the Omani dishdasha unless
 * it genuinely is Oman-specific data. The *types* speak about garments,
 * components, zones and templates; only the *data* is Omani today.
 */
import type { Localized } from '@dd/i18n';

export type UUID = string;
export type ISODate = string;
export type Hex = string;

// ── garment system ────────────────────────────────────────────────────────
export type GarmentTypeId =
  | 'OMANI_DISHDASHA'
  // Reserved, deliberately not exposed in the UI yet.
  | 'UAE_KANDURA'
  | 'SAUDI_THOBE'
  | 'KUWAITI_DISHDASHA'
  | 'QATARI_THOBE'
  | 'BAHRAINI_THOBE';

/** A customisable area of a garment. Renderer and pricing both key off these. */
export type CustomizationZoneId =
  | 'body'
  | 'collar'
  | 'placket'
  | 'chest'
  | 'cuff'
  | 'furakha'
  | 'pocket'
  | 'hem';

export type GarmentComponent = {
  id: string;
  zone: CustomizationZoneId;
  label: Localized;
  /** Options the customer may pick for this component. */
  options: GarmentComponentOption[];
  /** When false the component is fixed by the garment definition. */
  customizable: boolean;
};

export type GarmentComponentOption = {
  id: string;
  label: Localized;
  description?: Localized;
  /** Extra charge in the market currency, minor-unit-free decimal number. */
  surcharge: number;
  isDefault?: boolean;
};

export type MeasurementFieldKey = string;

export type MeasurementField = {
  key: MeasurementFieldKey;
  label: Localized;
  /** Short "how to measure" guidance shown next to the illustration. */
  howTo: Localized;
  unit: 'cm' | 'in';
  min: number;
  max: number;
  /** Typical value used to pre-fill and to sanity-check outliers. */
  typical: number;
  required: boolean;
  /** Illustration key consumed by the measurement diagram component. */
  illustration:
    | 'length'
    | 'shoulder'
    | 'chest'
    | 'waist'
    | 'hip'
    | 'sleeve'
    | 'neck'
    | 'armhole'
    | 'cuff'
    | 'bottom'
    | 'custom';
};

/**
 * Tailors measure differently. A workshop selects or defines a template
 * rather than the platform assuming one universal Omani method.
 */
export type MeasurementTemplate = {
  id: string;
  garmentTypeId: GarmentTypeId;
  name: Localized;
  /** Null = platform default template, otherwise owned by a tailor business. */
  tailorBusinessId: UUID | null;
  fields: MeasurementField[];
  allowsCustomFields: boolean;
};

export type GarmentType = {
  id: GarmentTypeId;
  name: Localized;
  country: string;
  /** Only enabled garments render in the customer UI. */
  enabled: boolean;
  zones: CustomizationZoneId[];
  components: GarmentComponent[];
  defaultMeasurementTemplateId: string;
  /** Base tailoring labour price before fabric and embroidery. */
  baseTailoringPrice: number;
};

// ── catalogue ─────────────────────────────────────────────────────────────
export type ColorFamily =
  | 'white'
  | 'beige'
  | 'grey'
  | 'blue'
  | 'green'
  | 'brown'
  | 'black'
  | 'accent';

export type GarmentColor = {
  id: string;
  name: Localized;
  hex: Hex;
  family: ColorFamily;
  /** Perceived lightness 0..100, precomputed for harmony/contrast work. */
  lightness: number;
  active: boolean;
};

export type ThreadColor = {
  id: string;
  name: Localized;
  hex: Hex;
  /** Metallic threads render with a sheen in the configurator. */
  metallic: boolean;
  active: boolean;
};

export type FabricCategory =
  | 'light_summer'
  | 'daily'
  | 'premium'
  | 'formal'
  | 'winter'
  | 'easy_care';

export type Fabric = {
  id: UUID;
  /** Demo brand names. Replaced by real merchant inventory in production. */
  brand: string;
  collection: Localized;
  name: Localized;
  /** Merchant-supplied. Never invented by the platform. */
  origin: string | null;
  composition: string | null;
  category: FabricCategory;
  season: 'summer' | 'winter' | 'all_year';
  weightGsm: number | null;
  texture: FabricTexture;
  sheen: 'matte' | 'soft' | 'satin';
  opacity: 'low' | 'medium' | 'high';
  breathability: 'low' | 'medium' | 'high';
  finish: Localized;
  careNotes: Localized;
  /** Colour ids from the colour catalogue available in this fabric. */
  colorIds: string[];
  pricePerGarment: number;
  inStock: boolean;
  stockMeters: number | null;
  tailorBusinessIds: UUID[];
  isDemoData: boolean;
  active: boolean;
};

/** Drives the procedural swatch/texture overlay in the configurator. */
export type FabricTexture =
  | 'plain_weave'
  | 'fine_twill'
  | 'poplin'
  | 'linen_slub'
  | 'sateen'
  | 'crepe'
  | 'wool_blend';

export type EmbroideryStyleFamily =
  | 'omani_traditional'
  | 'omani_contemporary'
  | 'geometric'
  | 'minimal';

export type EmbroideryChannel = {
  /** 1-based channel index; matches `threadColors[index - 1]` on a design. */
  index: 1 | 2 | 3;
  label: Localized;
  /** Suggested default thread colour id. */
  defaultThreadColorId: string;
};

export type EmbroideryPattern = {
  id: UUID;
  code: string;
  name: Localized;
  collectionId: string;
  styleFamily: EmbroideryStyleFamily;
  /**
   * Motif renderer key. Patterns are vector motifs with per-channel paths so
   * a single thread can be recoloured without touching the rest.
   */
  motif: MotifKey;
  channelCount: 1 | 2 | 3;
  channels: EmbroideryChannel[];
  allowedZones: CustomizationZoneId[];
  surcharge: number;
  tags: string[];
  popularity: number;
  isNew: boolean;
  /** Only set when the merchant has verified the classification. */
  classification: 'traditional' | 'contemporary' | 'unverified';
  tailorBusinessIds: UUID[];
  active: boolean;
};

export type MotifKey =
  | 'none'
  | 'chain_diamond'
  | 'twin_cord'
  | 'palm_frond'
  | 'lattice'
  | 'wave_rope'
  | 'star_knot'
  | 'arch_row'
  | 'fine_pinstripe'
  | 'rope_braid'
  | 'trellis'
  | 'crescent_row'
  | 'zigzag_band'
  | 'floret_chain'
  | 'double_arch'
  | 'square_kufic';

// ── tailors ───────────────────────────────────────────────────────────────
export type TailorBusiness = {
  id: UUID;
  name: Localized;
  logoInitials: string;
  logoColor: Hex;
  about: Localized;
  serviceAreas: Localized[];
  productionDays: { min: number; max: number };
  startingPrice: number;
  offersPickup: boolean;
  offersDelivery: boolean;
  deliveryFee: number;
  freeDeliveryOver: number | null;
  /** Rating architecture exists; no ratings are fabricated for demo data. */
  ratingAverage: number | null;
  ratingCount: number;
  measurementTemplateId: string;
  fabricIds: UUID[];
  patternIds: UUID[];
  branches: Branch[];
  isDemoData: boolean;
  active: boolean;
};

export type Branch = {
  id: UUID;
  tailorBusinessId: UUID;
  name: Localized;
  area: Localized;
  phone: string;
};

export type StaffRole = 'owner' | 'manager' | 'tailor' | 'cutter' | 'delivery';

export type StaffMember = {
  id: UUID;
  tailorBusinessId: UUID;
  branchId: UUID | null;
  name: string;
  role: StaffRole;
};

// ── customer ──────────────────────────────────────────────────────────────
export type AppRole = 'customer' | 'tailor' | 'admin';

export type CustomerProfile = {
  id: UUID;
  name: string;
  phone: string | null;
  email: string | null;
  language: 'ar' | 'en';
  /** Voluntary and optional — only used to bias styling suggestions. */
  ageRange: '18-24' | '25-34' | '35-49' | '50+' | null;
  favoriteTailorId: UUID | null;
  isDemo: boolean;
  createdAt: ISODate;
};

export type Address = {
  id: UUID;
  label: Localized | string;
  line1: string;
  area: string;
  city: string;
  phone: string;
  isDefault: boolean;
};

export type NotificationPreferences = {
  /** Order lifecycle messages. Separate from marketing by design. */
  operational: boolean;
  /** Requires explicit opt-in; defaults to false. */
  marketing: boolean;
  seasonalReminders: boolean;
};

export type PrivacySettings = {
  /** Consent to store an uploaded try-on photo beyond the current session. */
  storeTryOnPhotos: boolean;
  /** Consent to use order history to personalise suggestions. */
  personalisation: boolean;
};

export type MeasurementStatus =
  | 'tailor_verified'
  | 'customer_entered'
  | 'imported'
  | 'needs_review';

export type MeasurementProfile = {
  id: UUID;
  customerId: UUID;
  name: string;
  templateId: string;
  garmentTypeId: GarmentTypeId;
  unit: 'cm' | 'in';
  status: MeasurementStatus;
  measuredBy: string | null;
  tailorBusinessId: UUID | null;
  measuredAt: ISODate;
  notes: string | null;
  fitPreference: 'slim' | 'regular' | 'relaxed';
  values: Record<MeasurementFieldKey, number>;
  /** Tailor-defined extras beyond the template. */
  customValues: { label: string; value: number }[];
  updatedAt: ISODate;
  deletedAt: ISODate | null;
};

// ── design ────────────────────────────────────────────────────────────────
/**
 * The structured configuration IS the product. A rendered image is a
 * derivative artefact and is never the source of truth.
 */
export type DesignConfig = {
  garmentTypeId: GarmentTypeId;
  fabricId: UUID;
  baseColorId: string;
  embroideryPatternId: UUID | null;
  /** One entry per channel of the selected pattern, in channel order. */
  threadColorIds: string[];
  furakhaColorId: string;
  /** componentId -> optionId */
  componentOptions: Record<string, string>;
};

export type Design = {
  id: UUID;
  customerId: UUID;
  name: string;
  config: DesignConfig;
  /** Stable hash of the config; used for preview caching and dedupe. */
  configHash: string;
  measurementProfileId: UUID | null;
  tailorBusinessId: UUID | null;
  aiRecommendationId: UUID | null;
  priceSnapshot: PriceBreakdown | null;
  previewAssetId: UUID | null;
  isFavorite: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt: ISODate | null;
};

// ── pricing ───────────────────────────────────────────────────────────────
export type PriceLine = {
  key:
    | 'fabric'
    | 'tailoring'
    | 'embroidery'
    | 'extras'
    | 'delivery'
    | 'discount'
    | 'tax';
  amount: number;
  /** Extra context, e.g. which component added a surcharge. */
  note?: Localized;
};

export type PriceBreakdown = {
  currency: string;
  lines: PriceLine[];
  subtotal: number;
  total: number;
  /** Null when the merchant has not configured tax for this market. */
  taxRate: number | null;
  quantity: number;
  computedAt: ISODate;
};

// ── cart & orders ─────────────────────────────────────────────────────────
export type CartItem = {
  id: UUID;
  designId: UUID | null;
  config: DesignConfig;
  configHash: string;
  quantity: number;
  measurementProfileId: UUID | null;
  tailorBusinessId: UUID | null;
  notes: string | null;
  addedAt: ISODate;
};

export type FulfilmentMethod = 'pickup' | 'delivery';

export type OrderStatus =
  | 'received'
  | 'confirmed'
  | 'fabric_allocated'
  | 'cutting'
  | 'stitching'
  | 'embroidery'
  | 'finishing'
  | 'quality_check'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type OrderStatusEvent = {
  status: OrderStatus;
  at: ISODate;
  by: string | null;
  note: string | null;
};

export type OrderItem = {
  id: UUID;
  config: DesignConfig;
  configHash: string;
  quantity: number;
  measurementProfileId: UUID | null;
  /** Frozen copy so a later profile edit never rewrites production history. */
  measurementSnapshot: MeasurementProfile | null;
  price: PriceBreakdown;
  notes: string | null;
};

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export type Payment = {
  id: UUID;
  orderId: UUID;
  provider: string;
  providerRef: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  /** True whenever the amount was never actually captured. */
  isSimulated: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type Order = {
  id: UUID;
  number: string;
  customerId: UUID;
  tailorBusinessId: UUID;
  branchId: UUID | null;
  items: OrderItem[];
  status: OrderStatus;
  history: OrderStatusEvent[];
  fulfilment: FulfilmentMethod;
  addressId: UUID | null;
  addressSnapshot: Address | null;
  price: PriceBreakdown;
  payment: Payment | null;
  expectedReadyAt: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type AlterationType =
  | 'shorten'
  | 'lengthen'
  | 'sleeve'
  | 'width'
  | 'neck'
  | 'other';

export type Alteration = {
  id: UUID;
  orderId: UUID;
  orderItemId: UUID;
  customerId: UUID;
  type: AlterationType;
  /** Signed delta in the profile's unit, e.g. -1 for "1 cm shorter". */
  delta: number | null;
  /** Which measurement field the delta applies to, when known. */
  measurementFieldKey: MeasurementFieldKey | null;
  notes: string | null;
  status: 'requested' | 'in_progress' | 'completed';
  /** Set only after the customer explicitly approves the profile update. */
  appliedToMeasurementProfileId: UUID | null;
  createdAt: ISODate;
};

// ── AI ────────────────────────────────────────────────────────────────────
export type Occasion =
  | 'daily'
  | 'work'
  | 'friday'
  | 'eid'
  | 'wedding'
  | 'formal'
  | 'special';

export type Season = 'summer' | 'winter' | 'all_year';

export type StylePersonality =
  | 'classic'
  | 'calm'
  | 'luxe'
  | 'modern'
  | 'bold'
  | 'formal';

export type PaletteSuggestion = {
  id: UUID;
  baseColorId: string;
  threadColorIds: string[];
  furakhaColorId: string;
  suggestedPatternId: UUID | null;
  personality: StylePersonality;
  /** Recommendation affinity 0..1 — NOT a scientific fit measure. */
  matchScore: number;
  harmony: HarmonyKind;
  reason: Localized;
  occasion: Occasion;
  season: Season;
  source: 'harmony_engine' | 'llm' | 'curated';
};

export type HarmonyKind =
  | 'analogous'
  | 'complementary'
  | 'split_complementary'
  | 'monochromatic'
  | 'tonal'
  | 'neutral_accent';

export type AiGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type AiGenerationLog = {
  id: UUID;
  kind: 'palette' | 'preview' | 'try_on' | 'color_extraction' | 'measurement';
  provider: string;
  model: string;
  status: AiGenerationStatus;
  latencyMs: number;
  /** Architecture for cost accounting; mock providers report 0. */
  estimatedCost: number;
  /** Hash of the design, never the design's private imagery. */
  inputHash: string;
  error: string | null;
  createdAt: ISODate;
};

export type PreviewAsset = {
  id: UUID;
  designHash: string;
  uri: string;
  quality: 'low' | 'high';
  /** True while produced by the mock provider. Surfaced in the UI. */
  isSimulated: boolean;
  createdAt: ISODate;
};

export type PhotoAsset = {
  id: UUID;
  customerId: UUID;
  purpose: 'kumma_match' | 'try_on';
  uri: string;
  /** Photos are session-scoped unless the customer explicitly saves them. */
  persisted: boolean;
  consentAt: ISODate;
  createdAt: ISODate;
};

// ── style memory ──────────────────────────────────────────────────────────
export type StyleMemory = {
  customerId: UUID;
  favoriteFabricIds: UUID[];
  favoriteColorIds: string[];
  favoritePatternIds: UUID[];
  favoriteThreadColorIds: string[];
  preferredFit: 'slim' | 'regular' | 'relaxed' | null;
  preferredTailorId: UUID | null;
  typicalQuantity: number;
  /** How ornate the customer tends to go, 0 (plain) .. 1 (heavily embroidered). */
  embroideryIntensity: number;
  seasonalPreference: Partial<Record<Season, string[]>>;
  orderCount: number;
  lastOrderAt: ISODate | null;
  updatedAt: ISODate;
};

// ── analytics ─────────────────────────────────────────────────────────────
export type AnalyticsEventName =
  | 'app_open'
  | 'design_started'
  | 'fabric_selected'
  | 'color_selected'
  | 'embroidery_selected'
  | 'thread_color_changed'
  | 'ai_stylist_used'
  | 'ai_palette_applied'
  | 'preview_generated'
  | 'design_saved'
  | 'design_compared'
  | 'measurement_saved'
  | 'checkout_started'
  | 'payment_success'
  | 'payment_failed'
  | 'order_created'
  | 'reorder_clicked'
  | 'alteration_requested'
  | 'kumma_match_used';

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  props: Record<string, string | number | boolean | null>;
  at: ISODate;
};
