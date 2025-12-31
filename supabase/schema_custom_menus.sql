-- Enable RLS
alter table public.dishes enable row level security;

-- Custom Menus Table
create table if not exists public.custom_menus (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  description text,
  is_active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Custom Menu Dishes (Join Table)
create table if not exists public.custom_menu_dishes (
  id uuid default gen_random_uuid() primary key,
  custom_menu_id uuid references public.custom_menus(id) on delete cascade not null,
  dish_id uuid references public.dishes(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(custom_menu_id, dish_id)
);

-- Custom Menu Schedules
create table if not exists public.custom_menu_schedules (
  id uuid default gen_random_uuid() primary key,
  custom_menu_id uuid references public.custom_menus(id) on delete cascade not null,
  day_of_week integer, -- 0-6 (Sun-Sat), null = every day
  meal_type text check (meal_type in ('lunch', 'dinner', 'all')),
  start_time time,
  end_time time,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RPC: Apply Custom Menu
-- Sets the selected menu as active, and updates all dishes is_active state based on inclusion in the menu.
drop function if exists public.apply_custom_menu(uuid, uuid);

create or replace function public.apply_custom_menu(p_restaurant_id uuid, p_menu_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Deactivate all other menus for this restaurant
  update public.custom_menus
  set is_active = false
  where restaurant_id = p_restaurant_id;

  -- 2. Activate the selected menu
  update public.custom_menus
  set is_active = true
  where id = p_menu_id;

  -- 3. Update Dishes Visibility
  -- First, hide ALL dishes for this restaurant
  update public.dishes
  set is_active = false
  where restaurant_id = p_restaurant_id;

  -- Then, show only dishes in the custom menu
  update public.dishes
  set is_active = true
  where id in (
    select dish_id 
    from public.custom_menu_dishes 
    where custom_menu_id = p_menu_id
  );
end;
$$;

-- RPC: Reset to Full Menu
-- Deactivates all custom menus and shows ALL dishes.
drop function if exists public.reset_to_full_menu(uuid);

create or replace function public.reset_to_full_menu(p_restaurant_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Deactivate all custom menus
  update public.custom_menus
  set is_active = false
  where restaurant_id = p_restaurant_id;

  -- 2. Show ALL dishes
  update public.dishes
  set is_active = true
  where restaurant_id = p_restaurant_id;
end;
$$;
