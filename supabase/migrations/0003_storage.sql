-- =============================================================================
-- STORAGE BUCKETS
--
-- Two public buckets for catalogue imagery, one PRIVATE bucket for anything a
-- customer uploaded. Private objects are reachable only through short-lived
-- signed URLs generated server-side.
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('catalog', 'catalog', true),        -- fabric swatches, pattern vectors
  ('previews', 'previews', true),      -- generated garment previews (no person)
  ('customer-photos', 'customer-photos', false)
on conflict (id) do nothing;

-- A customer may only touch objects under his own uid/ prefix, and nobody else
-- can read them at all.
create policy customer_photos_own_read on storage.objects
  for select using (
    bucket_id = 'customer-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy customer_photos_own_write on storage.objects
  for insert with check (
    bucket_id = 'customer-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy customer_photos_own_delete on storage.objects
  for delete using (
    bucket_id = 'customer-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy catalog_public_read on storage.objects
  for select using (bucket_id in ('catalog', 'previews'));
