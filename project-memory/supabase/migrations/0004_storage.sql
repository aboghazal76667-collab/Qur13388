-- Private file storage.
--
-- There is exactly one bucket and it is private. There is no public bucket in
-- this product, and adding one should require a conversation, not a commit.
--
-- Object keys follow the layout the app builds:
--
--   families/{familyId}/children/{childId}/memories/{memoryId}/{folder}/{assetId}.{ext}
--
-- The first two path segments are the whole access rule: segment 2 is the
-- family id, and a caller may touch an object only if they belong to that
-- family. Keeping the family id in a fixed position is what makes the storage
-- policy a one-line check instead of a parser.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media',
  'family-media',
  false,
  52428800, -- 50 MB: comfortably above a phone photo, well below a video dump.
  array[
    'image/jpeg', 'image/png', 'image/heic', 'image/webp',
    'video/mp4', 'audio/mpeg', 'audio/mp4',
    'model/gltf-binary', 'application/octet-stream', 'application/json'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Second path segment, or null when the key is not shaped as expected.
create or replace function storage_family_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) is null or array_length(parts, 1) < 2 then
    return null;
  end if;
  if parts[1] <> 'families' then
    return null;
  end if;
  return parts[2]::uuid;
exception
  -- A malformed key is not a family's key, so it is nobody's key.
  when invalid_text_representation then return null;
end;
$$;

create policy family_media_read on storage.objects
  for select using (
    bucket_id = 'family-media'
    and storage_family_id(name) is not null
    and (is_family_member(storage_family_id(name)) or is_staff())
  );

create policy family_media_insert on storage.objects
  for insert with check (
    bucket_id = 'family-media'
    and storage_family_id(name) is not null
    and is_family_member(storage_family_id(name))
  );

create policy family_media_update on storage.objects
  for update using (
    bucket_id = 'family-media'
    and storage_family_id(name) is not null
    and is_family_member(storage_family_id(name))
  );

create policy family_media_delete on storage.objects
  for delete using (
    bucket_id = 'family-media'
    and storage_family_id(name) is not null
    and is_family_member(storage_family_id(name))
  );
