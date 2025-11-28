-- 1. Fix RLS on users table to ensure updates are allowed
alter table public.users enable row level security;

drop policy if exists "Enable all access for all users" on public.users;
create policy "Enable all access for all users" on public.users for all using (true);

-- 2. Delete the old 'temple' user (since 'admin@example.com' already exists)
delete from public.users 
where email != 'admin@example.com' 
  and (name = 'temple' or email = 'fezzguidotti@gmail.com');

-- 3. Upsert the Admin user to ensure correct password
-- This will insert if missing, or update if email exists
insert into public.users (id, name, email, password_hash, role)
values (uuid_generate_v4(), 'Admin', 'admin@example.com', 'admin123', 'ADMIN')
on conflict (email) do update
set 
    name = 'Admin',
    password_hash = 'admin123',
    role = 'ADMIN';
