-- Operations that need more than a single query.
--
-- Each of these is `security definer` because it has to reach past row-level
-- security — to delete an auth user, to count across families for the admin
-- overview — and each re-checks authorisation itself as its first act.

/* ------------------------------------------------------- data export ----- */

-- The parent's right to a copy of their data. Files are listed by storage path
-- rather than embedded: they are large, and a base64 copy of a family's photo
-- library is a second copy of exactly the thing we are protecting.
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
    'memories', coalesce((select jsonb_agg(to_jsonb(m)) from memories m where m.family_id = target_family), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a)) from assets a where a.family_id = target_family), '[]'::jsonb),
    'threeDJobs', coalesce((select jsonb_agg(to_jsonb(j)) from three_d_jobs j where j.family_id = target_family), '[]'::jsonb),
    'threeDModels', coalesce((select jsonb_agg(to_jsonb(mo)) from three_d_models mo where mo.family_id = target_family), '[]'::jsonb),
    'capsuleMessages', coalesce((select jsonb_agg(to_jsonb(cm)) from capsule_messages cm where cm.family_id = target_family), '[]'::jsonb)
  );
end;
$$;

/* ----------------------------------------------------------- deletion ---- */

-- Deletes files as well as rows. A deletion that leaves objects in the bucket
-- is not a deletion, it is a broken thumbnail with the photograph still there.
create or replace function delete_family_storage(target_family uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from storage.objects
  where bucket_id = 'family-media'
    and name like 'families/' || target_family::text || '/%';
end;
$$;

create or replace function delete_family_content()
returns void
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

  perform delete_family_storage(target_family);

  -- Children cascade to memories, assets, jobs and models.
  delete from children where family_id = target_family;
  delete from capsule_messages where family_id = target_family;
  delete from assets where family_id = target_family;

  insert into audit_events (actor_id, family_id, action, entity, entity_id)
  values (auth.uid(), target_family, 'family.content_deleted', 'family', target_family);
end;
$$;

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid := auth.uid();
  target_family uuid;
begin
  if target_user is null then
    raise exception 'not authenticated';
  end if;

  select family_id into target_family
  from family_members
  where profile_id = target_user
  order by created_at
  limit 1;

  if target_family is not null then
    perform delete_family_storage(target_family);
    -- Only tear the family down if this account is the last member of it.
    if (select count(*) from family_members where family_id = target_family) = 1 then
      delete from families where id = target_family;
    else
      delete from family_members where family_id = target_family and profile_id = target_user;
    end if;
  end if;

  -- Cascades to `profiles`, and removes the login itself.
  delete from auth.users where id = target_user;
end;
$$;

/* -------------------------------------------------------------- admin ---- */

create or replace function admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  return jsonb_build_object(
    'families', (select count(*) from families),
    'children', (select count(*) from children),
    'memories', (select count(*) from memories),
    'jobs_by_status', coalesce(
      (select jsonb_object_agg(status, total)
       from (select status, count(*) as total from three_d_jobs group by status) s),
      '{}'::jsonb
    ),
    'failed_jobs', (select count(*) from three_d_jobs where status = 'failed'),
    'estimated_spend_usd', coalesce((select sum(estimated_cost_usd) from provider_calls), 0)
  );
end;
$$;

-- The QA queue: finished generations nobody has looked at yet.
create or replace view qa_queue as
  select j.*
  from three_d_jobs j
  where j.completed_at is not null
    and j.status <> 'failed'
    and not exists (select 1 from qa_reviews r where r.job_id = j.id);

alter view qa_queue set (security_invoker = on);

create or replace function submit_qa_review(
  p_job_id uuid,
  p_decision text,
  p_notes text
)
returns qa_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  created qa_reviews;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  insert into qa_reviews (job_id, model_id, reviewer_id, decision, notes)
  values (
    p_job_id,
    (select id from three_d_models where job_id = p_job_id),
    auth.uid(),
    p_decision,
    p_notes
  )
  on conflict (job_id) do update
    set decision = excluded.decision,
        notes = excluded.notes,
        reviewer_id = excluded.reviewer_id,
        updated_at = now()
  returning * into created;

  -- The decision moves the job on, which is what makes human review real
  -- rather than decorative.
  update three_d_jobs
  set status = case
        when p_decision = 'approved' then 'print_ready'
        when p_decision = 'rejected' then 'failed'
        else 'quality_review'
      end,
      error_code = case when p_decision = 'rejected' then 'rejected_in_qa' else error_code end,
      updated_at = now()
  where id = p_job_id;

  insert into audit_events (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'qa.reviewed', 'three_d_job', p_job_id, jsonb_build_object('decision', p_decision));

  return created;
end;
$$;
