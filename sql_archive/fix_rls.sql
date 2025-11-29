-- Enable RLS on orders and order_items if not already enabled
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Policy: Allow authenticated users (including CUSTOMER role) to insert orders
drop policy if exists "Enable insert for authenticated users" on public.orders;
create policy "Enable insert for authenticated users" on public.orders for insert with check (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Policy: Allow authenticated users to select their own orders (or all for now for simplicity in dev)
drop policy if exists "Enable select for all users" on public.orders;
create policy "Enable select for all users" on public.orders for select using (true);

-- Policy: Allow authenticated users to update orders (e.g. status)
drop policy if exists "Enable update for all users" on public.orders;
create policy "Enable update for all users" on public.orders for update using (true);


-- Policy: Allow authenticated users to insert order_items
drop policy if exists "Enable insert for authenticated users" on public.order_items;
create policy "Enable insert for authenticated users" on public.order_items for insert with check (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Policy: Allow select for all on order_items
drop policy if exists "Enable select for all users" on public.order_items;
create policy "Enable select for all users" on public.order_items for select using (true);

-- Policy: Allow update for all on order_items
drop policy if exists "Enable update for all users" on public.order_items;
create policy "Enable update for all users" on public.order_items for update using (true);
