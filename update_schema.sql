-- Add new columns to restaurants table
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS logo_url text;
