-- Add All You Can Eat settings to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS all_you_can_eat jsonb DEFAULT '{"enabled": false, "pricePerPerson": 25.00, "maxOrders": 3}'::jsonb;

-- Add exclusion flag to dishes (menu items)
ALTER TABLE public.dishes 
ADD COLUMN IF NOT EXISTS exclude_from_all_you_can_eat boolean DEFAULT false;

-- Ensure image_url exists (it was already in the setup, but good to be safe)
ALTER TABLE public.dishes 
ADD COLUMN IF NOT EXISTS image_url text;

-- Add cover charge if missing (it was in the other schema)
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS cover_charge_per_person decimal(10,2) DEFAULT 0;

-- Add hours if missing
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS hours text;

-- Add table_id to bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.tables(id);
