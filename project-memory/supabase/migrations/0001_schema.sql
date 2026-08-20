-- Project Memory — core schema.
--
-- Design notes that matter for the next twenty years:
--
--   * Content is modelled as `assets` with a `kind`, not as columns on
--     `memories`. Video, audio, stories, print files and QR references all
--     arrive as new kinds — never as a migration of existing rows.
--   * Everything a family owns carries `family_id`. It is the single column
--     row-level security keys off, which is what makes the privacy rules
--     short enough to be obviously correct.
--   * UUID primary keys throughout, generated client-side where useful so a
--     memory can be created offline and reconciled later.

create extension if not exists "pgcrypto";

-- Keeps `updated_at` honest without every writer remembering to set it.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

/* ------------------------------------------------------------- people ---- */

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  language text not null default 'en' check (language in ('en', 'ar')),
  -- Internal staff. Never settable from the app; granted by an operator.
  is_staff boolean not null default false,
  -- Off unless the parent explicitly turns it on. See PRIVACY.md.
  allows_model_training boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references profiles(id) on delete cascade,
  -- Opt-in occasions. Nothing is assumed to be universal.
  occasion_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table family_members (
  family_id uuid not null references families(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'parent' check (role in ('owner', 'parent', 'guardian', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (family_id, profile_id)
);

create index family_members_profile_idx on family_members (profile_id);

create table children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  -- First name only. We deliberately never ask for a surname.
  first_name text not null check (length(first_name) between 1 and 60),
  nickname text,
  date_of_birth date not null,
  avatar_asset_id uuid,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index children_family_idx on children (family_id, date_of_birth);

/* ----------------------------------------------------------- memories ---- */

create table memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  -- Text plus a check rather than an enum: adding a kind should be a one-line
  -- migration, not an ALTER TYPE that locks the table.
  kind text not null default 'custom' check (kind in (
    'birth', 'birthday', 'first_day', 'family_moment',
    'holiday', 'achievement', 'milestone', 'custom'
  )),
  title text not null check (length(title) between 1 and 200),
  occurred_on date not null,
  note text,
  -- The seed of the time capsule feature.
  future_message text,
  cover_asset_id uuid,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memories_child_idx on memories (child_id, occurred_on desc);
create index memories_family_idx on memories (family_id, occurred_on desc);

/* ------------------------------------------------------------- assets ---- */

create table assets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  memory_id uuid references memories(id) on delete cascade,
  kind text not null check (kind in (
    'photo', 'photo_processed', 'avatar', 'video', 'audio',
    'document', 'model_3d', 'model_preview', 'print_file', 'story_page'
  )),
  -- Path inside the private bucket. Never a public URL.
  storage_path text not null unique,
  mime_type text not null,
  width integer,
  height integer,
  byte_size bigint,
  duration_ms integer,
  -- Per-kind extras, so a new field costs no migration.
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_memory_idx on assets (memory_id, created_at);
create index assets_child_idx on assets (child_id);
create index assets_family_idx on assets (family_id);

alter table children
  add constraint children_avatar_fk
  foreign key (avatar_asset_id) references assets(id) on delete set null;

alter table memories
  add constraint memories_cover_fk
  foreign key (cover_asset_id) references assets(id) on delete set null;

create table photo_quality_reports (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references assets(id) on delete cascade,
  -- Which analyzer produced this, so scores stay comparable as we improve it.
  analyzer_id text not null,
  analyzer_version text not null,
  overall_score integer not null check (overall_score between 0 and 100),
  verdict text not null check (verdict in ('excellent', 'good', 'fair', 'poor')),
  dimensions jsonb not null default '[]'::jsonb,
  summary text not null default '',
  advice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ----------------------------------------------------------------- 3D ---- */

create table three_d_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  memory_id uuid not null references memories(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  status text not null default 'uploaded' check (status in (
    'uploaded', 'image_checked', 'generating', 'raw_model_ready',
    'quality_review', 'printability_check', 'approved', 'print_ready',
    'ordered', 'printing', 'shipped', 'delivered', 'failed'
  )),
  -- Null until the router picks one, so we can see unrouted jobs.
  provider_key text,
  provider_job_id text,
  -- Multi-view from day one: 1–5 photos of the same child.
  source_asset_ids uuid[] not null default '{}',
  progress numeric(4, 3) not null default 0 check (progress between 0 and 1),
  stage_index smallint not null default 0,
  error_code text,
  -- A retry never destroys the memory or the photos; it chains to the old job.
  retry_of_job_id uuid references three_d_jobs(id) on delete set null,
  attempt smallint not null default 1,
  params jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index three_d_jobs_memory_idx on three_d_jobs (memory_id, created_at desc);
create index three_d_jobs_family_idx on three_d_jobs (family_id, created_at desc);
create index three_d_jobs_status_idx on three_d_jobs (status, created_at desc);

create table three_d_models (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references three_d_jobs(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  memory_id uuid not null references memories(id) on delete cascade,
  format text not null default 'glb' check (format in ('glb', 'obj', 'stl', '3mf')),
  -- The heavy source file; never downloaded to a phone by default.
  asset_id uuid references assets(id) on delete set null,
  -- The lightweight thing the phone actually shows.
  preview_asset_id uuid references assets(id) on delete set null,
  turntable_asset_ids uuid[] not null default '{}',
  polycount integer,
  printability jsonb,
  is_print_ready boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index three_d_models_memory_idx on three_d_models (memory_id);

-- One row per outbound provider call. This is the cost and reliability data
-- the AI router will eventually use to choose between providers.
create table provider_calls (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references three_d_jobs(id) on delete cascade,
  provider_key text not null,
  model text,
  operation text not null check (operation in ('generate', 'status', 'download', 'printability')),
  duration_ms integer not null default 0,
  success boolean not null,
  http_status integer,
  credits_used numeric(12, 4),
  estimated_cost_usd numeric(12, 6),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_calls_job_idx on provider_calls (job_id);
create index provider_calls_provider_idx on provider_calls (provider_key, created_at desc);

-- Human QA. An AI pipeline with no person in front of a physical product is
-- not a pipeline we ship.
create table qa_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references three_d_jobs(id) on delete cascade,
  model_id uuid references three_d_models(id) on delete set null,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  decision text not null check (decision in (
    'approved', 'needs_regeneration', 'needs_manual_adjustment', 'rejected'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index qa_reviews_job_idx on qa_reviews (job_id);

/* ------------------------------------------------ future feature hooks ---- */

create table stories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'failed')),
  title text,
  theme text,
  interests text[] not null default '{}',
  values text[] not null default '{}',
  page_count smallint not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table story_pages (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  page_number smallint not null,
  body text,
  illustration_asset_id uuid references assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, page_number)
);

create table capsule_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  format text not null default 'text' check (format in ('text', 'audio', 'video')),
  body text,
  asset_id uuid references assets(id) on delete set null,
  -- Null means "part of the archive with no scheduled unlock".
  deliver_at timestamptz,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index capsule_child_idx on capsule_messages (child_id, created_at desc);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  occasion_key text not null,
  next_occurs_on date,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_due_idx on reminders (next_occurs_on) where enabled;

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references families(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'memory', 'family', 'legacy')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  -- The seam for a payment provider. Nothing is wired up yet.
  external_ref text,
  renews_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  status text not null default 'draft' check (status in (
    'draft', 'placed', 'in_production', 'shipped', 'delivered', 'cancelled'
  )),
  currency text not null default 'OMR',
  total_minor integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  model_id uuid references three_d_models(id) on delete set null,
  memory_id uuid references memories(id) on delete set null,
  description text not null default '',
  quantity smallint not null default 1,
  unit_price_minor integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ---------------------------------------------------- instrumentation ---- */

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  family_id uuid references families(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_family_idx on audit_events (family_id, created_at desc);

-- Product metrics. `props` holds counts and enums only — never a child's
-- name, never a photograph, never free text a parent typed.
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  family_id uuid references families(id) on delete cascade,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_name_idx on analytics_events (name, created_at desc);

/* --------------------------------------------------------- timestamps ---- */

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'families', 'children', 'memories', 'assets',
    'photo_quality_reports', 'three_d_jobs', 'three_d_models', 'provider_calls',
    'qa_reviews', 'stories', 'story_pages', 'capsule_messages', 'reminders',
    'subscriptions', 'orders', 'order_items'
  ]
  loop
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      target || '_set_updated_at', target
    );
  end loop;
end;
$$;
