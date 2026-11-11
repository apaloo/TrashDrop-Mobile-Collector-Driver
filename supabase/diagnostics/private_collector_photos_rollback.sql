-- Rollback for the private_collector_photos migration.
-- WARNING: this makes every carter's ID-card photo public again. Use it only
-- to unblock a broken upload, and fix the cause instead of leaving it.

update storage.buckets set public = true where id = 'collector-photos';

drop policy if exists "Carter photos: owner or staff can view" on storage.objects;
drop policy if exists "Carter photos: signed-in users upload to collector-documents" on storage.objects;
drop policy if exists "Carter photos: owner can replace" on storage.objects;
drop policy if exists "Carter photos: owner or staff can delete" on storage.objects;

create policy "Public can view photos 1ujgsh_0" on storage.objects for select to public
  using (bucket_id = 'collector-photos');
create policy "Users can upload photos 1ujgsh_0" on storage.objects for insert to authenticated
  with check (bucket_id = 'collector-photos');
create policy "Users can update photos 1ujgsh_0" on storage.objects for update to authenticated
  using (bucket_id = 'collector-photos');
create policy "Users can delete photos 1ujgsh_0" on storage.objects for delete to authenticated
  using (bucket_id = 'collector-photos');
