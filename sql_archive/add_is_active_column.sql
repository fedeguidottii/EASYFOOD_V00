ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
