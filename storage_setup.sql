-- 1. Create Storage Bucket for Logos
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- 2. Storage Policies (Allow public read, authenticated upload)
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'logos' );

create policy "Authenticated Upload"
  on storage.objects for insert
  with check ( bucket_id = 'logos' and auth.role() = 'authenticated' );

-- 3. Enable Cascade Deletes (to fix deletion issues)
-- We need to drop existing constraints and re-add them with ON DELETE CASCADE

-- Restaurants -> Users (Owner)
-- Note: The current schema has Owner -> User. If we delete Restaurant, we might want to delete the Owner User too, 
-- but usually it's the other way around or we handle it manually. 
-- However, the user wants "delete restaurant" to work.
-- Let's make sure that if a Restaurant is deleted, its child tables are deleted.

-- Categories
alter table public.categories drop constraint if exists categories_restaurant_id_fkey;
alter table public.categories 
  add constraint categories_restaurant_id_fkey 
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

-- Dishes
alter table public.dishes drop constraint if exists dishes_restaurant_id_fkey;
alter table public.dishes 
  add constraint dishes_restaurant_id_fkey 
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

alter table public.dishes drop constraint if exists dishes_category_id_fkey;
alter table public.dishes 
  add constraint dishes_category_id_fkey 
  foreign key (category_id) references public.categories(id) on delete cascade;

-- Tables
alter table public.tables drop constraint if exists tables_restaurant_id_fkey;
alter table public.tables 
  add constraint tables_restaurant_id_fkey 
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

-- Table Sessions
alter table public.table_sessions drop constraint if exists table_sessions_restaurant_id_fkey;
alter table public.table_sessions 
  add constraint table_sessions_restaurant_id_fkey 
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

alter table public.table_sessions drop constraint if exists table_sessions_table_id_fkey;
alter table public.table_sessions 
  add constraint table_sessions_table_id_fkey 
  foreign key (table_id) references public.tables(id) on delete cascade;

-- Orders
alter table public.orders drop constraint if exists orders_restaurant_id_fkey;
alter table public.orders 
  add constraint orders_restaurant_id_fkey 
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

alter table public.orders drop constraint if exists orders_table_session_id_fkey;
alter table public.orders 
  add constraint orders_table_session_id_fkey 
  foreign key (table_session_id) references public.table_sessions(id) on delete cascade;

-- Order Items
alter table public.order_items drop constraint if exists order_items_order_id_fkey;
alter table public.order_items 
  add constraint order_items_order_id_fkey 
  foreign key (order_id) references public.orders(id) on delete cascade;

alter table public.order_items drop constraint if exists order_items_dish_id_fkey;
alter table public.order_items 
  add constraint order_items_dish_id_fkey 
  foreign key (dish_id) references public.dishes(id) on delete cascade;

-- Restaurant Staff
alter table public.restaurant_staff drop constraint if exists restaurant_staff_restaurant_id_fkey;
alter table public.restaurant_staff 
  add constraint restaurant_staff_restaurant_id_fkey 
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

-- Bookings
alter table public.bookings drop constraint if exists bookings_restaurant_id_fkey;
alter table public.bookings 
  add constraint bookings_restaurant_id_fkey 
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;
