-- Fix Storage Policies for 'dishes' bucket

-- 1. Create the bucket if it doesn't exist (idempotent)
insert into storage.buckets (id, name, public)
values ('dishes', 'dishes', true)
on conflict (id) do nothing;

-- 2. Drop existing policies to avoid conflicts
drop policy if exists "Public Access Dishes" on storage.objects;
drop policy if exists "Authenticated Upload Dishes" on storage.objects;
drop policy if exists "Authenticated Update Dishes" on storage.objects;
drop policy if exists "Authenticated Delete Dishes" on storage.objects;

-- 3. Create comprehensive policies
-- Allow public read access to everyone
create policy "Public Access Dishes"
  on storage.objects for select
  using ( bucket_id = 'dishes' );

-- Allow authenticated users (restaurant owners/staff) to upload
create policy "Authenticated Upload Dishes"
  on storage.objects for insert
  with check ( bucket_id = 'dishes' and auth.role() = 'authenticated' );

-- Allow authenticated users to update their own uploads (or any in the bucket for simplicity in this app context)
create policy "Authenticated Update Dishes"
  on storage.objects for update
  using ( bucket_id = 'dishes' and auth.role() = 'authenticated' );

-- Allow authenticated users to delete
create policy "Authenticated Delete Dishes"
  on storage.objects for delete
  using ( bucket_id = 'dishes' and auth.role() = 'authenticated' );
