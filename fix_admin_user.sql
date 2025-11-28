-- 1. Fix RLS on users table to ensure updates are allowed
alter table public.users enable row level security;

drop policy if exists "Enable all access for all users" on public.users;
create policy "Enable all access for all users" on public.users for all using (true);

-- 2. Manually reset the Admin user credentials
-- Targets the existing user 'temple' or any user with ADMIN role
update public.users
set 
    name = 'Admin',
    email = 'admin@example.com',
    password_hash = 'admin123',
    role = 'ADMIN'
where 
    name = 'temple' 
    or email = 'fezzguidotti@gmail.com' 
    or role = 'ADMIN';
