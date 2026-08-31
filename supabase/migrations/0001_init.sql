-- =============================================================================
-- OMANI DISHDASHA AI — initial schema
--
-- Naming rule: tables describe GARMENTS, COMPONENTS, ZONES and TEMPLATES, not
-- the Omani dishdasha specifically. Only the seeded ROWS are Omani. Adding a
-- UAE kandura later is an INSERT plus assets, never a migration of the core.
--
-- Every table carries created_at / updated_at; user-owned rows that production
-- history references are soft-deleted (deleted_at) so an order can never lose
-- the measurement it was cut from.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ── enums ────────────────────────────────────────────────────────────────────
create type app_role as enum ('customer', 'tailor_staff', 'admin');
create type staff_role as enum ('owner', 'manager', 'tailor', 'cutter', 'delivery');
create type measurement_status as enum ('tailor_verified', 'customer_entered', 'imported', 'needs_review');
create type fit_preference as enum ('slim', 'regular', 'relaxed');
create type order_status as enum (
  'received', 'confirmed', 'fabric_allocated', 'cutting', 'stitching',
  'embroidery', 'finishing', 'quality_check', 'ready', 'out_for_delivery',
  'delivered', 'cancelled'
);
create type payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
create type fulfilment_method as enum ('pickup', 'delivery');
create type alteration_type as enum ('shorten', 'lengthen', 'sleeve', 'width', 'neck', 'other');
create type photo_purpose as enum ('kumma_match', 'try_on');
create type ai_generation_kind as enum ('palette', 'preview', 'try_on', 'color_extraction', 'measurement');

-- ── helper: updated_at ───────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── identity ─────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  email text,
  language text not null default 'ar' check (language in ('ar', 'en')),
  -- Voluntary and nullable; only ever used to bias styling suggestions.
  age_range text check (age_range in ('18-24', '25-34', '35-49', '50+')),
  role app_role not null default 'customer',
  favorite_tailor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table customer_preferences (
  customer_id uuid primary key references profiles on delete cascade,
  preferred_fit fit_preference,
  preferred_tailor_id uuid,
  favorite_fabric_ids text[] not null default '{}',
  favorite_color_ids text[] not null default '{}',
  favorite_pattern_ids text[] not null default '{}',
  favorite_thread_color_ids text[] not null default '{}',
  embroidery_intensity numeric(3,2) not null default 0,
  typical_quantity int not null default 1,
  seasonal_preference jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table notification_preferences (
  customer_id uuid primary key references profiles on delete cascade,
  operational boolean not null default true,
  -- Marketing consent is opt-in and stored separately from operational
  -- messages on purpose: one must never imply the other.
  marketing boolean not null default false,
  seasonal_reminders boolean not null default false,
  marketing_consent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles on delete cascade,
  label text not null,
  line1 text not null,
  area text,
  city text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ── tenants ──────────────────────────────────────────────────────────────────
create table tailor_businesses (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  about_ar text,
  about_en text,
  logo_color text,
  logo_initials text,
  service_areas jsonb not null default '[]'::jsonb,
  production_days_min int not null default 5,
  production_days_max int not null default 10,
  starting_price numeric(10,3) not null default 0,
  offers_pickup boolean not null default true,
  offers_delivery boolean not null default false,
  delivery_fee numeric(10,3) not null default 0,
  free_delivery_over numeric(10,3),
  -- Ratings stay null until real reviews exist; never seeded.
  rating_average numeric(3,2),
  rating_count int not null default 0,
  measurement_template_id uuid,
  -- Merchant-controlled: the platform never assumes a tax rate.
  tax_rate numeric(5,4),
  is_demo_data boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  tailor_business_id uuid not null references tailor_businesses on delete cascade,
  name_ar text not null,
  name_en text not null,
  area text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tailor_business_id uuid not null references tailor_businesses on delete cascade,
  branch_id uuid references branches on delete set null,
  role staff_role not null default 'tailor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, tailor_business_id)
);

-- ── garment system (GCC-generic) ─────────────────────────────────────────────
create table garment_types (
  id text primary key,                 -- e.g. 'OMANI_DISHDASHA'
  name_ar text not null,
  name_en text not null,
  country text not null,
  enabled boolean not null default false,
  base_tailoring_price numeric(10,3) not null default 0,
  default_measurement_template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customization_zones (
  id text primary key,                 -- 'collar', 'placket', 'cuff', 'furakha'…
  name_ar text not null,
  name_en text not null
);

create table garment_components (
  id uuid primary key default gen_random_uuid(),
  garment_type_id text not null references garment_types on delete cascade,
  zone_id text not null references customization_zones,
  key text not null,
  name_ar text not null,
  name_en text not null,
  customizable boolean not null default true,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garment_type_id, key)
);

create table measurement_templates (
  id uuid primary key default gen_random_uuid(),
  garment_type_id text not null references garment_types on delete cascade,
  -- null = platform default template; otherwise owned by one workshop, because
  -- tailors genuinely measure differently.
  tailor_business_id uuid references tailor_businesses on delete cascade,
  name_ar text not null,
  name_en text not null,
  allows_custom_fields boolean not null default true,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── catalogue ────────────────────────────────────────────────────────────────
create table garment_colors (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  hex text not null check (hex ~ '^#[0-9A-F]{6}$'),
  family text not null,
  lightness int not null default 50,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table thread_colors (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  hex text not null check (hex ~ '^#[0-9A-F]{6}$'),
  metallic boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fabrics (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  collection_ar text,
  collection_en text,
  name_ar text not null,
  name_en text not null,
  origin text,
  composition text,
  category text not null,
  season text not null default 'all_year',
  weight_gsm int,
  texture text not null default 'plain_weave',
  sheen text not null default 'matte',
  opacity text,
  breathability text,
  finish_ar text,
  finish_en text,
  care_notes_ar text,
  care_notes_en text,
  price_per_garment numeric(10,3) not null default 0,
  in_stock boolean not null default true,
  stock_meters numeric(10,2),
  is_demo_data boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table fabric_colors (
  fabric_id uuid not null references fabrics on delete cascade,
  color_id text not null references garment_colors on delete cascade,
  in_stock boolean not null default true,
  primary key (fabric_id, color_id)
);

create table embroidery_collections (
  id text primary key,
  name_ar text not null,
  name_en text not null
);

create table embroidery_patterns (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name_ar text not null,
  name_en text not null,
  collection_id text references embroidery_collections,
  style_family text not null,
  -- Vector motif key resolved by the client renderer, or a stored asset.
  motif text not null,
  vector_asset_path text,
  preview_image_path text,
  channel_count int not null check (channel_count between 1 and 3),
  allowed_zones text[] not null default '{}',
  surcharge numeric(10,3) not null default 0,
  tags text[] not null default '{}',
  popularity int not null default 0,
  is_new boolean not null default false,
  -- 'unverified' unless the merchant has actually confirmed the classification.
  classification text not null default 'unverified'
    check (classification in ('traditional', 'contemporary', 'unverified')),
  -- null = platform catalogue; set when a workshop uploads its own patterns.
  owner_tailor_business_id uuid references tailor_businesses on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table embroidery_color_channels (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references embroidery_patterns on delete cascade,
  channel_index int not null check (channel_index between 1 and 3),
  label_ar text not null,
  label_en text not null,
  default_thread_color_id text references thread_colors,
  unique (pattern_id, channel_index)
);

-- Which workshop offers which catalogue item, and at what price.
create table tailor_fabrics (
  tailor_business_id uuid not null references tailor_businesses on delete cascade,
  fabric_id uuid not null references fabrics on delete cascade,
  price_override numeric(10,3),
  available boolean not null default true,
  primary key (tailor_business_id, fabric_id)
);

create table tailor_embroidery_patterns (
  tailor_business_id uuid not null references tailor_businesses on delete cascade,
  pattern_id uuid not null references embroidery_patterns on delete cascade,
  surcharge_override numeric(10,3),
  available boolean not null default true,
  primary key (tailor_business_id, pattern_id)
);

-- ── measurements ─────────────────────────────────────────────────────────────
create table measurement_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles on delete cascade,
  garment_type_id text not null references garment_types,
  template_id uuid not null references measurement_templates,
  name text not null,
  unit text not null default 'cm' check (unit in ('cm', 'in')),
  status measurement_status not null default 'customer_entered',
  measured_by text,
  tailor_business_id uuid references tailor_businesses on delete set null,
  measured_at timestamptz not null default now(),
  fit_preference fit_preference not null default 'regular',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete only: orders reference these profiles.
  deleted_at timestamptz
);

create table measurement_values (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references measurement_profiles on delete cascade,
  field_key text not null,
  value numeric(6,2) not null,
  -- Set when the field is a workshop's own extra measurement.
  custom_label text,
  unique (profile_id, field_key)
);

-- ── designs ──────────────────────────────────────────────────────────────────
create table designs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles on delete cascade,
  name text not null,
  garment_type_id text not null references garment_types,
  -- The structured configuration IS the product; a rendered image never is.
  config jsonb not null,
  config_hash text not null,
  measurement_profile_id uuid references measurement_profiles on delete set null,
  tailor_business_id uuid references tailor_businesses on delete set null,
  ai_recommendation_id uuid,
  price_snapshot jsonb,
  preview_asset_id uuid,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index designs_customer_idx on designs (customer_id) where deleted_at is null;
create index designs_hash_idx on designs (config_hash);

-- Normalised view of a design's zones, for analytics and tailor reporting.
create table design_components (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs on delete cascade,
  zone_id text not null references customization_zones,
  component_key text not null,
  option_id text,
  color_id text,
  thread_color_id text,
  channel_index int
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles on delete cascade,
  kind text not null check (kind in ('design', 'fabric', 'pattern', 'palette', 'tailor')),
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (customer_id, kind, target_id)
);

-- ── cart & orders ────────────────────────────────────────────────────────────
create table carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles on delete cascade,
  tailor_business_id uuid references tailor_businesses on delete set null,
  fulfilment fulfilment_method not null default 'pickup',
  address_id uuid references addresses on delete set null,
  discount_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts on delete cascade,
  design_id uuid references designs on delete set null,
  config jsonb not null,
  config_hash text not null,
  quantity int not null default 1 check (quantity between 1 and 50),
  measurement_profile_id uuid references measurement_profiles on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references profiles on delete restrict,
  tailor_business_id uuid not null references tailor_businesses on delete restrict,
  branch_id uuid references branches on delete set null,
  status order_status not null default 'received',
  fulfilment fulfilment_method not null default 'pickup',
  address_id uuid references addresses on delete set null,
  -- Snapshot, because an address edited later must not rewrite a delivery.
  address_snapshot jsonb,
  price jsonb not null,
  currency text not null default 'OMR',
  total numeric(10,3) not null,
  expected_ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on orders (customer_id);
create index orders_tailor_status_idx on orders (tailor_business_id, status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  config jsonb not null,
  config_hash text not null,
  quantity int not null default 1,
  measurement_profile_id uuid references measurement_profiles on delete set null,
  -- Frozen copy: production history must never change under the workshop.
  measurement_snapshot jsonb,
  price jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  status order_status not null,
  changed_by uuid references auth.users on delete set null,
  note text,
  at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  provider text not null,
  provider_ref text,
  session_id text,
  amount numeric(10,3) not null,
  currency text not null default 'OMR',
  status payment_status not null default 'unpaid',
  -- True whenever no money actually moved (mock provider, test mode).
  is_simulated boolean not null default false,
  -- Raw verified webhook payload; the ONLY thing allowed to set status='paid'.
  webhook_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on payments (order_id);

create table alterations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  order_item_id uuid references order_items on delete set null,
  customer_id uuid not null references profiles on delete cascade,
  type alteration_type not null,
  delta numeric(5,2),
  measurement_field_key text,
  notes text,
  status text not null default 'requested' check (status in ('requested', 'in_progress', 'completed')),
  -- Set ONLY after the customer explicitly approves the profile update.
  applied_to_measurement_profile_id uuid references measurement_profiles on delete set null,
  approved_by_customer_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── AI & assets ──────────────────────────────────────────────────────────────
create table ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles on delete cascade,
  occasion text,
  season text,
  time_of_day text,
  base_color_id text,
  thread_color_ids text[] not null default '{}',
  furakha_color_id text,
  suggested_pattern_id uuid references embroidery_patterns on delete set null,
  personality text,
  harmony text,
  -- Recommendation affinity, NOT a measured fit score.
  match_score numeric(3,2),
  reason_ar text,
  reason_en text,
  source text not null default 'harmony_engine',
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles on delete set null,
  kind ai_generation_kind not null,
  provider text not null,
  model text not null,
  status text not null default 'queued',
  latency_ms int,
  estimated_cost numeric(10,6) not null default 0,
  -- A design hash only. Never a photo URI, a measurement or free text.
  input_hash text,
  error text,
  created_at timestamptz not null default now()
);

create table preview_assets (
  id uuid primary key default gen_random_uuid(),
  design_hash text not null,
  storage_path text not null,
  quality text not null default 'low' check (quality in ('low', 'high')),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (design_hash, quality)
);

create table photo_assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles on delete cascade,
  purpose photo_purpose not null,
  -- Private bucket; served only through short-lived signed URLs.
  storage_path text not null,
  -- Session-scoped unless the customer explicitly chose to keep it.
  persisted boolean not null default false,
  consent_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index photo_assets_expiry_idx on photo_assets (expires_at) where persisted = false;

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

-- ── updated_at triggers ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'addresses', 'tailor_businesses', 'branches', 'staff_members',
    'garment_types', 'garment_components', 'measurement_templates',
    'garment_colors', 'thread_colors', 'fabrics', 'embroidery_patterns',
    'measurement_profiles', 'designs', 'carts', 'cart_items', 'orders',
    'payments', 'alterations'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
       for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
