-- Seed data for EasyFood V00
-- Run this ONCE after running supabase_setup.sql

-- 1. Create a restaurant
INSERT INTO public.restaurants (id, name, address, owner_id, created_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Il Mio Ristorante',
  'Via Roma 123, Milano',
  'a0000000-0000-0000-0000-0000000admin'::uuid,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create admin user
INSERT INTO public.users (id, email, name, password_hash, role, created_at)
VALUES (
  'a0000000-0000-0000-0000-0000000admin'::uuid,
  'admin@example.com',
  'Admin',
  'admin123',
  'ADMIN',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create categories
INSERT INTO public.categories (id, name, restaurant_id, "order", created_at)
VALUES 
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'Antipasti', 'a0000000-0000-0000-0000-000000000001'::uuid, 1, now()),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'Primi', 'a0000000-0000-0000-0000-000000000001'::uuid, 2, now()),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'Secondi', 'a0000000-0000-0000-0000-000000000001'::uuid, 3, now()),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'Dolci', 'a0000000-0000-0000-0000-000000000001'::uuid, 4, now()),
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'Bevande', 'a0000000-0000-0000-0000-000000000001'::uuid, 5, now())
ON CONFLICT (id) DO NOTHING;

-- 4. Create sample dishes
INSERT INTO public.dishes (id, name, description, price, vat_rate, category_id, restaurant_id, is_active, created_at)
VALUES 
  ('d0000000-0000-0000-0000-000000000001'::uuid, 'Bruschetta Classica', 'Pane tostato con pomodoro fresco, basilico e olio EVO', 6.00, 10, 'c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, true, now()),
  ('d0000000-0000-0000-0000-000000000002'::uuid, 'Carbonara', 'Spaghetti, guanciale, uova, pecorino, pepe', 12.00, 10, 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, true, now()),
  ('d0000000-0000-0000-0000-000000000003'::uuid, 'Amatriciana', 'Bucatini, guanciale, pomodoro, pecorino', 11.00, 10, 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, true, now()),
  ('d0000000-0000-0000-0000-000000000004'::uuid, 'Tagliata di Manzo', 'Rucola e grana', 18.00, 10, 'c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, true, now()),
  ('d0000000-0000-0000-0000-000000000005'::uuid, 'Tiramisù', 'Classico', 6.00, 10, 'c0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, true, now()),
  ('d0000000-0000-0000-0000-000000000006'::uuid, 'Acqua Naturale', '0.75L', 2.50, 10, 'c0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, true, now()),
  ('d0000000-0000-0000-0000-000000000007'::uuid, 'Coca Cola', '33cl', 3.00, 10, 'c0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, true, now())
ON CONFLICT (id) DO NOTHING;

-- 5. Create sample tables
INSERT INTO public.tables (id, number, restaurant_id, token, pin, created_at)
VALUES 
  ('t0000000-0000-0000-0000-000000000001'::uuid, 'Tavolo 1', 'a0000000-0000-0000-0000-000000000001'::uuid, 't1-token-12345678'::text, '1234', now()),
  ('t0000000-0000-0000-0000-000000000002'::uuid, 'Tavolo 2', 'a0000000-0000-0000-0000-000000000001'::uuid, 't2-token-87654321'::text, '5678', now()),
  ('t0000000-0000-0000-0000-000000000003'::uuid, 'Tavolo 3', 'a0000000-0000-0000-0000-000000000001'::uuid, 't3-token-abcdefgh'::text, '9012', now())
ON CONFLICT (id) DO NOTHING;
