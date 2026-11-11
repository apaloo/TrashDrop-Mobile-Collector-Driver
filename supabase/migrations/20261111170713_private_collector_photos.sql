-- Applied to production on 2026-11-11 through the Supabase MCP; the version
-- in the filename matches the project's migration history.
--
-- Make carter photos private.
--
-- The `collector-photos` bucket holds every carter's ID-card photos (front
-- and back) and vehicle photo, uploaded at sign-up. Until now:
--   * the bucket was public, so anyone with a link could open an ID photo,
--     and a policy let anyone (signed in or not) list and read every file;
--   * any signed-in user, households included, could overwrite or delete
--     any file in the bucket.
--
-- After this migration:
--   * the bucket is private: files open only through the storage API or a
--     short-lived signed link, never by a plain link;
--   * a carter can read, replace and delete only the files they uploaded;
--   * staff (td_is_staff: admin email list; td_can_manage_requests: admin
--     and manager roles) can read all files, to verify carters;
--   * uploads stay open to signed-in users (sign-up uploads the photos
--     before the carter profile exists), only into collector-documents/.
--
-- No app screen displays these photos today (the carter app only uploads
-- them), so nothing visible changes. The URLs already stored in
-- collector_profiles stop working as plain links; they still contain the
-- file path, which staff tools can turn into a signed link.
--
-- Rollback: supabase/diagnostics/private_collector_photos_rollback.sql

update storage.buckets set public = false where id = 'collector-photos';

drop policy if exists "Public can view photos 1ujgsh_0" on storage.objects;
drop policy if exists "Users can upload photos 1ujgsh_0" on storage.objects;
drop policy if exists "Users can update photos 1ujgsh_0" on storage.objects;
drop policy if exists "Users can delete photos 1ujgsh_0" on storage.objects;

create policy "Carter photos: owner or staff can view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'collector-photos'
    and (owner_id = auth.uid()::text or public.td_is_staff() or public.td_can_manage_requests())
  );

create policy "Carter photos: signed-in users upload to collector-documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'collector-photos'
    and (storage.foldername(name))[1] = 'collector-documents'
  );

create policy "Carter photos: owner can replace"
  on storage.objects for update to authenticated
  using (bucket_id = 'collector-photos' and owner_id = auth.uid()::text)
  with check (bucket_id = 'collector-photos' and owner_id = auth.uid()::text);

create policy "Carter photos: owner or staff can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'collector-photos'
    and (owner_id = auth.uid()::text or public.td_is_staff() or public.td_can_manage_requests())
  );
