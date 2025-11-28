-- Add new columns to dishes
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_ayce boolean DEFAULT false;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS allergens text[] DEFAULT '{}';

-- Add session_pin to table_sessions
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS session_pin text;

-- Create cart_items table for realtime shared cart
CREATE TABLE IF NOT EXISTS cart_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid REFERENCES table_sessions(id) ON DELETE CASCADE,
    dish_id uuid REFERENCES dishes(id) ON DELETE CASCADE,
    quantity integer DEFAULT 1,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable Realtime for cart_items (only if not already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'cart_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cart_items;
    END IF;
END $$;

-- Ensure restaurants has settings (jsonb is flexible, but let's be sure)
-- Already handled in v2 but reinforcing
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS all_you_can_eat jsonb DEFAULT '{"enabled": false, "pricePerPerson": 0, "maxOrders": 5}';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cover_charge_per_person numeric DEFAULT 0;
