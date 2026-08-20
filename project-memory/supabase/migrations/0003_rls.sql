-- Row-level security.
--
-- This file is the privacy boundary. The app also filters by family, but that
-- is for efficiency; a client-side filter is not a security control and this
-- codebase does not treat it as one. If a policy here is wrong, the product is
-- wrong, regardless of what the app does.
--
-- The shape is deliberately repetitive: one helper that answers "is this row
-- in a family I belong to", applied the same way to every table. Clever
-- policies are policies nobody can audit.

/* ------------------------------------------------------------ helpers ---- */

-- `security definer` so the function can read `family_members` without being
-- caught by the very policies it exists to support.
create or replace function is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members
    where family_members.family_id = target_family_id
      and family_members.profile_id = auth.uid()
  );
$$;

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select profiles.is_staff from profiles where profiles.id = auth.uid()),
    false
  );
$$;

/* ------------------------------------------------------------ enable ----- */

alter table profiles           enable row level security;
alter table families           enable row level security;
alter table family_members     enable row level security;
alter table children           enable row level security;
alter table memories           enable row level security;
alter table assets             enable row level security;
alter table photo_quality_reports enable row level security;
alter table three_d_jobs       enable row level security;
alter table three_d_models     enable row level security;
alter table provider_calls     enable row level security;
alter table qa_reviews         enable row level security;
alter table stories            enable row level security;
alter table story_pages        enable row level security;
alter table capsule_messages   enable row level security;
alter table reminders          enable row level security;
alter table subscriptions      enable row level security;
alter table orders             enable row level security;
alter table order_items        enable row level security;
alter table audit_events       enable row level security;
alter table analytics_events   enable row level security;

/* ----------------------------------------------------------- profiles ---- */

create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_staff());

create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Note there is no insert policy: profiles are created only by the signup
-- trigger, and no client should be able to mint one.

/* ----------------------------------------------------------- families ---- */

create policy families_read on families
  for select using (is_family_member(id) or is_staff());

create policy families_update on families
  for update using (is_family_member(id)) with check (is_family_member(id));

create policy family_members_read on family_members
  for select using (profile_id = auth.uid() or is_family_member(family_id) or is_staff());

/* ----------------------------------------------------------- children ---- */

create policy children_read on children
  for select using (is_family_member(family_id) or is_staff());

create policy children_insert on children
  for insert with check (is_family_member(family_id));

create policy children_update on children
  for update using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy children_delete on children
  for delete using (is_family_member(family_id));

/* ----------------------------------------------------------- memories ---- */

create policy memories_read on memories
  for select using (is_family_member(family_id) or is_staff());

create policy memories_insert on memories
  for insert with check (is_family_member(family_id) and created_by = auth.uid());

create policy memories_update on memories
  for update using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy memories_delete on memories
  for delete using (is_family_member(family_id));

/* ------------------------------------------------------------- assets ---- */

create policy assets_read on assets
  for select using (is_family_member(family_id) or is_staff());

create policy assets_insert on assets
  for insert with check (is_family_member(family_id));

create policy assets_update on assets
  for update using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy assets_delete on assets
  for delete using (is_family_member(family_id));

create policy quality_read on photo_quality_reports
  for select using (
    exists (select 1 from assets a where a.id = asset_id and (is_family_member(a.family_id) or is_staff()))
  );

create policy quality_write on photo_quality_reports
  for insert with check (
    exists (select 1 from assets a where a.id = asset_id and is_family_member(a.family_id))
  );

create policy quality_update on photo_quality_reports
  for update using (
    exists (select 1 from assets a where a.id = asset_id and is_family_member(a.family_id))
  ) with check (
    exists (select 1 from assets a where a.id = asset_id and is_family_member(a.family_id))
  );

/* ----------------------------------------------------------------- 3D ---- */

-- Families read their own jobs. Only the server (service role, which bypasses
-- RLS) writes them: a client that could set `status` or `provider_key` could
-- fake a finished figurine, and a client that could insert jobs could spend
-- our provider credits.
create policy jobs_read on three_d_jobs
  for select using (is_family_member(family_id) or is_staff());

-- Cancelling is the one job mutation a parent owns.
create policy jobs_cancel on three_d_jobs
  for update using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy models_read on three_d_models
  for select using (is_family_member(family_id) or is_staff());

-- Cost data is internal. Families never see what a generation cost us.
create policy provider_calls_read on provider_calls
  for select using (is_staff());

create policy qa_reviews_read on qa_reviews
  for select using (is_staff());

create policy qa_reviews_write on qa_reviews
  for insert with check (is_staff() and reviewer_id = auth.uid());

/* -------------------------------------------------- future feature hooks -- */

create policy stories_read on stories
  for select using (is_family_member(family_id) or is_staff());

create policy stories_write on stories
  for all using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy story_pages_read on story_pages
  for select using (
    exists (select 1 from stories s where s.id = story_id and (is_family_member(s.family_id) or is_staff()))
  );

create policy capsule_read on capsule_messages
  for select using (is_family_member(family_id) or is_staff());

create policy capsule_write on capsule_messages
  for all using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy reminders_all on reminders
  for all using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy subscriptions_read on subscriptions
  for select using (is_family_member(family_id) or is_staff());

create policy orders_read on orders
  for select using (is_family_member(family_id) or is_staff());

create policy order_items_read on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id and (is_family_member(o.family_id) or is_staff()))
  );

/* ---------------------------------------------------- instrumentation ---- */

create policy audit_read on audit_events
  for select using (is_staff() or (family_id is not null and is_family_member(family_id)));

create policy analytics_insert on analytics_events
  for insert with check (profile_id is null or profile_id = auth.uid());

create policy analytics_read on analytics_events
  for select using (is_staff());
