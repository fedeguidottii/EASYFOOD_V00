-- Add Waiter Mode settings to restaurants table

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS waiter_mode_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allow_waiter_payments BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waiter_password TEXT DEFAULT 'waiter123';

-- Force refresh of the schema cache if needed (usually automatic in Supabase)
NOTIFY pgrst, 'reload schema';
