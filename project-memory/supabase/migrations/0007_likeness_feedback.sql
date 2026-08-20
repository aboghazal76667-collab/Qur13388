-- Likeness feedback.
--
-- The parent is the only person who can say whether a figurine looks like their
-- child, and right now that judgement is lost the moment they close the screen.
-- Capturing it structurally is what will eventually let us answer the questions
-- that decide which provider we use and what we charge for: does Meshy beat
-- Tripo on faces, does multi-view actually help, is a side view worth asking
-- for.
--
-- Deliberately coarse. A five-star rating would invite precision nobody has;
-- "the face needs work" is both easier to give and more useful to act on.

create table likeness_feedback (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  job_id uuid not null references three_d_jobs(id) on delete cascade,
  model_id uuid references three_d_models(id) on delete set null,
  child_id uuid not null references children(id) on delete cascade,
  submitted_by uuid not null references profiles(id) on delete cascade,

  -- The single overall judgement.
  verdict text not null check (verdict in ('good', 'needs_work')),
  -- What specifically was wrong, when the parent said so. Empty for 'good'.
  aspects text[] not null default '{}',
  note text,

  -- Recorded so feedback stays comparable as providers and prompts change.
  -- Without these a year of feedback becomes uninterpretable.
  provider_key text,
  source_photo_count smallint,
  -- The readiness score at the time, so we can learn whether our own guidance
  -- actually predicts a good result.
  readiness_score smallint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One verdict per job; a parent changing their mind updates it.
create unique index likeness_feedback_job_idx on likeness_feedback (job_id);
create index likeness_feedback_provider_idx on likeness_feedback (provider_key, verdict);
create index likeness_feedback_family_idx on likeness_feedback (family_id);

create trigger likeness_feedback_set_updated_at
  before update on likeness_feedback
  for each row execute function set_updated_at();

alter table likeness_feedback enable row level security;

-- A family may record and revise its own feedback. Staff read it in aggregate;
-- nobody outside the family may see what a parent said about their child.
create policy likeness_feedback_read on likeness_feedback
  for select using (is_family_member(family_id) or is_staff());

create policy likeness_feedback_insert on likeness_feedback
  for insert with check (is_family_member(family_id) and submitted_by = auth.uid());

create policy likeness_feedback_update on likeness_feedback
  for update using (is_family_member(family_id)) with check (is_family_member(family_id));
