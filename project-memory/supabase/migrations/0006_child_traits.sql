-- Child identity and interests.
--
-- The design problem this table solves: a child who loves unicorns at four
-- loves space at seven and football at ten. A `favourite_animal` column would
-- record only the last of those and silently destroy the first two — which are
-- exactly the memories this product exists to keep.
--
-- So a trait is an *observation with a lifetime*, not a field. Recording that
-- Ghazal loved unicorns does not overwrite anything; it opens a period. When
-- she moves on, that period closes and a new one opens. The archive can then
-- answer both "what does she love now?" and "what did she love when she was
-- five?" — the second being the question the product is really for.
--
-- One table rather than a column per category, because new categories arrive
-- constantly (favourite app, favourite team, favourite dinosaur) and each one
-- must not be a migration. Type safety is kept by a check constraint on
-- `category` plus validation in the app, not by having thirty columns.

create table child_traits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,

  -- Extensible by one line, never by a schema redesign.
  category text not null check (category in (
    'colour', 'animal', 'toy', 'character', 'book', 'story', 'show', 'movie',
    'song', 'food', 'place', 'hobby', 'sport', 'activity', 'obsession',
    'makes_them_laugh', 'curious_about', 'good_at', 'personality', 'dream',
    'theme', 'custom'
  )),

  -- Free text, and deliberately so: "unicorns" and "الديناصورات" are both
  -- valid. Stored as the parent typed it, never normalised into English.
  value text not null check (length(btrim(value)) between 1 and 120),
  -- Case- and space-insensitive key used only to stop exact duplicates.
  value_key text not null,

  -- A label the parent added for a 'custom' category, e.g. "favourite team".
  custom_label text,

  /* ---- provenance: who says so ------------------------------------- */

  -- 'parent' is authoritative. 'suggested' is something the system proposed
  -- and nobody has confirmed — it must never be presented as fact, and it is
  -- never created by inference from a photograph without the parent saying so.
  source text not null default 'parent' check (source in ('parent', 'suggested')),
  -- Set when a parent accepts a suggestion. A suggestion with no
  -- `confirmed_at` has not been agreed to by anyone.
  confirmed_at timestamptz,

  /* ---- lifetime: when it was true ---------------------------------- */

  -- True while this is something the child loves now.
  is_current boolean not null default true,
  -- When the parent first told us. Defaults to today rather than to the
  -- child's birth: we know when we were told, not when it began.
  observed_from date not null default current_date,
  -- Set when the trait stops being current. Null while it still is.
  observed_to date,

  -- The child's age in months when first recorded, so "what did she love at
  -- five?" is answerable without recomputing against the birth date every time.
  age_months_at_record integer,

  -- Parent's own words about this trait, e.g. "only the grey one".
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A trait cannot be current and closed at the same time.
  constraint child_traits_lifetime_coherent
    check ((is_current and observed_to is null) or (not is_current and observed_to is not null)),
  constraint child_traits_period_ordered
    check (observed_to is null or observed_to >= observed_from)
);

-- The same value may recur across the child's life (unicorns at four, unicorns
-- again at nine), so the uniqueness that matters is per open period.
create unique index child_traits_current_unique
  on child_traits (child_id, category, value_key)
  where is_current;

create index child_traits_child_idx on child_traits (child_id, category, is_current);
create index child_traits_history_idx on child_traits (child_id, observed_from desc);
create index child_traits_family_idx on child_traits (family_id);

create trigger child_traits_set_updated_at
  before update on child_traits
  for each row execute function set_updated_at();

/* ---- authorisation ------------------------------------------------- */

-- Same boundary as every other table a family owns. What a child loves is at
-- least as personal as their photographs.
alter table child_traits enable row level security;

create policy child_traits_read on child_traits
  for select using (is_family_member(family_id) or is_staff());

create policy child_traits_insert on child_traits
  for insert with check (is_family_member(family_id));

create policy child_traits_update on child_traits
  for update using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy child_traits_delete on child_traits
  for delete using (is_family_member(family_id));

/* ---- export and deletion ------------------------------------------- */

-- Traits join the data export and the deletion paths. A parent asking for
-- everything we hold must receive this too, and deleting a child must remove it
-- (the cascade does that, but the export needs saying explicitly).
create or replace function export_my_family()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family uuid;
begin
  select family_id into target_family
  from family_members
  where profile_id = auth.uid()
  order by created_at
  limit 1;

  if target_family is null then
    raise exception 'no family for current user';
  end if;

  return jsonb_build_object(
    'exportedAt', now(),
    'family', (select to_jsonb(f) from families f where f.id = target_family),
    'children', coalesce((select jsonb_agg(to_jsonb(c)) from children c where c.family_id = target_family), '[]'::jsonb),
    'childTraits', coalesce((select jsonb_agg(to_jsonb(t)) from child_traits t where t.family_id = target_family), '[]'::jsonb),
    'memories', coalesce((select jsonb_agg(to_jsonb(m)) from memories m where m.family_id = target_family), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a)) from assets a where a.family_id = target_family), '[]'::jsonb),
    'threeDJobs', coalesce((select jsonb_agg(to_jsonb(j)) from three_d_jobs j where j.family_id = target_family), '[]'::jsonb),
    'threeDModels', coalesce((select jsonb_agg(to_jsonb(mo)) from three_d_models mo where mo.family_id = target_family), '[]'::jsonb),
    'capsuleMessages', coalesce((select jsonb_agg(to_jsonb(cm)) from capsule_messages cm where cm.family_id = target_family), '[]'::jsonb)
  );
end;
$$;
