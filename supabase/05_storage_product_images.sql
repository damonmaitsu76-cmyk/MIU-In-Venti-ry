-- Product image storage. Safe to re-run. Run after 01 and before staff upload images.

alter table public.products add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff read product images" on storage.objects;
drop policy if exists "staff upload product images" on storage.objects;
drop policy if exists "staff update product images" on storage.objects;
drop policy if exists "staff delete product images" on storage.objects;

create policy "staff read product images" on storage.objects for select to authenticated using (bucket_id = 'product-images');
create policy "staff upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
create policy "staff update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
create policy "staff delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images');
