-- Create Storage Bucket for Dishes
insert into storage.buckets (id, name, public)
values ('dishes', 'dishes', true)
on conflict (id) do nothing;

-- Storage Policies for Dishes
drop policy if exists "Public Access Dishes" on storage.objects;
create policy "Public Access Dishes"
  on storage.objects for select
  using ( bucket_id = 'dishes' );

drop policy if exists "Authenticated Upload Dishes" on storage.objects;
create policy "Authenticated Upload Dishes"
  on storage.objects for insert
  with check ( bucket_id = 'dishes' and auth.role() = 'authenticated' );
