-- Create cart_items table
create table if not exists public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.table_sessions(id) on delete cascade,
  dish_id uuid references public.dishes(id) on delete cascade,
  quantity integer not null default 1,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.cart_items enable row level security;

-- Policy: Allow all access (for now, similar to other tables)
drop policy if exists "Enable all access for all users" on public.cart_items;
create policy "Enable all access for all users" on public.cart_items for all using (true);

-- Enable Realtime (Safe version)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'cart_items'
  ) then
    alter publication supabase_realtime add table public.cart_items;
  end if;
end $$;

-- Add customer_count to table_sessions
alter table public.table_sessions add column if not exists customer_count integer default 1;
