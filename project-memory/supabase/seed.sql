-- Demo content for a fresh cloud project.
--
-- There are deliberately no photographs here. Real children's photographs must
-- never live in a repository, so the demo profiles carry initials and the
-- parent adds their own images.
--
-- Run this after creating a user through the app, then set the id below to
-- that user's id (Supabase → Authentication → Users).

do $$
declare
  demo_profile uuid;
  demo_family uuid;
  ghazal uuid;
  aya uuid;
begin
  select id into demo_profile from profiles order by created_at limit 1;
  if demo_profile is null then
    raise notice 'No profile found. Create an account in the app first, then re-run this seed.';
    return;
  end if;

  select family_id into demo_family from family_members where profile_id = demo_profile limit 1;

  update families set name = 'Demo Family' where id = demo_family;

  insert into children (family_id, first_name, date_of_birth, interests)
  values (demo_family, 'Ghazal', (current_date - interval '5 years')::date, array['unicorns', 'purple', 'the beach'])
  returning id into ghazal;

  insert into children (family_id, first_name, date_of_birth, interests)
  values (demo_family, 'Aya', (current_date - interval '2 years')::date, array['cats', 'music'])
  returning id into aya;

  insert into memories (family_id, child_id, kind, title, occurred_on, note, future_message, created_by)
  values
    (demo_family, ghazal, 'first_day', 'Her first day at school',
     (current_date - interval '1 year')::date,
     'She held my hand all the way to the gate, then let go and did not look back.',
     'You were braver than I was that morning.', demo_profile),
    (demo_family, ghazal, 'birthday', 'Turning five', current_date - 30,
     'Purple cake, exactly as requested.', null, demo_profile),
    (demo_family, aya, 'family_moment', 'A morning at the beach', current_date - 60,
     'She was not sure about the sea until her sister took her in.', null, demo_profile);
end;
$$;
