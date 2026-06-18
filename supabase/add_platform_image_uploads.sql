insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-images',
  'platform-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view platform images" on storage.objects;
drop policy if exists "Admins upload platform images" on storage.objects;

create policy "Anyone can view platform images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'platform-images');

create policy "Admins upload platform images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'platform-images'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.disabled = false
  )
);
