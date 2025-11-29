-- Add status column to tables if it doesn't exist
ALTER TABLE tables ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';

-- Ensure all_you_can_eat column exists in restaurants (jsonb)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS all_you_can_eat jsonb DEFAULT '{"enabled": false, "pricePerPerson": 0, "maxOrders": 5}';

-- Ensure dishes have is_active (mapped from is_available in some versions)
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
