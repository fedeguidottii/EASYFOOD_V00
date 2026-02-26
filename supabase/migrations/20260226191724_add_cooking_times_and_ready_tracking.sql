-- Add ready_at column to order_items table (if not already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'ready_at'
  ) THEN
    ALTER TABLE order_items ADD COLUMN ready_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add show_cooking_times column to restaurants table (if not already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'show_cooking_times'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN show_cooking_times BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create RPC function to get average cooking time per dish
CREATE OR REPLACE FUNCTION get_average_cooking_time(p_dish_id BIGINT, p_restaurant_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
  avg_minutes INTEGER;
  order_count INTEGER;
BEGIN
  -- Count orders from last 2 months for this dish
  SELECT COUNT(*) INTO order_count
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.dish_id = p_dish_id
  AND o.restaurant_id = p_restaurant_id
  AND oi.ready_at IS NOT NULL
  AND oi.created_at >= NOW() - INTERVAL '2 months';

  -- If less than 3 orders, return null
  IF order_count < 3 THEN
    RETURN NULL;
  END IF;

  -- Calculate average cooking time in minutes
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (oi.ready_at - oi.created_at)) / 60))::INTEGER
  INTO avg_minutes
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.dish_id = p_dish_id
  AND o.restaurant_id = p_restaurant_id
  AND oi.ready_at IS NOT NULL
  AND oi.created_at >= NOW() - INTERVAL '2 months';

  RETURN COALESCE(avg_minutes, NULL);
END;
$$ LANGUAGE plpgsql STABLE;
