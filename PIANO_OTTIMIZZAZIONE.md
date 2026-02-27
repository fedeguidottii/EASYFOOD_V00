# PIANO DI OTTIMIZZAZIONE EASYFOOD
## Target: 50-100 ristoranti, decine di piatti, centinaia di clienti per ristorante

---

# FASE 1 — SICUREZZA (CRITICO)

---

## PROBLEMA 1: Tutte le tabelle esposte ad utenti anonimi

**Dove:** `supabase/schema.sql` — Ogni tabella ha la policy `"Enable all access for all users"` con `USING (true)` per i ruoli `anon` e `authenticated`.

**Impatto:** Chiunque (senza login) può leggere, modificare, cancellare TUTTI i dati di TUTTI i ristoranti. Le 30+ policy restrittive sono completamente inutili perché PostgreSQL combina le policy con logica OR.

**Soluzione:**

1. Creare una funzione helper che restituisce i restaurant_id dell'utente corrente:
```sql
CREATE OR REPLACE FUNCTION public.user_restaurant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  UNION
  SELECT id FROM restaurants WHERE owner_id = auth.uid();
$$;
```

2. Eliminare TUTTE le policy blanket `"Enable all access for all users"` da queste 14 tabelle:
   - `orders`, `order_items`, `restaurants`, `restaurant_staff`, `users`
   - `dishes`, `categories`, `bookings`, `cart_items`, `custom_menus`
   - `custom_menu_dishes`, `custom_menu_schedules`, `table_sessions`, `tables`, `rooms`
   - `waiter_activity_logs`

3. Creare policy corrette per ogni tabella. Esempio per le principali:

**restaurants:**
```sql
-- Chiunque può leggere (per il menu pubblico)
CREATE POLICY "anon_read_restaurants" ON public.restaurants
  FOR SELECT USING (true);
-- Solo il proprietario può modificare
CREATE POLICY "owner_manage_restaurants" ON public.restaurants
  FOR ALL TO authenticated USING (owner_id = auth.uid());
```

**dishes:**
```sql
-- Clienti vedono solo piatti attivi
CREATE POLICY "public_read_active_dishes" ON public.dishes
  FOR SELECT USING (is_active = true);
-- Staff gestisce piatti del proprio ristorante
CREATE POLICY "staff_manage_dishes" ON public.dishes
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
```

**orders:**
```sql
-- Clienti vedono solo ordini della propria sessione (tramite RPC)
-- Staff vede ordini del proprio ristorante
CREATE POLICY "staff_manage_orders" ON public.orders
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
-- Anon può inserire (per ordini clienti senza login)
CREATE POLICY "anon_insert_orders" ON public.orders
  FOR INSERT TO anon WITH CHECK (true);
-- Anon può leggere solo per sessione
CREATE POLICY "anon_read_session_orders" ON public.orders
  FOR SELECT TO anon USING (true); -- filtrato lato app via session_id
```

**order_items:**
```sql
CREATE POLICY "staff_manage_order_items" ON public.order_items
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
CREATE POLICY "anon_read_order_items" ON public.order_items
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_order_items" ON public.order_items
  FOR INSERT TO anon WITH CHECK (true);
```

**users:**
```sql
-- Solo l'utente stesso può vedere i propri dati
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());
-- Admin può vedere tutti
CREATE POLICY "admin_manage_users" ON public.users
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );
```

**restaurant_staff:**
```sql
-- Staff vede solo colleghi dello stesso ristorante
CREATE POLICY "staff_read_own_restaurant" ON public.restaurant_staff
  FOR SELECT TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
-- Owner gestisce staff
CREATE POLICY "owner_manage_staff" ON public.restaurant_staff
  FOR ALL TO authenticated USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
  );
```

**cart_items:**
```sql
CREATE POLICY "anon_manage_cart" ON public.cart_items
  FOR ALL USING (true); -- cart è per sessione, filtrato lato app
```

**table_sessions:**
```sql
CREATE POLICY "public_read_sessions" ON public.table_sessions
  FOR SELECT USING (true);
CREATE POLICY "staff_manage_sessions" ON public.table_sessions
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
CREATE POLICY "anon_insert_sessions" ON public.table_sessions
  FOR INSERT TO anon WITH CHECK (true);
```

**tables:**
```sql
CREATE POLICY "public_read_tables" ON public.tables
  FOR SELECT USING (true);
CREATE POLICY "staff_manage_tables" ON public.tables
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
```

**rooms:** (eliminare le 6 policy duplicate)
```sql
DROP POLICY "Enable all access for all users" ON public.rooms;
DROP POLICY "Enable all for authenticated users" ON public.rooms;
DROP POLICY rooms_select_all ON public.rooms;
DROP POLICY rooms_insert_all ON public.rooms;
DROP POLICY rooms_update_all ON public.rooms;
DROP POLICY rooms_delete_all ON public.rooms;

CREATE POLICY "public_read_rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "staff_manage_rooms" ON public.rooms
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
```

**bookings:**
```sql
CREATE POLICY "public_insert_bookings" ON public.bookings
  FOR INSERT USING (true);
CREATE POLICY "public_read_bookings" ON public.bookings
  FOR SELECT USING (true);
CREATE POLICY "staff_manage_bookings" ON public.bookings
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
```

**categories:**
```sql
CREATE POLICY "public_read_categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "staff_manage_categories" ON public.categories
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
```

**waiter_activity_logs:**
```sql
DROP POLICY IF EXISTS "Enable insert for all users" ON public.waiter_activity_logs;
DROP POLICY IF EXISTS "Enable read for all users" ON public.waiter_activity_logs;
DROP POLICY IF EXISTS "Enable update for all users" ON public.waiter_activity_logs;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.waiter_activity_logs;

CREATE POLICY "staff_manage_logs" ON public.waiter_activity_logs
  FOR ALL TO authenticated USING (restaurant_id IN (SELECT public.user_restaurant_ids()));
```

**File da modificare:** Creare un file SQL con tutti i DROP POLICY + CREATE POLICY, eseguirlo su Supabase, poi aggiornare `supabase/schema.sql` con nuovo dump.

---

## PROBLEMA 2: Password in chiaro

**Dove:**
- `restaurant_staff.password` — colonna `text`, riga 452 di schema.sql
- `restaurants.waiter_password` — colonna `text` con default `'waiter123'`, riga 476 di schema.sql
- `DatabaseService.ts` riga 289: `.eq('password', password)` — confronto in chiaro
- Frontend login in chiaro

**Impatto:** Se qualcuno accede al database (e con le policy attuali CHIUNQUE può), legge tutte le password.

**Soluzione:**

1. **Database — Aggiungere estensione pgcrypto:**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

2. **Database — Rinominare colonna e migrare dati esistenti:**
```sql
-- restaurant_staff: rinomina password -> password_hash
ALTER TABLE public.restaurant_staff RENAME COLUMN password TO password_hash;

-- Hash tutte le password esistenti
UPDATE public.restaurant_staff
SET password_hash = crypt(password_hash, gen_salt('bf'))
WHERE password_hash IS NOT NULL
AND password_hash NOT LIKE '$2a$%'; -- Non ri-hashare se già hashata
```

3. **Database — Creare funzione RPC per login cameriere:**
```sql
CREATE OR REPLACE FUNCTION public.verify_waiter_login(p_username text, p_password text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
BEGIN
  SELECT rs.*, r.name as restaurant_name, r.id as rest_id
  INTO v_staff
  FROM restaurant_staff rs
  JOIN restaurants r ON r.id = rs.restaurant_id
  WHERE rs.username = p_username
  AND rs.is_active = true
  AND rs.password_hash = crypt(p_password, rs.password_hash);

  IF v_staff IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN row_to_json(v_staff);
END;
$$;
```

4. **DatabaseService.ts — Modificare riga 284-295:**
```typescript
// PRIMA (INSICURO):
async verifyWaiterCredentials(username: string, password: string): Promise<any> {
    const { data, error } = await supabase
        .from('restaurant_staff')
        .select('*, restaurant:restaurants(*)')
        .eq('username', username)
        .eq('password', password)  // <-- PASSWORD IN CHIARO
        .eq('is_active', true)
        .single()
    if (error) return null
    return data
}

// DOPO (SICURO):
async verifyWaiterCredentials(username: string, password: string): Promise<any> {
    const { data, error } = await supabase
        .rpc('verify_waiter_login', {
            p_username: username,
            p_password: password
        })
    if (error || !data) return null
    return data
}
```

5. **DatabaseService.ts — Modificare createStaff (riga 297-300) per hashare alla creazione:**
```typescript
async createStaff(staff: Omit<any, 'id' | 'created_at'>) {
    // Hash tramite RPC o lasciare al DB con trigger
    const { error } = await supabase.from('restaurant_staff').insert(staff)
    if (error) throw error
}
```
Oppure creare un trigger DB:
```sql
CREATE OR REPLACE FUNCTION public.hash_staff_password()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.password_hash IS NOT NULL AND NEW.password_hash NOT LIKE '$2a$%' THEN
    NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hash_password_before_insert
  BEFORE INSERT OR UPDATE ON public.restaurant_staff
  FOR EACH ROW EXECUTE FUNCTION public.hash_staff_password();
```

6. **restaurants.waiter_password** — Stesso trattamento: hashare e confrontare via RPC. Rimuovere il default `'waiter123'`.

---

## PROBLEMA 3: Bug nelle RLS policy (rs.restaurant_id = rs.restaurant_id)

**Dove:** schema.sql — 3 policy con il bug:
- `orders-staff-rw`
- `orders-staff-update`
- `tables-insert-staff`

**Impatto:** Qualsiasi utente staff di un ristorante vede/modifica gli ordini di TUTTI i ristoranti. Il confronto `rs.restaurant_id = rs.restaurant_id` è SEMPRE TRUE (confronta la colonna con se stessa).

**Soluzione:** Questo problema viene risolto automaticamente eliminando tutte le policy nella Fase 1 Problema 1 e sostituendole con quelle nuove corrette. Le policy buggate non esisteranno più.

Se si volessero fixare singolarmente:
```sql
-- Fix orders-staff-rw: cambiare rs.restaurant_id = rs.restaurant_id
-- in rs.restaurant_id = o.restaurant_id
DROP POLICY "orders-staff-rw" ON public.orders;
DROP POLICY "orders-staff-update" ON public.orders;
DROP POLICY "tables-insert-staff" ON public.tables;
```

---

# FASE 2 — PERFORMANCE DATABASE

---

## PROBLEMA 4: Index mancanti su colonne critiche

**Dove:** `supabase/schema.sql` — mancano ~15 indici per le query più frequenti

**Impatto:** Ogni query fa full table scan. Con milioni di righe dopo mesi di operazione, i tempi di risposta diventano secondi invece di millisecondi.

**Soluzione — Eseguire su Supabase:**

```sql
-- 1. table_sessions: query più frequente = WHERE table_id = ? AND status = 'OPEN'
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status
  ON public.table_sessions (table_id, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_status
  ON public.table_sessions (restaurant_id, status);

-- 2. order_items: usato da RPC cooking times, cucina, realtime
CREATE INDEX IF NOT EXISTS idx_order_items_dish_id
  ON public.order_items (dish_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id
  ON public.order_items (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_status
  ON public.order_items (order_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at
  ON public.order_items (created_at);

-- 3. orders: join con sessioni, filtro per status
CREATE INDEX IF NOT EXISTS idx_orders_table_session_id
  ON public.orders (table_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
  ON public.orders (restaurant_id, status);

-- 4. dishes: menu clienti filtra per restaurant + attivi
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_active
  ON public.dishes (restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_dishes_category_id
  ON public.dishes (category_id);

-- 5. bookings: filtro per data
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_datetime
  ON public.bookings (restaurant_id, date_time);

-- 6. cart_items: sempre filtrato per sessione
CREATE INDEX IF NOT EXISTS idx_cart_items_session_id
  ON public.cart_items (session_id);

-- 7. waiter_activity_logs: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_waiter_logs_restaurant_created
  ON public.waiter_activity_logs (restaurant_id, created_at DESC);

-- 8. restaurant_staff: login query
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_user_id
  ON public.restaurant_staff (user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_username_active
  ON public.restaurant_staff (username, is_active);

-- 9. tables: filtro per stanza
CREATE INDEX IF NOT EXISTS idx_tables_room_id
  ON public.tables (room_id);
```

**File da modificare:** Eseguire SQL su Supabase dashboard, poi fare nuovo dump di `schema.sql`.

---

## PROBLEMA 5: Subscription order_items non filtrata

**Dove:**
- `CustomerMenu.tsx` riga 1301-1310: subscription `order_items` con filtro `restaurant_id=eq.${restaurantId}` — ascolta TUTTE le modifiche del ristorante, non solo della sessione
- La vecchia subscription in `useCustomerSession.ts` (se esiste) non ha filtro

**Impatto:** Con 100 clienti connessi, ogni modifica a un singolo piatto (es. cucina marca "PRONTO") causa un `fetchOrders()` completo per OGNI cliente del ristorante. Con 50 ordini attivi = 100 refetch simultanei con join completi.

**Soluzione:**

1. **CustomerMenu.tsx riga 1297-1315** — La subscription order_items deve filtrare per `order_id` specifici della sessione, non per `restaurant_id`:
```typescript
// PRIMA (riga 1300-1310):
const itemsChannel = supabase
  .channel(`order-items-watch:${sessionId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'order_items',
    filter: `restaurant_id=eq.${restaurantId}` // TROPPO AMPIO!
  }, () => {
    fetchOrders()
  })

// DOPO — Usare aggiornamento granulare invece di refetch completo:
const itemsChannel = supabase
  .channel(`order-items-watch:${sessionId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'order_items',
    filter: `restaurant_id=eq.${restaurantId}`
  }, (payload) => {
    // Aggiornamento granulare: aggiorna solo l'item modificato
    setPreviousOrders(prev => prev.map(order => ({
      ...order,
      items: order.items?.map((item: any) =>
        item.id === payload.new.id ? { ...item, ...payload.new } : item
      )
    })))
  })
```

2. **Alternativa migliore — Usare Supabase Broadcast** per notifiche real-time leggere, e fare fetch solo quando necessario (es. nuovo ordine), non ad ogni cambio status singolo item.

---

## PROBLEMA 6: Nessuna paginazione sugli ordini

**Dove:**
- `DatabaseService.ts` riga 565-573 `getOrders()`: carica TUTTI gli ordini attivi con join `order_items(*, dish:dishes(*))`
- `DatabaseService.ts` riga 576-586 `getPastOrders()`: carica fino a 2000 ordini con join completi
- `DatabaseService.ts` riga 588-594 `getAllOrders()`: carica TUTTI gli ordini di TUTTI i ristoranti (usato nell'admin)

**Impatto:** Dopo 6 mesi un ristorante ha ~9.000 ordini pagati. `getPastOrders()` carica 2000 righe con join su `order_items` (potenzialmente 10.000 righe) e `dishes` (5.000 righe). Tempo di risposta: 5-10 secondi.

**Soluzione:**

1. **DatabaseService.ts — Aggiungere paginazione a getPastOrders:**
```typescript
// PRIMA:
async getPastOrders(restaurantId: string) {
    const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*, dish:dishes(*))')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'PAID')
        .order('created_at', { ascending: false })
        .limit(2000)
    ...
}

// DOPO:
async getPastOrders(restaurantId: string, page: number = 0, pageSize: number = 50) {
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
        .from('orders')
        .select('*, items:order_items(*, dish:dishes(name, price))', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'PAID')
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) throw error
    return { data: data as Order[], total: count || 0, page, pageSize }
}
```

2. **RestaurantDashboard.tsx — Implementare caricamento paginato nella tab Analytics/Storico:**
   - Aggiungere stato `pastOrdersPage` e `pastOrdersTotal`
   - Caricare solo la prima pagina all'apertura
   - Bottone "Carica altro" o infinite scroll
   - Per l'analytics: creare una funzione RPC server-side che fa l'aggregazione

3. **Creare RPC per analytics aggregate (evita caricare 2000 ordini sul client):**
```sql
CREATE OR REPLACE FUNCTION public.get_restaurant_analytics(
  p_restaurant_id uuid,
  p_start_date timestamptz DEFAULT NOW() - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_orders', COUNT(*),
    'total_revenue', COALESCE(SUM(total_amount), 0),
    'avg_order_value', COALESCE(AVG(total_amount), 0),
    'orders_by_day', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_amount) as revenue
        FROM orders
        WHERE restaurant_id = p_restaurant_id
        AND status = 'PAID'
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      ) d
    ),
    'top_dishes', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT d.name, SUM(oi.quantity) as total_qty, SUM(oi.quantity * d.price) as revenue
        FROM order_items oi
        JOIN dishes d ON d.id = oi.dish_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = p_restaurant_id
        AND o.status = 'PAID'
        AND o.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY d.id, d.name
        ORDER BY total_qty DESC
        LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
```

4. **DatabaseService.ts — Aggiungere metodo:**
```typescript
async getAnalytics(restaurantId: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase.rpc('get_restaurant_analytics', {
        p_restaurant_id: restaurantId,
        p_start_date: startDate,
        p_end_date: endDate
    })
    if (error) throw error
    return data
}
```

---

## PROBLEMA 7: Refetch completo ad ogni evento realtime

**Dove:**
- `WaiterDashboard.tsx` riga 188-206: 4 subscription sullo stesso canale, ognuna chiama `refreshData()`
- `refreshData()` (riga 208-220): fa 2 query complete con join ad OGNI evento
- `RestaurantDashboard.tsx` riga 518-538: subscription `orders` che chiama `fetchOrders()` completo

**Impatto:** Ogni singola modifica (1 piatto marcato pronto) causa 2 query complete con join per TUTTI i camerieri connessi + 1 query completa per il dashboard ristoratore.

**Soluzione:**

1. **WaiterDashboard.tsx — Aggiornamento granulare invece di refetch completo:**
```typescript
// PRIMA (riga 188-206):
.on('postgres_changes', { event: '*', schema: 'public', table: 'orders', ... }, () => refreshData())
.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', ... }, () => refreshData())

// DOPO — aggiornamento mirato:
.on('postgres_changes', {
  event: '*', schema: 'public', table: 'orders',
  filter: `restaurant_id=eq.${restaurantId}`
}, (payload) => {
  if (payload.eventType === 'INSERT') {
    // Carica solo il nuovo ordine con i suoi items
    fetchSingleOrder(payload.new.id).then(order => {
      if (order) setActiveOrders(prev => [...prev, order])
    })
  } else if (payload.eventType === 'UPDATE') {
    setActiveOrders(prev => prev.map(o =>
      o.id === payload.new.id ? { ...o, ...payload.new } : o
    ))
  } else if (payload.eventType === 'DELETE') {
    setActiveOrders(prev => prev.filter(o => o.id !== payload.old.id))
  }
})
.on('postgres_changes', {
  event: 'UPDATE', schema: 'public', table: 'order_items',
  filter: `restaurant_id=eq.${restaurantId}`
}, (payload) => {
  // Aggiorna solo l'item specifico dentro l'ordine
  setActiveOrders(prev => prev.map(order => ({
    ...order,
    items: order.items?.map((item: any) =>
      item.id === payload.new.id ? { ...item, ...payload.new } : item
    )
  })))
})
```

2. **DatabaseService.ts — Aggiungere metodo per caricare un singolo ordine:**
```typescript
async getOrderById(orderId: string) {
    const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*, dish:dishes(name, price))')
        .eq('id', orderId)
        .single()
    if (error) return null
    return data as Order
}
```

---

## PROBLEMA 8: Nessuna strategia di archiviazione

**Dove:** Database — nessuna pulizia automatica di dati vecchi

**Impatto dopo 2 anni con 100 ristoranti:**
- `orders`: ~3.6M righe
- `order_items`: ~18M righe
- `table_sessions`: ~3.6M righe
- `waiter_activity_logs`: ~10M+ righe
- `cart_items`: ~5M+ righe (MAI puliti!)

**Soluzione:**

1. **Creare schema archivio:**
```sql
CREATE SCHEMA IF NOT EXISTS archive;

CREATE TABLE archive.orders (LIKE public.orders INCLUDING ALL);
CREATE TABLE archive.order_items (LIKE public.order_items INCLUDING ALL);
CREATE TABLE archive.table_sessions (LIKE public.table_sessions INCLUDING ALL);
CREATE TABLE archive.waiter_activity_logs (LIKE public.waiter_activity_logs INCLUDING ALL);
```

2. **Creare funzione di archiviazione (da eseguire mensilmente):**
```sql
CREATE OR REPLACE FUNCTION public.archive_old_data(months_to_keep integer DEFAULT 3)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cutoff timestamptz := NOW() - (months_to_keep || ' months')::interval;
  archived_orders int := 0;
  archived_items int := 0;
  archived_sessions int := 0;
  archived_logs int := 0;
  cleaned_carts int := 0;
BEGIN
  -- 1. Archivia order_items di ordini vecchi
  WITH old_orders AS (
    SELECT id FROM orders
    WHERE status IN ('PAID', 'CANCELLED') AND created_at < cutoff
  )
  INSERT INTO archive.order_items
  SELECT oi.* FROM order_items oi
  JOIN old_orders oo ON oo.id = oi.order_id;
  GET DIAGNOSTICS archived_items = ROW_COUNT;

  -- 2. Cancella order_items archiviati
  WITH old_orders AS (
    SELECT id FROM orders
    WHERE status IN ('PAID', 'CANCELLED') AND created_at < cutoff
  )
  DELETE FROM order_items WHERE order_id IN (SELECT id FROM old_orders);

  -- 3. Archivia ordini vecchi
  INSERT INTO archive.orders
  SELECT * FROM orders
  WHERE status IN ('PAID', 'CANCELLED') AND created_at < cutoff;
  GET DIAGNOSTICS archived_orders = ROW_COUNT;

  DELETE FROM orders
  WHERE status IN ('PAID', 'CANCELLED') AND created_at < cutoff;

  -- 4. Archivia sessioni chiuse vecchie
  INSERT INTO archive.table_sessions
  SELECT * FROM table_sessions
  WHERE status = 'CLOSED' AND closed_at < cutoff;
  GET DIAGNOSTICS archived_sessions = ROW_COUNT;

  DELETE FROM table_sessions
  WHERE status = 'CLOSED' AND closed_at < cutoff;

  -- 5. Archivia log vecchi
  INSERT INTO archive.waiter_activity_logs
  SELECT * FROM waiter_activity_logs WHERE created_at < cutoff;
  GET DIAGNOSTICS archived_logs = ROW_COUNT;

  DELETE FROM waiter_activity_logs WHERE created_at < cutoff;

  -- 6. Pulisci cart_items di sessioni chiuse
  DELETE FROM cart_items
  WHERE session_id IN (SELECT id FROM table_sessions WHERE status = 'CLOSED');
  GET DIAGNOSTICS cleaned_carts = ROW_COUNT;

  -- 7. Pulisci cart_items orfani (>24h)
  DELETE FROM cart_items WHERE created_at < NOW() - INTERVAL '24 hours';

  RETURN json_build_object(
    'archived_orders', archived_orders,
    'archived_items', archived_items,
    'archived_sessions', archived_sessions,
    'archived_logs', archived_logs,
    'cleaned_carts', cleaned_carts
  );
END;
$$;
```

3. **Configurare pg_cron per esecuzione automatica mensile:**
```sql
-- Attivare pg_cron dalle impostazioni Supabase (Database > Extensions)
SELECT cron.schedule(
  'archive-old-data',
  '0 3 1 * *', -- Ogni primo del mese alle 3:00
  $$SELECT public.archive_old_data(3)$$
);
```

---

## PROBLEMA 9: Vincoli NOT NULL mancanti

**Dove:** schema.sql — 15 colonne FK che permettono NULL

**Soluzione:**
```sql
-- Aggiungere NOT NULL alle FK critiche (solo dopo aver pulito eventuali NULL esistenti)
UPDATE bookings SET restaurant_id = (SELECT restaurant_id FROM tables WHERE id = bookings.table_id) WHERE restaurant_id IS NULL;
UPDATE cart_items SET session_id = '' WHERE session_id IS NULL; -- o delete
UPDATE order_items SET order_id = '' WHERE order_id IS NULL; -- o delete

ALTER TABLE public.order_items ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN dish_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN table_session_id SET NOT NULL;
ALTER TABLE public.cart_items ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE public.cart_items ALTER COLUMN dish_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.dishes ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.tables ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.table_sessions ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.table_sessions ALTER COLUMN table_id SET NOT NULL;
ALTER TABLE public.restaurant_staff ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.restaurants ALTER COLUMN owner_id SET NOT NULL;
```

---

## PROBLEMA 10: CHECK/UNIQUE constraints mancanti

**Dove:** schema.sql — nessun vincolo di validazione dati

**Soluzione:**
```sql
-- UNIQUE: un solo tavolo con lo stesso numero per ristorante
ALTER TABLE public.tables ADD CONSTRAINT tables_restaurant_number_unique
  UNIQUE (restaurant_id, number);

-- UNIQUE: una sola sessione OPEN per tavolo
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_table
  ON public.table_sessions (table_id) WHERE (status = 'OPEN');

-- UNIQUE: username staff unico per ristorante
ALTER TABLE public.restaurant_staff ADD CONSTRAINT staff_username_restaurant_unique
  UNIQUE (restaurant_id, username);

-- CHECK: quantità positive
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_positive
  CHECK (quantity > 0);
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_quantity_positive
  CHECK (quantity > 0);

-- CHECK: prezzi non negativi
ALTER TABLE public.dishes ADD CONSTRAINT dishes_price_nonneg
  CHECK (price >= 0);

-- CHECK: posti positivi
ALTER TABLE public.tables ADD CONSTRAINT tables_seats_positive
  CHECK (seats > 0);

-- CHECK: ospiti prenotazione positivi
ALTER TABLE public.bookings ADD CONSTRAINT bookings_guests_positive
  CHECK (guests > 0);

-- CHECK: giorno della settimana 0-6
ALTER TABLE public.custom_menu_schedules ADD CONSTRAINT schedules_day_range
  CHECK (day_of_week >= 0 AND day_of_week <= 6);
```

---

## PROBLEMA 11: Race condition in get_or_create_table_session

**Dove:** schema.sql righe 175-203 — la funzione RPC

**Impatto:** Due clienti che scansionano il QR contemporaneamente possono creare 2 sessioni per lo stesso tavolo.

**Soluzione:**
```sql
CREATE OR REPLACE FUNCTION public.get_or_create_table_session(
  p_table_id uuid,
  p_restaurant_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_id uuid;
  v_pin text;
BEGIN
  -- Advisory lock per prevenire race condition
  PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));

  -- Cerca sessione esistente
  SELECT id INTO v_session_id
  FROM table_sessions
  WHERE table_id = p_table_id AND status = 'OPEN'
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    RETURN v_session_id;
  END IF;

  -- Genera PIN e crea nuova sessione
  v_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO table_sessions (table_id, restaurant_id, session_pin, status)
  VALUES (p_table_id, p_restaurant_id, v_pin, 'OPEN')
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;
```

---

## PROBLEMA 12: RPC get_average_cooking_time — doppia query e tipi sbagliati

**Dove:** schema.sql righe 113-146

**Impatto:** La funzione esegue 2 scan identici (COUNT + AVG). I parametri sono `bigint` ma le colonne sono `uuid`.

**Soluzione:**
```sql
-- Eliminare la funzione con parametri sbagliati
DROP FUNCTION IF EXISTS public.get_average_cooking_time(bigint, bigint);

-- Riscrivere come query singola
CREATE OR REPLACE FUNCTION public.get_average_cooking_time(p_dish_id uuid, p_restaurant_id uuid)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (oi.ready_at - oi.created_at)) / 60))::integer
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.dish_id = p_dish_id
    AND o.restaurant_id = p_restaurant_id
    AND oi.ready_at IS NOT NULL
    AND oi.created_at >= NOW() - INTERVAL '2 months'
    AND EXTRACT(EPOCH FROM (oi.ready_at - oi.created_at)) > 0
  HAVING COUNT(*) >= 3;
$$;
```

---

## PROBLEMA 13: FK senza CASCADE

**Dove:** schema.sql — 4 foreign key senza ON DELETE

**Soluzione:**
```sql
-- order_items.restaurant_id -> CASCADE (se il ristorante viene cancellato, cancella gli items)
ALTER TABLE public.order_items DROP CONSTRAINT order_items_restaurant_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- restaurant_staff.user_id -> SET NULL (se l'utente viene cancellato, non cancellare lo staff record)
ALTER TABLE public.restaurant_staff DROP CONSTRAINT restaurant_staff_user_id_fkey;
ALTER TABLE public.restaurant_staff ADD CONSTRAINT restaurant_staff_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- restaurants.owner_id -> RESTRICT (impedisci cancellazione utente se ha ristoranti)
ALTER TABLE public.restaurants DROP CONSTRAINT restaurants_owner_id_fkey;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;

-- bookings.table_id -> SET NULL (se il tavolo viene cancellato, mantieni la prenotazione)
ALTER TABLE public.bookings DROP CONSTRAINT bookings_table_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL;
```

---

## PROBLEMA 14: SECURITY DEFINER senza search_path

**Dove:** schema.sql — 6 funzioni SECURITY DEFINER vulnerabili a search path injection

**Soluzione:** Aggiungere `SET search_path = public` a tutte:
- `apply_custom_menu(uuid)` — riga 40
- `apply_custom_menu(uuid, uuid)` — riga 77
- `get_or_create_table_session()` — riga 175
- `get_restaurant_by_table_token()` — riga 210
- `is_restaurant_staff()` — riga 231
- `set_order_item_restaurant_id()` — riga 252

Per ognuna, aggiungere la clausola:
```sql
CREATE OR REPLACE FUNCTION public.nome_funzione(...)
RETURNS ... LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public  -- AGGIUNGERE QUESTA RIGA
AS $$ ... $$;
```

---

# FASE 3 — PERFORMANCE REACT

---

## PROBLEMA 15: Esplosione subscription Realtime

**Dove:**
- `RestaurantDashboard.tsx`: 7 `useSupabaseData` (righe 116-121, 143) = 7 canali + 1 manuale (riga 524) = **8 canali**
- `useRestaurantLogic.ts`: 4 `useSupabaseData` (righe 8-11) = **4 canali** (DUPLICATI con quelli del dashboard!)
- `CustomerMenu.tsx`: 7 canali manuali (righe 431, 648, 703, 1076, 1113, 1287, 1301)
- `WaiterDashboard.tsx`: 1 canale con 4 listener (righe 192-196)

**Totale per dashboard ristoratore:** 8 + 4 = **12 canali** (7 delle useSupabaseData duplicate!)
**Totale per cliente:** 7 canali (di cui 2 duplicati per `orders`)
**A scala:** 100 ristoranti × (1 dashboard + 3 camerieri + 50 clienti) = **~5.400 canali simultanei**

**Soluzione:**

1. **Eliminare useRestaurantLogic in RestaurantDashboard:**
   `RestaurantDashboard.tsx` importa `useRestaurantLogic` (riga 65) che crea 4 `useSupabaseData` (orders, tables, dishes, categories) IDENTICHE a quelle già create nel dashboard (righe 116-118). Ma guardando il codice, `useRestaurantLogic` NON viene usato nel component! Viene importato ma non chiamato nel render body.

   **Azione:** Rimuovere l'import di `useRestaurantLogic` da RestaurantDashboard.tsx (riga 65) se non viene usato.

2. **Consolidare le subscription in CustomerMenu.tsx:**
```typescript
// PRIMA: 7 canali separati (righe 431, 648, 703, 1076, 1113, 1287, 1301)
// Canale 1: table-activity-watch (tables)
// Canale 2: customer-session-watch (table_sessions)
// Canale 3: restaurant-settings-watch (restaurants)
// Canale 4: orders-watch (orders per sessionId)
// Canale 5: cart-watch (cart_items per sessionId)
// Canale 6: orders:sessionId (DUPLICATO del canale 4!)
// Canale 7: order-items-watch (order_items per restaurantId)

// DOPO: 1 canale unico
useEffect(() => {
  if (!sessionId || !restaurantId) return

  const channel = supabase
    .channel(`customer:${sessionId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders',
      filter: `table_session_id=eq.${sessionId}`
    }, handleOrderChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'cart_items',
      filter: `session_id=eq.${sessionId}`
    }, handleCartChange)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'order_items',
      filter: `restaurant_id=eq.${restaurantId}`
    }, handleItemStatusChange)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'table_sessions',
      filter: `id=eq.${sessionId}`
    }, handleSessionChange)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [sessionId, restaurantId])
```

3. **Rimuovere la subscription duplicata `orders:${sessionId}` (riga 1282-1294 di CustomerMenu.tsx):**
   È identica a `orders-watch:${sessionId}` (riga 1071-1090). Rimuovere una delle due.

4. **Consolidare le subscription in RestaurantDashboard:**
   Sostituire le 7 `useSupabaseData` con un singolo canale + fetch iniziale:
```typescript
// Un solo canale per tutto il dashboard
useEffect(() => {
  if (!restaurantId) return

  const channel = supabase
    .channel(`dashboard:${restaurantId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders',
      filter: `restaurant_id=eq.${restaurantId}`
    }, handleOrdersChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'dishes',
      filter: `restaurant_id=eq.${restaurantId}`
    }, handleDishesChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'tables',
      filter: `restaurant_id=eq.${restaurantId}`
    }, handleTablesChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'table_sessions',
      filter: `restaurant_id=eq.${restaurantId}`
    }, handleSessionsChange)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [restaurantId])
```

---

## PROBLEMA 16: RestaurantDashboard.tsx — 4230 righe, 90+ useState

**Dove:** `RestaurantDashboard.tsx` — righe 93-705: 90+ dichiarazioni `useState`

**Impatto:** Ogni cambio di stato ri-renderizza l'intero componente (4230 righe di JSX). Tab non visibili (Analytics, Settings, PDF export) vengono comunque processate.

**Soluzione — Spezzare in componenti separati:**

```
src/components/dashboard/
├── RestaurantDashboard.tsx    (shell + routing tabs, ~200 righe)
├── OrdersTab.tsx              (gestione ordini, ~500 righe)
├── TablesTab.tsx              (gestione tavoli, ~400 righe)
├── MenuTab.tsx                (gestione piatti/categorie, ~500 righe)
├── KitchenTab.tsx             (vista cucina - già esiste KitchenView.tsx)
├── ReservationsTab.tsx        (prenotazioni - già esiste ReservationsManager.tsx)
├── AnalyticsTab.tsx           (analytics - già esiste AnalyticsCharts.tsx)
├── SettingsTab.tsx            (impostazioni - già esiste SettingsView.tsx)
├── ExportMenuDialog.tsx       (export PDF menu, ~200 righe)
└── hooks/
    ├── useDashboardData.ts    (fetch dati + subscription centralizzata)
    └── useDashboardSettings.ts (tutti i settings state)
```

**Esempio di `useDashboardData.ts`:**
```typescript
export function useDashboardData(restaurantId: string) {
  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [sessions, setSessions] = useState<TableSession[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch iniziale parallelo
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [ordersRes, tablesRes, sessionsRes, dishesRes, catsRes, roomsRes, restRes] =
      await Promise.all([
        DatabaseService.getOrders(restaurantId),
        DatabaseService.getTables(restaurantId),
        supabase.from('table_sessions').select('*').eq('restaurant_id', restaurantId).eq('status', 'OPEN'),
        DatabaseService.getDishes(restaurantId),
        DatabaseService.getCategories(restaurantId),
        DatabaseService.getRooms(restaurantId),
        supabase.from('restaurants').select('*').eq('id', restaurantId).single()
      ])
    // set tutti gli stati...
    setLoading(false)
  }, [restaurantId])

  // 1 singola subscription
  useEffect(() => {
    // ...canale unico come descritto nel problema 15
  }, [restaurantId])

  return { orders, tables, sessions, dishes, categories, rooms, restaurant, loading, setOrders, ... }
}
```

---

## PROBLEMA 17: Import pesanti non lazy-loaded

**Dove:**
- `RestaurantDashboard.tsx` riga 62: `import jsPDF from 'jspdf'` — ~400KB
- `RestaurantDashboard.tsx` riga 63: `import html2canvas from 'html2canvas'` — ~200KB
- `ReservationsManager.tsx` riga 21: `import jsPDF from 'jspdf'`
- `AnalyticsCharts.tsx` riga 14: `import jsPDF from 'jspdf'`
- `CustomerMenu.tsx` riga 72: `import { SortableContext, ... } from '@dnd-kit/sortable'` — ~80KB

**Impatto:** Ogni utente scarica ~700KB in più di JavaScript che usa solo raramente (export PDF). I clienti scaricano `@dnd-kit` che serve solo per riordinare le portate nel carrello.

**Soluzione:**

1. **Lazy-load jsPDF e html2canvas:**
```typescript
// PRIMA (RestaurantDashboard.tsx riga 62-63):
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// DOPO — import dinamico solo quando serve:
// Rimuovere le righe 62-63
// Nel gestore dell'export:
const handleExportPdf = async () => {
  setIsExportingMenu(true)
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas')
  ])
  // ... usa jsPDF e html2canvas
  setIsExportingMenu(false)
}
```

2. **Lazy-load @dnd-kit in CustomerMenu.tsx:**
```typescript
// PRIMA (riga 72-73):
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// DOPO — wrap il componente carrello in React.lazy:
const SortableCart = React.lazy(() => import('./SortableCart'))

// Nel JSX:
<React.Suspense fallback={<div>...</div>}>
  <SortableCart items={cart} onReorder={handleReorder} />
</React.Suspense>
```

3. **Code splitting per tab del dashboard:**
```typescript
// RestaurantDashboard.tsx:
const AnalyticsCharts = React.lazy(() => import('./AnalyticsCharts'))
const ReservationsManager = React.lazy(() => import('./ReservationsManager'))
const CustomMenusManager = React.lazy(() => import('./CustomMenusManager'))
const SettingsView = React.lazy(() => import('./SettingsView'))

// Nel JSX:
{activeTab === 'analytics' && (
  <React.Suspense fallback={<Spinner />}>
    <AnalyticsCharts ... />
  </React.Suspense>
)}
```

---

## PROBLEMA 18: Query sequenziali invece di parallele

**Dove:**
- `WaiterDashboard.tsx` righe 105-171 `initDashboard`: 9 query sequenziali con `await`
- `CustomerMenu.tsx` righe 1133-1170 `initMenu`: 4 query sequenziali con `await`
- `DatabaseService.ts` righe 148-176 `deleteRestaurant`: 7 delete sequenziali

**Impatto:** WaiterDashboard carica in ~2-3 secondi (9 round-trip × ~300ms). Potrebbe essere ~400ms con parallelismo.

**Soluzione:**

1. **WaiterDashboard.tsx — Parallelizzare initDashboard (righe 105-178):**
```typescript
// PRIMA: 9 query sequenziali
const restMeta = await supabase.from('restaurants').select('*')...
const tbs = await DatabaseService.getTables(rId)
const rms = await DatabaseService.getRooms(rId)
const ds = await DatabaseService.getDishes(rId)
const cats = await DatabaseService.getCategories(rId)
const sess = await supabase.from('table_sessions').select('*')...
const ords = await supabase.from('orders').select('*, items:order_items(*, dish:dishes(*))')...

// DOPO: tutto in parallelo
const [restMeta, tbs, rms, ds, cats, sessRes, ordsRes] = await Promise.all([
  supabase.from('restaurants').select('*').eq('id', rId).single(),
  DatabaseService.getTables(rId),
  DatabaseService.getRooms(rId),
  DatabaseService.getDishes(rId),
  DatabaseService.getCategories(rId),
  supabase.from('table_sessions').select('*').eq('restaurant_id', rId).eq('status', 'OPEN'),
  supabase.from('orders').select('*, items:order_items(*, dish:dishes(*))').eq('restaurant_id', rId).in('status', ['OPEN', 'pending', 'preparing', 'ready', 'served', 'completed', 'CANCELLED'])
])

if (restMeta.data) setRestaurant(restMeta.data as Restaurant)
setTables(tbs)
setRooms(rms)
setDishes(ds)
setCategories(cats)
if (sessRes.data) setSessions(sessRes.data)
if (ordsRes.data) setActiveOrders(ordsRes.data)
```

2. **CustomerMenu.tsx — Parallelizzare initMenu (righe 1144-1170):**
```typescript
// PRIMA: 4 query sequenziali
const { data: tableData } = await supabase.from('tables').select(...)
const { data: restData } = await supabase.from('restaurants').select(...)
const { data: catsData } = await supabase.from('categories').select(...)
const { data: dishesData } = await supabase.from('dishes').select(...)

// DOPO: tutto in parallelo
const [tableRes, restRes, catsRes, dishesRes] = await Promise.all([
  supabase.from('tables').select('restaurant_id, number').eq('id', tableId).single(),
  supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
  supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('order', { ascending: true }),
  supabase.from('dishes').select('*').eq('restaurant_id', restaurantId).eq('is_active', true)
])
```

3. **DatabaseService.ts — Parallelizzare deleteRestaurant (righe 148-176):**
```typescript
// PRIMA: 7 delete sequenziali
await supabase.from('restaurant_staff').delete().eq('restaurant_id', restaurantId)
await supabase.from('orders').delete().eq('restaurant_id', restaurantId)
await supabase.from('table_sessions').delete().eq('restaurant_id', restaurantId)
// ... etc

// DOPO: in parallelo (dopo order_items che dipende da orders)
await supabase.from('order_items').delete().in('order_id', orderIds)
await Promise.all([
  supabase.from('restaurant_staff').delete().eq('restaurant_id', restaurantId),
  supabase.from('orders').delete().eq('restaurant_id', restaurantId),
  supabase.from('table_sessions').delete().eq('restaurant_id', restaurantId),
  supabase.from('bookings').delete().eq('restaurant_id', restaurantId),
  supabase.from('dishes').delete().eq('restaurant_id', restaurantId),
  supabase.from('categories').delete().eq('restaurant_id', restaurantId),
  supabase.from('tables').delete().eq('restaurant_id', restaurantId),
])
```

---

## PROBLEMA 19: Calcoli O(n²) non memoizzati

**Dove:**
- `WaiterDashboard.tsx` riga 235 `getDetailedTableStatus()`: chiamata per ogni tavolo nel render. Dentro fa `sessions.find()` + `activeOrders.filter()` + `.sort()` per ogni tavolo.
- `RestaurantDashboard.tsx` riga 969 `filteredOrders`: `useMemo` presente ma fa nested `.find()` su `dishes` per ogni item.

**Impatto:** Con 50 tavoli × 200 ordini × 5 items = 50.000 confronti PER RENDER. Ogni render dura 100ms+ su mobile.

**Soluzione:**

1. **WaiterDashboard.tsx — Pre-computare una mappa sessioni/ordini:**
```typescript
// Aggiungere queste mappe memoizzate PRIMA del render:
const sessionsByTable = useMemo(() => {
  const map = new Map<string, TableSession>()
  sessions.forEach(s => map.set(s.table_id, s))
  return map
}, [sessions])

const ordersBySession = useMemo(() => {
  const map = new Map<string, Order[]>()
  activeOrders.forEach(o => {
    if (o.status === 'CANCELLED') return
    const existing = map.get(o.table_session_id) || []
    existing.push(o)
    map.set(o.table_session_id, existing)
  })
  return map
}, [activeOrders])

// Riscrivere getDetailedTableStatus usando le mappe:
const getDetailedTableStatus = useCallback((tableId: string) => {
  const session = sessionsByTable.get(tableId) // O(1) invece di O(n)
  if (!session) return { step: 'free', ... }

  const sessionOrders = ordersBySession.get(session.id) || [] // O(1) invece di O(n)
  // ... resto della logica
}, [sessionsByTable, ordersBySession, now])
```

2. **Creare una mappa piatti per ID:**
```typescript
const dishesById = useMemo(() => {
  const map = new Map<string, Dish>()
  dishes.forEach(d => map.set(d.id, d))
  return map
}, [dishes])

// Usare dishesById.get(item.dish_id) invece di dishes.find(d => d.id === item.dish_id)
```

---

## PROBLEMA 20: DishCard non memoizzato

**Dove:** `CustomerMenu.tsx` — il componente DishCard (definito inline o importato) viene ri-renderizzato per ogni piatto ad ogni cambio stato.

**Impatto:** Con 100 piatti, tutti ri-renderizzati ad ogni cambio ricerca, categoria, o stato. Le funzioni inline (`onAdd={(d) => quickAddToCart(d)}`) invalidano React.memo.

**Soluzione:**

1. **Wrappare DishCard con React.memo:**
```typescript
const DishCard = React.memo(({ dish, onAdd, cookingTime, ... }: DishCardProps) => {
  // ... rendering del piatto
})
```

2. **Stabilizzare le callback con useCallback:**
```typescript
// PRIMA:
<DishCard onAdd={(d) => quickAddToCart(d)} />

// DOPO:
const handleQuickAdd = useCallback((dish: Dish) => {
  quickAddToCart(dish)
}, [quickAddToCart]) // quickAddToCart deve essere useCallback a sua volta

<DishCard onAdd={handleQuickAdd} />
```

3. **Virtualizzare la lista piatti con react-window (per 100+ piatti):**
```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={window.innerHeight - 200}
  itemCount={filteredDishes.length}
  itemSize={120}
>
  {({ index, style }) => (
    <div style={style}>
      <DishCard dish={filteredDishes[index]} onAdd={handleQuickAdd} />
    </div>
  )}
</FixedSizeList>
```

---

## PROBLEMA 21: select('*') ovunque

**Dove:** `DatabaseService.ts` — 15+ query usano `.select('*')`
- `getUsers()` riga 7
- `getRestaurants()` riga 19
- `getRooms()` riga 119
- `getStaff()` riga 271
- `getCategories()` riga 396
- `getDishes()` riga 428
- `getTables()` riga 483
- `getActiveSession()` riga 515
- `getBookings()` riga 662
- `getCartItems()` riga 699

**Impatto:** `restaurants` ha ~30 colonne incluso `weekly_coperto`, `weekly_ayce`, `weekly_service_hours` (JSONB pesanti). Ogni `select('*')` trasferisce dati non necessari.

**Soluzione — Selezionare solo le colonne necessarie:**

```typescript
// getRestaurants: solo campi necessari per la lista
async getRestaurants() {
    const { data, error } = await supabase.from('restaurants')
        .select('id, name, address, phone, email, logo_url, is_active, owner_id, waiter_mode_enabled, allow_waiter_payments, waiter_password, cover_charge_per_person, all_you_can_eat')
    ...
}

// getDishes: solo campi per il menu
async getDishes(restaurantId: string) {
    const { data, error } = await supabase.from('dishes')
        .select('id, name, description, price, category_id, image_url, is_active, is_ayce, allergens, exclude_from_all_you_can_eat, "order"')
        .eq('restaurant_id', restaurantId)
    ...
}

// getCartItems: solo campi necessari + join leggera
async getCartItems(sessionId: string) {
    const { data, error } = await supabase.from('cart_items')
        .select('id, session_id, dish_id, quantity, notes, course_number, created_at, dish:dishes(id, name, price, is_ayce)')
        .eq('session_id', sessionId)
    ...
}
```

---

## PROBLEMA 22: useEffect duplicati e setter chiamati 2 volte

**Dove:** `RestaurantDashboard.tsx` righe 708-748 — L'useEffect che sincronizza lo stato del ristorante chiama gli stessi setter DUE VOLTE:
- riga 710 + 732: `setRestaurantName()` chiamato 2 volte
- riga 711 + 729: `setWaiterModeEnabled()` chiamato 2 volte
- riga 712 + 730: `setAllowWaiterPayments()` chiamato 2 volte
- riga 713 + 731: `setWaiterPassword()` chiamato 2 volte
- riga 741: `setWeeklyCoperto()` chiamato 2 volte (identiche)

**Impatto:** Ogni cambio di `currentRestaurant` causa 10+ re-render inutili (2 per ogni setter duplicato).

**Soluzione — Rimuovere i setter duplicati (righe 729-732 e 741):**

```typescript
useEffect(() => {
    if (currentRestaurant) {
      setRestaurantName(currentRestaurant.name)
      setWaiterModeEnabled(currentRestaurant.waiter_mode_enabled || false)
      setAllowWaiterPayments(currentRestaurant.allow_waiter_payments || false)
      setWaiterPassword(currentRestaurant.waiter_password || '')
      setCourseSplittingEnabled(currentRestaurant.enable_course_splitting || false)

      setAyceEnabled(!!currentRestaurant.all_you_can_eat?.enabled)
      setAycePrice(currentRestaurant.all_you_can_eat?.pricePerPerson || 0)
      setAyceMaxOrders(currentRestaurant.all_you_can_eat?.maxOrders || 0)

      const coverCharge = currentRestaurant.cover_charge_per_person
      if (coverCharge !== undefined) {
        setCopertoPrice(coverCharge)
        setCopertoEnabled(coverCharge > 0)
      }

      if (currentRestaurant.lunch_time_start) setLunchTimeStart(currentRestaurant.lunch_time_start)
      if (currentRestaurant.dinner_time_start) setDinnerTimeStart(currentRestaurant.dinner_time_start)

      if (currentRestaurant.weekly_coperto) setWeeklyCoperto(currentRestaurant.weekly_coperto)
      if (currentRestaurant.weekly_ayce) setWeeklyAyce(currentRestaurant.weekly_ayce)
      if (currentRestaurant.weekly_service_hours) setWeeklyServiceHours(currentRestaurant.weekly_service_hours)

      setEnableReservationRoomSelection(currentRestaurant.enable_reservation_room_selection || false)
      setEnablePublicReservations(currentRestaurant.enable_public_reservations !== false)

      setSettingsInitialized(true)
      // RIMOSSI: i setter duplicati che c'erano sotto (righe 729-732, 741)
    }
}, [currentRestaurant])
```

---

## PROBLEMA 23: Memory leak URL.createObjectURL

**Dove:** `RestaurantDashboard.tsx` riga 1562: `URL.createObjectURL(file)` senza mai chiamare `URL.revokeObjectURL()`

**Impatto:** Ogni volta che l'utente seleziona un'immagine per un piatto, viene creato un blob URL che non viene mai rilasciato. Con uso frequente, la memoria del browser cresce.

**Soluzione:**
```typescript
// RestaurantDashboard.tsx — Modificare handleImageChange (riga 1559-1569):
const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0]
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      if (isEdit) {
        // Rilascia il vecchio URL se esiste
        if (editDishData.image && editDishData.image.startsWith('blob:')) {
          URL.revokeObjectURL(editDishData.image)
        }
        setEditDishData(prev => ({ ...prev, image: previewUrl, imageFile: file }))
      } else {
        // Rilascia il vecchio URL se esiste
        if (newDish.image && newDish.image.startsWith('blob:')) {
          URL.revokeObjectURL(newDish.image)
        }
        setNewDish(prev => ({ ...prev, image: previewUrl, imageFile: file }))
      }
    }
}

// Aggiungere cleanup nell'useEffect di unmount:
useEffect(() => {
  return () => {
    if (newDish.image?.startsWith('blob:')) URL.revokeObjectURL(newDish.image)
    if (editDishData.image?.startsWith('blob:')) URL.revokeObjectURL(editDishData.image)
  }
}, [])
```

---

## PROBLEMA 24: Duplicate funzione apply_custom_menu

**Dove:** schema.sql — 2 overload:
- `apply_custom_menu(uuid)` riga 40-63 (singolo parametro)
- `apply_custom_menu(uuid, uuid)` riga 77-106 (doppio parametro)

**Impatto:** La versione a singolo parametro fa una query extra per ottenere `restaurant_id` dal menu. Inoltre nessuna delle due verifica che il chiamante sia staff del ristorante.

**Soluzione:**
```sql
-- Rimuovere la versione a singolo parametro (meno efficiente)
DROP FUNCTION IF EXISTS public.apply_custom_menu(uuid);

-- Aggiornare la versione a doppio parametro con check autorizzazione
CREATE OR REPLACE FUNCTION public.apply_custom_menu(p_restaurant_id uuid, p_menu_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica autorizzazione
  IF NOT public.is_restaurant_staff(p_restaurant_id) THEN
    RAISE EXCEPTION 'Non autorizzato';
  END IF;

  -- Disattiva tutti i piatti
  UPDATE dishes SET is_active = false WHERE restaurant_id = p_restaurant_id;

  -- Attiva solo i piatti del menu
  UPDATE dishes SET is_active = true
  WHERE id IN (SELECT dish_id FROM custom_menu_dishes WHERE custom_menu_id = p_menu_id);

  -- Disattiva tutti i menu, attiva quello selezionato
  UPDATE custom_menus SET is_active = false WHERE restaurant_id = p_restaurant_id;
  UPDATE custom_menus SET is_active = true WHERE id = p_menu_id;
END;
$$;

-- Stessa cosa per reset_to_full_menu
CREATE OR REPLACE FUNCTION public.reset_to_full_menu(p_restaurant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_restaurant_staff(p_restaurant_id) THEN
    RAISE EXCEPTION 'Non autorizzato';
  END IF;

  UPDATE custom_menus SET is_active = false WHERE restaurant_id = p_restaurant_id;
  UPDATE dishes SET is_active = true WHERE restaurant_id = p_restaurant_id;
END;
$$;
```

---

# ORDINE DI ESECUZIONE CONSIGLIATO

| Step | Problema | Tipo | Tempo stimato | Rischio |
|------|----------|------|---------------|---------|
| 1 | #1 RLS Policy blanket | SQL | 2h | ALTO - test attentamente |
| 2 | #2 Password in chiaro | SQL+TS | 1.5h | ALTO |
| 3 | #3 Bug policy (auto-fix con #1) | SQL | 0h | — |
| 4 | #4 Index mancanti | SQL | 30min | BASSO |
| 5 | #9 NOT NULL constraints | SQL | 30min | MEDIO |
| 6 | #10 CHECK/UNIQUE constraints | SQL | 30min | MEDIO |
| 7 | #11 Race condition sessioni | SQL | 15min | BASSO |
| 8 | #12 RPC cooking time fix | SQL | 15min | BASSO |
| 9 | #13 FK CASCADE | SQL | 15min | BASSO |
| 10 | #14 SECURITY DEFINER | SQL | 15min | BASSO |
| 11 | #24 Duplicate apply_custom_menu | SQL | 15min | BASSO |
| 12 | #18 Query parallele | TS | 1h | BASSO |
| 13 | #22 Setter duplicati | TS | 15min | BASSO |
| 14 | #23 Memory leak blob | TS | 15min | BASSO |
| 15 | #21 select('*') → select campi | TS | 1h | MEDIO |
| 16 | #15 Consolidare subscription | TS | 3h | ALTO |
| 17 | #5 order_items update granulare | TS | 1h | MEDIO |
| 18 | #7 Refetch → update granulare | TS | 2h | MEDIO |
| 19 | #19 Mappe O(1) | TS | 1h | BASSO |
| 20 | #20 DishCard memo | TS | 30min | BASSO |
| 21 | #17 Lazy loading import | TS | 1h | BASSO |
| 22 | #16 Splitting RestaurantDashboard | TS | 4h | MEDIO |
| 23 | #6 Paginazione + RPC analytics | SQL+TS | 3h | MEDIO |
| 24 | #8 Archiviazione + pg_cron | SQL | 2h | BASSO |

**Tempo totale stimato: ~25 ore di lavoro**
