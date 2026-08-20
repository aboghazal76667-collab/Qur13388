-- Account creation.
--
-- Creating the profile, the family and the membership in one database
-- transaction means a signup can never leave a parent with an account but no
-- family — a state the app would have no sensible way to recover from.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
  chosen_name text;
begin
  insert into profiles (id, email, display_name, language)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case when new.raw_user_meta_data ->> 'language' = 'ar' then 'ar' else 'en' end
  );

  chosen_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'family_name', '')), '');
  if chosen_name is null then
    chosen_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  end if;

  insert into families (name, created_by, occasion_keys)
  values (coalesce(chosen_name, 'My family'), new.id, array['birthday'])
  returning id into new_family_id;

  insert into family_members (family_id, profile_id, role)
  values (new_family_id, new.id, 'owner');

  insert into subscriptions (family_id, plan) values (new_family_id, 'free');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
