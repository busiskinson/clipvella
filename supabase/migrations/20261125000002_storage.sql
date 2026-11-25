-- Private buckets. Object paths start with the owner's user id: {uid}/...
-- 50 MB = Supabase free-plan maximum; raise together with NEXT_PUBLIC_MAX_UPLOAD_MB on paid plans.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('uploads', 'uploads', false, 52428800, array['video/*']),
  ('media', 'media', false, 52428800, array['video/*', 'audio/*']),
  ('thumbnails', 'thumbnails', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('captions', 'captions', false, 1048576, array['text/plain', 'text/vtt', 'application/x-subrip'])
on conflict (id) do nothing;

create policy "clipforge objects: read own" on storage.objects for select to authenticated
  using (bucket_id in ('uploads', 'media', 'thumbnails', 'captions')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "clipforge objects: insert own" on storage.objects for insert to authenticated
  with check (bucket_id in ('uploads', 'media', 'thumbnails', 'captions')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "clipforge objects: update own" on storage.objects for update to authenticated
  using (bucket_id in ('uploads', 'media', 'thumbnails', 'captions')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('uploads', 'media', 'thumbnails', 'captions')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "clipforge objects: delete own" on storage.objects for delete to authenticated
  using (bucket_id in ('uploads', 'media', 'thumbnails', 'captions')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
