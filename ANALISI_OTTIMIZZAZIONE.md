# EASYFOOD - ANALISI COMPLETA E PIANO DI OTTIMIZZAZIONE

> Target: 50-100 ristoranti, decine di piatti per ristorante, centinaia di clienti per ristorante
> Data analisi: 27 Febbraio 2026

---

## INDICE

1. [PROBLEMI CRITICI DI SICUREZZA](#1-problemi-critici-di-sicurezza)
2. [PROBLEMI DATABASE / SQL](#2-problemi-database--sql)
3. [PROBLEMI PERFORMANCE REACT](#3-problemi-performance-react)
4. [PROBLEMI REALTIME & SUBSCRIPTIONS](#4-problemi-realtime--subscriptions)
5. [MEMORY LEAKS](#5-memory-leaks)
6. [SCALABILITÀ](#6-scalabilità)
7. [PIANO DI AZIONE PRIORITIZZATO](#7-piano-di-azione-prioritizzato)

---

## 1. PROBLEMI CRITICI DI SICUREZZA

### 1.1 RLS Policies Completamente Aperte (CRITICO)

**File:** `supabase/schema.sql`
**Problema:** Tutte le tabelle hanno policy `USING (true) WITH CHECK (true)` per `authenticated` e `anon`.

```sql
-- ATTUALE: chiunque può leggere/scrivere TUTTO
CREATE POLICY "Enable all access for all users" ON public.orders
  TO authenticated, anon USING (true) WITH CHECK (true);
-- Ripetuto su: bookings, cart_items, categories, dishes, order_items, orders, tables, etc.
```

**Impatto:** Un cliente del ristorante A può vedere/modificare ordini del ristorante B.

**Soluzione - SQL da applicare su Supabase:**
```sql
-- 1. Rimuovere TUTTE le policy permissive
DROP POLICY IF EXISTS "Enable all access for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.order_items;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.dishes;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.tables;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.cart_items;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.bookings;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.table_sessions;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.restaurants;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.restaurant_staff;

-- 2. Creare policy granulari per ristorante (esempio per orders)
-- LETTURA: solo owner e staff del ristorante
CREATE POLICY "orders_select_staff" ON public.orders FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE r.id = orders.restaurant_id
        AND (
            r.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.restaurant_staff rs
                WHERE rs.restaurant_id = r.id AND rs.user_id = auth.uid()
            )
        )
    )
);

-- LETTURA: clienti vedono solo ordini della propria sessione
CREATE POLICY "orders_select_customer" ON public.orders FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.table_sessions ts
        WHERE ts.id = orders.table_session_id AND ts.status = 'OPEN'
    )
);

-- DISHES: chiunque legge i piatti attivi (menu pubblico)
CREATE POLICY "dishes_select_public" ON public.dishes FOR SELECT USING (is_active = true);

-- DISHES: solo owner/staff modifica
CREATE POLICY "dishes_modify_staff" ON public.dishes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE r.id = dishes.restaurant_id
        AND (r.owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = r.id AND rs.user_id = auth.uid()
        ))
    )
);

-- CART_ITEMS: solo la sessione che li ha creati
CREATE POLICY "cart_items_session" ON public.cart_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.table_sessions ts
        WHERE ts.id = cart_items.session_id AND ts.status = 'OPEN'
    )
);

-- Ripetere pattern simile per OGNI tabella
```

---

### 1.2 Self-Join Bug nelle RLS (CRITICO)

**File:** `supabase/schema.sql`
**Problema:** `rs.restaurant_id = rs.restaurant_id` confronta la colonna con se stessa (sempre true).

```sql
-- BUG ATTUALE
WHERE rs.restaurant_id = rs.restaurant_id AND rs.user_id = auth.uid()
```

**Soluzione:**
```sql
-- CORRETTO: confrontare con la tabella esterna
WHERE rs.restaurant_id = orders.restaurant_id AND rs.user_id = auth.uid()
```

---

### 1.3 Credenziali Supabase Hardcoded (CRITICO)

**File:** `src/lib/supabase.ts:3-5`
```typescript
// ATTUALE: chiave in plaintext nel codice
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://iqilquhkwjrbwxydsphr.supabase.co"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOi..."
```

**Soluzione:**
```typescript
// CORRETTO: solo variabili d'ambiente, nessun fallback
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Check .env file.')
}
```

Inoltre:
- Aggiungere `.env` al `.gitignore` (se non presente)
- Creare `.env.example` con placeholder
- Ruotare la chiave anonima su Supabase Dashboard (quella attuale è compromessa nel repo)

---

### 1.4 Password e Utenti Loggati in Console (CRITICO)

**File:** `src/components/LoginPage.tsx:31-42`
```typescript
// DA RIMUOVERE IMMEDIATAMENTE
console.log('Login attempt:', { username, password })  // PASSWORD IN CHIARO!
console.log('Fetched users:', users)                    // TUTTI GLI UTENTI!
console.log(`Checking user ${u.name}...`, { nameMatch, emailMatch, passwordMatch })
```

**Soluzione:** Rimuovere TUTTI i console.log con dati sensibili. Aggiungere ESLint rule:
```json
// .eslintrc
{
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

---

### 1.5 Password Plaintext Fallback (ALTO)

**File:** `src/utils/passwordUtils.ts:25-26`
```typescript
// Legacy plaintext comparison
return plaintext === storedHash  // PERICOLOSO
```

**Soluzione:**
```typescript
export async function verifyPassword(plaintext: string, storedHash: string): Promise<boolean> {
    if (!storedHash) return false

    // SOLO bcrypt, nessun fallback plaintext
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        return bcrypt.compare(plaintext, storedHash)
    }

    // Se non è bcrypt, forza cambio password
    console.warn('Legacy password detected - force password reset required')
    return false
}
```

Creare migrazione per forzare reset password degli utenti non migrati.

---

### 1.6 PIN Sessione Senza Rate Limiting (ALTO)

**File:** `src/services/DatabaseService.ts:781-802`
**Problema:** PIN a 4 cifre = 10.000 combinazioni, bruteforcabile in secondi.

**Soluzione - Lato Supabase (RPC):**
```sql
CREATE OR REPLACE FUNCTION public.verify_session_pin(
    p_table_id uuid,
    p_pin text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id uuid;
    v_attempts integer;
BEGIN
    -- Rate limiting: max 5 tentativi per tavolo in 10 minuti
    SELECT COUNT(*) INTO v_attempts
    FROM public.pin_attempts
    WHERE table_id = p_table_id
      AND attempted_at > NOW() - INTERVAL '10 minutes';

    IF v_attempts >= 5 THEN
        RAISE EXCEPTION 'Too many PIN attempts. Wait 10 minutes.';
    END IF;

    -- Log tentativo
    INSERT INTO public.pin_attempts (table_id, attempted_at)
    VALUES (p_table_id, NOW());

    -- Verifica PIN
    SELECT id INTO v_session_id
    FROM public.table_sessions
    WHERE table_id = p_table_id
      AND status = 'OPEN'
      AND session_pin = p_pin;

    IF v_session_id IS NULL THEN
        RAISE EXCEPTION 'Invalid PIN';
    END IF;

    RETURN v_session_id;
END;
$$;

-- Tabella per tracking tentativi
CREATE TABLE IF NOT EXISTS public.pin_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_id uuid NOT NULL REFERENCES public.tables(id),
    attempted_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_pin_attempts_lookup ON public.pin_attempts(table_id, attempted_at);
```

---

### 1.7 Nessun CSRF / Rate Limiting su Login (MEDIO)

**File:** `src/components/LoginPage.tsx`
**Soluzione React:**
```typescript
const [loginAttempts, setLoginAttempts] = useState(0)
const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null)

const handleAdminLogin = async () => {
    if (lockoutUntil && new Date() < lockoutUntil) {
        toast.error('Troppi tentativi. Riprova tra qualche minuto.')
        return
    }
    if (loginAttempts >= 5) {
        setLockoutUntil(new Date(Date.now() + 5 * 60 * 1000))
        setLoginAttempts(0)
        toast.error('Account bloccato per 5 minuti.')
        return
    }
    // ... login logic
    // In caso di fallimento:
    setLoginAttempts(prev => prev + 1)
}
```

---

## 2. PROBLEMI DATABASE / SQL

### 2.1 Indici Mancanti per Query Frequenti (CRITICO per performance)

**Impatto stimato a scala:**
- Senza indici: 200-500ms per query sotto carico
- Con indici: 0.1-5ms per query

**SQL da applicare:**
```sql
-- Query menu (ogni cliente che apre l'app)
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_active
    ON public.dishes(restaurant_id, is_active);

-- Query sessioni tavolo (ogni scan QR)
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status
    ON public.table_sessions(table_id, status);

-- Query order items (dashboard cucina/cameriere - eseguita ogni secondo)
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_status
    ON public.order_items(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_dish_id
    ON public.order_items(dish_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at
    ON public.order_items(created_at);

-- Query carrello (ogni aggiunta piatto)
CREATE INDEX IF NOT EXISTS idx_cart_items_session_id
    ON public.cart_items(session_id);

-- Query prenotazioni (filtri per data)
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_datetime
    ON public.bookings(restaurant_id, date_time);

-- Query ordini per sessione
CREATE INDEX IF NOT EXISTS idx_orders_session_status
    ON public.orders(table_session_id, status);

-- Query staff per ristorante (usata in ogni RLS check)
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_restaurant_user
    ON public.restaurant_staff(restaurant_id, user_id);
```

---

### 2.2 NOT NULL Constraints Mancanti (ALTO)

**Problema:** FK nullable permettono record orfani.

```sql
-- Applicare vincoli
ALTER TABLE public.orders ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN table_session_id SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN dish_id SET NOT NULL;
ALTER TABLE public.cart_items ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE public.cart_items ALTER COLUMN dish_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN restaurant_id SET NOT NULL;
```

**ATTENZIONE:** Prima di applicare, verificare che non ci siano record con NULL:
```sql
SELECT COUNT(*) FROM orders WHERE restaurant_id IS NULL;
SELECT COUNT(*) FROM order_items WHERE order_id IS NULL;
-- etc.
```

---

### 2.3 CHECK Constraints Mancanti (ALTO)

```sql
ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_quantity CHECK (quantity > 0);
ALTER TABLE public.cart_items ADD CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0);
ALTER TABLE public.tables ADD CONSTRAINT chk_tables_seats CHECK (seats > 0);
ALTER TABLE public.bookings ADD CONSTRAINT chk_bookings_guests CHECK (guests > 0);
ALTER TABLE public.dishes ADD CONSTRAINT chk_dishes_price CHECK (price >= 0);

-- Vincolo critico: solo 1 sessione OPEN per tavolo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_session_per_table
    ON public.table_sessions(table_id) WHERE status = 'OPEN';

-- Numero tavolo unico per ristorante
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_table_number_per_restaurant
    ON public.tables(restaurant_id, number) WHERE is_active = true;
```

---

### 2.4 Race Condition in get_or_create_table_session (ALTO)

**Problema:** Due clienti che scansionano lo stesso QR simultaneamente creano 2 sessioni.

**Soluzione:**
```sql
CREATE OR REPLACE FUNCTION public.get_or_create_table_session(
    p_table_id uuid,
    p_restaurant_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
    v_pin TEXT;
BEGIN
    -- Verificare che il tavolo appartenga al ristorante
    IF NOT EXISTS (
        SELECT 1 FROM public.tables
        WHERE id = p_table_id AND restaurant_id = p_restaurant_id
    ) THEN
        RAISE EXCEPTION 'Table does not belong to restaurant';
    END IF;

    -- Lock advisory per prevenire race condition
    PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));

    -- Cercare sessione esistente
    SELECT id INTO v_session_id
    FROM public.table_sessions
    WHERE table_id = p_table_id AND status = 'OPEN'
    LIMIT 1;

    IF v_session_id IS NOT NULL THEN
        RETURN v_session_id;
    END IF;

    -- Generare PIN e creare sessione
    v_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    INSERT INTO public.table_sessions (table_id, restaurant_id, session_pin, status)
    VALUES (p_table_id, p_restaurant_id, v_pin, 'OPEN')
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;
```

---

### 2.5 Foreign Key Cascades Mancanti (MEDIO)

```sql
-- Se si cancella un tavolo, le prenotazioni associate vanno gestite
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_table_id_fkey,
    ADD CONSTRAINT bookings_table_id_fkey
    FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;

-- Se si cancella un ristorante, cascata su tutto
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_restaurant_id_fkey,
    ADD CONSTRAINT orders_restaurant_id_fkey
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
    ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.tables
    DROP CONSTRAINT IF EXISTS tables_restaurant_id_fkey,
    ADD CONSTRAINT tables_restaurant_id_fkey
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
```

---

### 2.6 Funzione get_average_cooking_time con Tipo Sbagliato (BUG)

**File:** `supabase/schema.sql`
**Problema:** Parametri `bigint` invece di `uuid`, la funzione non funziona mai.

```sql
-- Eliminare versione bugata
DROP FUNCTION IF EXISTS public.get_average_cooking_time(bigint, bigint);

-- Versione corretta
CREATE OR REPLACE FUNCTION public.get_average_cooking_time(
    p_dish_id uuid,
    p_restaurant_id uuid
) RETURNS integer
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    avg_time integer;
BEGIN
    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (oi.ready_at - oi.created_at)) / 60))::integer
    INTO avg_time
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.dish_id = p_dish_id
      AND o.restaurant_id = p_restaurant_id
      AND oi.ready_at IS NOT NULL
    HAVING COUNT(*) >= 3;

    RETURN COALESCE(avg_time, 0);
END;
$$;
```

---

### 2.7 Archiving Automatico per Dati Storici (MEDIO)

**Problema:** Dopo 1 anno con 100 ristoranti: ~5M sessioni, ~15M ordini, ~50M order_items.

```sql
-- Funzione di archiviazione (già presente in EASYFOOD_MIGRATIONS.sql, da attivare)
CREATE OR REPLACE FUNCTION public.archive_old_sessions(days_old INTEGER DEFAULT 90)
RETURNS TABLE(archived_sessions INTEGER, archived_orders INTEGER, archived_items INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff TIMESTAMPTZ;
    v_sessions INTEGER := 0;
    v_orders INTEGER := 0;
    v_items INTEGER := 0;
BEGIN
    v_cutoff := NOW() - (days_old || ' days')::INTERVAL;

    -- Archivia order_items
    WITH moved_items AS (
        INSERT INTO public.archived_order_items
        SELECT oi.* FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        JOIN public.table_sessions ts ON ts.id = o.table_session_id
        WHERE ts.status = 'CLOSED' AND ts.closed_at < v_cutoff
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_items FROM moved_items;

    -- Archivia orders
    WITH moved_orders AS (
        INSERT INTO public.archived_orders
        SELECT o.* FROM public.orders o
        JOIN public.table_sessions ts ON ts.id = o.table_session_id
        WHERE ts.status = 'CLOSED' AND ts.closed_at < v_cutoff
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_orders FROM moved_orders;

    -- Archivia sessioni
    WITH moved_sessions AS (
        INSERT INTO public.archived_table_sessions
        SELECT * FROM public.table_sessions
        WHERE status = 'CLOSED' AND closed_at < v_cutoff
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_sessions FROM moved_sessions;

    -- Elimina dai live (in ordine corretto per FK)
    DELETE FROM public.order_items WHERE order_id IN (
        SELECT o.id FROM public.orders o
        JOIN public.table_sessions ts ON ts.id = o.table_session_id
        WHERE ts.status = 'CLOSED' AND ts.closed_at < v_cutoff
    );
    DELETE FROM public.orders WHERE table_session_id IN (
        SELECT id FROM public.table_sessions
        WHERE status = 'CLOSED' AND closed_at < v_cutoff
    );
    DELETE FROM public.table_sessions WHERE status = 'CLOSED' AND closed_at < v_cutoff;

    RETURN QUERY SELECT v_sessions, v_orders, v_items;
END;
$$;

-- Attivare pg_cron (richiede abilitazione su Supabase Dashboard > Extensions)
SELECT cron.schedule(
    'archive-old-sessions',
    '0 3 * * *',  -- ogni notte alle 3
    $$SELECT archive_old_sessions(90)$$
);
```

---

## 3. PROBLEMI PERFORMANCE REACT

### 3.1 RestaurantDashboard.tsx - File Monolitico da 4233 righe (CRITICO)

**File:** `src/components/RestaurantDashboard.tsx`
**Problema:** Un singolo file con tutta la logica = re-render massiccio, bundle bloat, impossibile da testare.

**Soluzione - Splitting in componenti:**
```
src/components/restaurant/
  ├── RestaurantDashboard.tsx      (orchestratore, ~200 righe)
  ├── OrdersPanel.tsx              (gestione ordini)
  ├── KitchenView.tsx              (vista cucina)
  ├── TablesPanel.tsx              (gestione tavoli)
  ├── BookingsPanel.tsx            (prenotazioni)
  ├── MenuEditor.tsx               (editor menu/piatti)
  ├── AnalyticsPanel.tsx           (statistiche)
  ├── SettingsPanel.tsx            (impostazioni ristorante)
  └── hooks/
      ├── useOrders.ts             (logica ordini)
      ├── useKitchen.ts            (logica cucina)
      └── useRestaurantData.ts     (data fetching centralizzato)
```

Ogni pannello diventa un componente `React.memo()` con props specifiche.

---

### 3.2 State Management Non Centralizzato (ALTO)

**File:** `src/components/RestaurantDashboard.tsx:89-150`
**Problema:** 20+ useState separati = impossibile sincronizzare, re-render eccessivi.

**Soluzione - Implementare @tanstack/react-query:**

```bash
npm install @tanstack/react-query
```

```typescript
// src/hooks/useRestaurantOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useRestaurantOrders(restaurantId: string) {
    const queryClient = useQueryClient()

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['orders', restaurantId],
        queryFn: () => DatabaseService.getOrders(restaurantId),
        staleTime: 5000,           // cache 5 secondi
        refetchInterval: 30000,    // refetch ogni 30s come fallback
    })

    const { data: pastOrders = [] } = useQuery({
        queryKey: ['pastOrders', restaurantId],
        queryFn: () => DatabaseService.getPastOrders(restaurantId),
        staleTime: 60000,          // cache 1 minuto per ordini passati
    })

    // Mutation con optimistic update
    const updateOrderStatus = useMutation({
        mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
            DatabaseService.updateOrderStatus(orderId, status),
        onMutate: async ({ orderId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['orders', restaurantId] })
            const previous = queryClient.getQueryData(['orders', restaurantId])
            queryClient.setQueryData(['orders', restaurantId], (old: Order[]) =>
                old.map(o => o.id === orderId ? { ...o, status } : o)
            )
            return { previous }
        },
        onError: (_err, _vars, context) => {
            queryClient.setQueryData(['orders', restaurantId], context?.previous)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] })
        },
    })

    return { orders, pastOrders, isLoading, updateOrderStatus }
}
```

---

### 3.3 Nessuna Pagination su getAllOrders (ALTO)

**File:** `src/services/DatabaseService.ts:597-603`
```typescript
// ATTUALE: scarica TUTTO
async getAllOrders() {
    const { data } = await supabase.from('orders').select('*, items:order_items(*, dish:dishes(*))')
    return data
}
```

**Soluzione:**
```typescript
async getOrders(restaurantId: string, options?: {
    page?: number,
    pageSize?: number,
    status?: string[],
    dateFrom?: string,
    dateTo?: string
}) {
    const { page = 1, pageSize = 50, status, dateFrom, dateTo } = options || {}
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
        .from('orders')
        .select('*, items:order_items(*, dish:dishes(name, price))', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .range(from, to)

    if (status?.length) {
        query = query.in('status', status)
    }
    if (dateFrom) {
        query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
        query = query.lte('created_at', dateTo)
    }

    const { data, error, count } = await query
    if (error) throw error
    return { data: data as Order[], total: count || 0, page, pageSize }
}
```

---

### 3.4 Select * Invece di Colonne Specifiche (MEDIO)

**File:** `src/services/DatabaseService.ts` (multipli punti)

```typescript
// ATTUALE: scarica TUTTI i campi
.select('*, items:order_items(*, dish:dishes(*))')

// CORRETTO: solo campi necessari
.select(`
    id, status, total_amount, created_at, table_session_id,
    items:order_items(id, quantity, status, note, course_number, created_at, ready_at,
        dish:dishes(id, name, price, category_id)
    )
`)
```

Riduce il payload del 40-60% per query complesse con join.

---

### 3.5 Mancanza di React.memo su Componenti Lista (MEDIO)

**File:** `src/components/CustomerMenu.tsx:150+`
**Problema:** `SortableDishItem` si re-renderizza ad ogni cambio carrello.

**Soluzione:**
```typescript
const SortableDishItem = React.memo(function SortableDishItem({
    item,
    courseNum,
    theme
}: {
    item: CartItem
    courseNum: number
    theme: typeof MENU_COLORS
}) {
    // ... component logic
}, (prevProps, nextProps) => {
    // Custom comparison per evitare re-render inutili
    return prevProps.item.id === nextProps.item.id
        && prevProps.item.quantity === nextProps.item.quantity
        && prevProps.item.notes === nextProps.item.notes
        && prevProps.courseNum === nextProps.courseNum
})
```

---

### 3.6 Cart Merge con Race Condition (MEDIO)

**File:** `src/services/DatabaseService.ts:715-751`
**Problema:** Fetch + update in 2 step = race condition se 2 clienti aggiungono stesso piatto.

**Soluzione - Usare upsert atomico su Supabase:**

```sql
-- Funzione RPC atomica
CREATE OR REPLACE FUNCTION public.add_to_cart(
    p_session_id uuid,
    p_dish_id uuid,
    p_quantity integer DEFAULT 1,
    p_notes text DEFAULT NULL,
    p_course_number integer DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart_id uuid;
BEGIN
    -- Cerca item esistente con stessi parametri
    SELECT id INTO v_cart_id
    FROM public.cart_items
    WHERE session_id = p_session_id
      AND dish_id = p_dish_id
      AND course_number = p_course_number
      AND COALESCE(notes, '') = COALESCE(p_notes, '')
    FOR UPDATE;  -- Lock per atomicità

    IF v_cart_id IS NOT NULL THEN
        UPDATE public.cart_items
        SET quantity = quantity + p_quantity, updated_at = NOW()
        WHERE id = v_cart_id;
        RETURN v_cart_id;
    ELSE
        INSERT INTO public.cart_items (session_id, dish_id, quantity, notes, course_number)
        VALUES (p_session_id, p_dish_id, p_quantity, p_notes, p_course_number)
        RETURNING id INTO v_cart_id;
        RETURN v_cart_id;
    END IF;
END;
$$;
```

```typescript
// Lato React:
async addToCart(item: CartItemInput) {
    const { data, error } = await supabase.rpc('add_to_cart', {
        p_session_id: item.session_id,
        p_dish_id: item.dish_id,
        p_quantity: item.quantity,
        p_notes: item.notes || null,
        p_course_number: item.course_number || 1
    })
    if (error) throw error
    return data
}
```

---

## 4. PROBLEMI REALTIME & SUBSCRIPTIONS

### 4.1 Subscription Senza Filtro su order_items (ALTO)

**File:** `src/hooks/useCustomerSession.ts:131-142`
**Problema:** Riceve TUTTI gli order_items change events, non solo quelli della sessione.

**Soluzione:**
```typescript
// PRIMA (sbagliato)
const orderItemsSub = supabase
    .channel(`order_items:${session.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, callback)

// DOPO (corretto - filtrare per ordini della sessione)
const orderItemsSub = supabase
    .channel(`order_items:${session.id}`)
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
        filter: `order_id=in.(${orders.map(o => o.id).join(',')})`
    }, callback)
```

---

### 4.2 Mancanza di Debounce su Cart Subscription (ALTO)

**File:** `src/hooks/useCustomerSession.ts:114-119`

```typescript
// PRIMA: refetch immediato per ogni change
.on('postgres_changes', { ... }, async () => {
    const updatedCart = await DatabaseService.getCartItems(session.id)
    setCartItems(updatedCart)
})

// DOPO: con debounce
const cartDebounceRef = useRef<NodeJS.Timeout>()

.on('postgres_changes', { ... }, async () => {
    if (cartDebounceRef.current) clearTimeout(cartDebounceRef.current)
    cartDebounceRef.current = setTimeout(async () => {
        const updatedCart = await DatabaseService.getCartItems(session.id)
        setCartItems(updatedCart)
    }, 300)
})
```

---

### 4.3 WaiterDashboard refreshData Troppo Aggressivo (ALTO)

**File:** `src/components/waiter/WaiterDashboard.tsx:179-189`
**Problema:** Ogni change event su qualsiasi order_item ricarica TUTTI i dati del dashboard.

**Soluzione:**
```typescript
// Usare payload del change event per aggiornare chirurgicamente
.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'order_items',
    filter: `restaurant_id=eq.${restaurantId}`
}, (payload) => {
    // Update solo l'ordine modificato, non tutto
    if (payload.eventType === 'UPDATE') {
        setOrders(prev => prev.map(order => ({
            ...order,
            items: order.items.map(item =>
                item.id === payload.new.id ? { ...item, ...payload.new } : item
            )
        })))
    } else {
        // Solo per INSERT/DELETE fare refetch parziale
        debouncedRefreshOrders()
    }
})
```

---

### 4.4 No Optimistic Updates per Carrello (MEDIO)

**File:** `src/hooks/useCustomerSession.ts:153-167`

```typescript
const addToCart = async (dish: Dish, quantity: number, notes?: string) => {
    if (!session) return

    // Optimistic update PRIMA della risposta DB
    const tempId = crypto.randomUUID()
    const optimisticItem = {
        id: tempId,
        session_id: session.id,
        dish_id: dish.id,
        dish, // include dish per display
        quantity,
        notes,
        course_number: 1,
        created_at: new Date().toISOString()
    }
    setCartItems(prev => [...prev, optimisticItem])

    try {
        await DatabaseService.addToCart({
            session_id: session.id,
            dish_id: dish.id,
            quantity,
            notes
        })
        // Il realtime aggiornerà con l'ID reale
    } catch (error) {
        // Revert optimistic update
        setCartItems(prev => prev.filter(item => item.id !== tempId))
        toast.error('Errore durante l\'aggiunta al carrello')
    }
}
```

---

## 5. MEMORY LEAKS

### 5.1 Subscription Channels Non Puliti (ALTO)

**File:** `src/hooks/useCustomerSession.ts:104-150`
**Problema:** Se session cambia velocemente, vecchi channels restano aperti.

**Soluzione:**
```typescript
const channelsRef = useRef<RealtimeChannel[]>([])

useEffect(() => {
    if (!session) return

    // Pulire channels precedenti
    channelsRef.current.forEach(ch => supabase.removeChannel(ch))
    channelsRef.current = []

    const cartSub = supabase.channel(`cart:${session.id}`).on(...).subscribe()
    const ordersSub = supabase.channel(`orders:${session.id}`).on(...).subscribe()
    const orderItemsSub = supabase.channel(`order_items:${session.id}`).on(...).subscribe()

    channelsRef.current = [cartSub, ordersSub, orderItemsSub]

    return () => {
        channelsRef.current.forEach(ch => supabase.removeChannel(ch))
        channelsRef.current = []
    }
}, [session?.id]) // Dipendenza su session.id, non session object
```

---

### 5.2 Timer Re-render Globale (BASSO)

**File:** `src/components/waiter/WaiterDashboard.tsx:98-102`
**Problema:** `setInterval` ogni 60s causa re-render dell'intero dashboard.

**Soluzione:** Isolare il timer in un componente dedicato:
```typescript
// Componente dedicato per il tempo
const TimeDisplay = React.memo(function TimeDisplay({ createdAt }: { createdAt: string }) {
    const [elapsed, setElapsed] = useState('')

    useEffect(() => {
        const update = () => {
            const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
            setElapsed(`${mins}min`)
        }
        update()
        const interval = setInterval(update, 60000)
        return () => clearInterval(interval)
    }, [createdAt])

    return <span>{elapsed}</span>
})
```

---

### 5.3 HTML2Canvas Memory su Menu Grandi (BASSO)

**File:** `src/utils/pdfUtils.ts:136-250`

**Soluzione:**
```typescript
// Aggiungere cleanup esplicito del canvas
const canvas = await html2canvas(element, { scale, useCORS: true, backgroundColor, logging: false })
const imgData = canvas.toDataURL('image/png')

// Cleanup canvas dalla memoria
canvas.width = 0
canvas.height = 0

// ... generare PDF ...

// Esplicitamente liberare
URL.revokeObjectURL(imgData)
```

---

## 6. SCALABILITÀ

### 6.1 Implementare Connection Pooling (per 50-100 ristoranti)

Supabase ha limiti di connessioni. Con 100 ristoranti × 5 device = 500 connessioni.

**Configurare su Supabase Dashboard:**
1. Abilitare **PgBouncer** (Database > Settings > Connection Pooling)
2. Usare la `pooling connection string` invece della diretta
3. Impostare pool mode: `transaction`

---

### 6.2 Implementare Caching Layer (MEDIO)

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,     // 5 minuti default
            gcTime: 30 * 60 * 1000,        // garbage collect dopo 30 min
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
            refetchOnWindowFocus: false,    // evitare refetch ogni tab switch
        },
    },
})
```

---

### 6.3 Database Monitoring

```sql
-- Query per monitorare le tabelle in crescita
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE(table_name text, row_count bigint, total_size text)
LANGUAGE sql
AS $$
    SELECT
        schemaname || '.' || relname as table_name,
        n_live_tup as row_count,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC;
$$;

-- Alert se tabella supera soglia (da chiamare periodicamente)
CREATE OR REPLACE FUNCTION public.check_table_growth()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = 'order_items') > 1000000 THEN
        RAISE WARNING 'order_items exceeded 1M rows - consider archiving';
    END IF;
END;
$$;
```

---

## 7. PIANO DI AZIONE PRIORITIZZATO

### FASE 1 - SICUREZZA (Urgente - 1-2 settimane)

| # | Task | File | Complessità |
|---|------|------|-------------|
| 1.1 | Rimuovere console.log con password | LoginPage.tsx | Bassa |
| 1.2 | Rimuovere credenziali hardcoded da supabase.ts | supabase.ts | Bassa |
| 1.3 | Ruotare chiave Supabase (compromessa nel repo) | Supabase Dashboard | Bassa |
| 1.4 | Applicare RLS policies granulari | Supabase SQL | Alta |
| 1.5 | Fixare self-join bug nelle RLS | Supabase SQL | Bassa |
| 1.6 | Rimuovere fallback password plaintext | passwordUtils.ts | Bassa |
| 1.7 | Aggiungere rate limiting su PIN | Supabase SQL + React | Media |
| 1.8 | Aggiungere rate limiting su login | LoginPage.tsx | Bassa |

### FASE 2 - DATABASE (1-2 settimane)

| # | Task | File | Complessità |
|---|------|------|-------------|
| 2.1 | Aggiungere tutti gli indici mancanti | Supabase SQL | Bassa |
| 2.2 | Aggiungere NOT NULL constraints | Supabase SQL | Bassa |
| 2.3 | Aggiungere CHECK constraints + UNIQUE | Supabase SQL | Bassa |
| 2.4 | Fixare get_or_create_table_session (race condition) | Supabase SQL | Media |
| 2.5 | Fixare get_average_cooking_time (tipo sbagliato) | Supabase SQL | Bassa |
| 2.6 | Aggiungere FK cascades corrette | Supabase SQL | Bassa |
| 2.7 | Creare RPC add_to_cart atomica | Supabase SQL + React | Media |
| 2.8 | Attivare archiving automatico | Supabase SQL + pg_cron | Media |

### FASE 3 - PERFORMANCE REACT (2-4 settimane)

| # | Task | File | Complessità |
|---|------|------|-------------|
| 3.1 | Installare @tanstack/react-query | package.json | Bassa |
| 3.2 | Migrare fetching a react-query (orders, dishes) | hooks/ | Alta |
| 3.3 | Aggiungere pagination su ordini | DatabaseService + componenti | Media |
| 3.4 | Ridurre select * a colonne specifiche | DatabaseService.ts | Media |
| 3.5 | Aggiungere React.memo su componenti lista | CustomerMenu, etc. | Media |
| 3.6 | Implementare optimistic updates su carrello | useCustomerSession.ts | Media |

### FASE 4 - REALTIME & STABILITY (1-2 settimane)

| # | Task | File | Complessità |
|---|------|------|-------------|
| 4.1 | Aggiungere filtri specifici su subscriptions | useCustomerSession.ts | Bassa |
| 4.2 | Aggiungere debounce su TUTTE le subscriptions | hooks/ | Bassa |
| 4.3 | Fixare cleanup channels con useRef | useCustomerSession.ts | Bassa |
| 4.4 | Ottimizzare WaiterDashboard refreshData | WaiterDashboard.tsx | Media |
| 4.5 | Isolare timer re-render | WaiterDashboard.tsx | Bassa |

### FASE 5 - REFACTORING (2-4 settimane)

| # | Task | File | Complessità |
|---|------|------|-------------|
| 5.1 | Splittare RestaurantDashboard.tsx | components/restaurant/ | Alta |
| 5.2 | Centralizzare error handling | services/ | Media |
| 5.3 | Aggiungere retry logic su network errors | DatabaseService.ts | Media |
| 5.4 | Configurare PgBouncer su Supabase | Supabase Dashboard | Bassa |
| 5.5 | Aggiungere monitoring tabelle DB | Supabase SQL | Bassa |

---

## STIMA IMPATTO OTTIMIZZAZIONI

| Scenario | Prima | Dopo |
|----------|-------|------|
| Tempo caricamento menu (100 piatti) | ~500ms | ~50ms |
| Dashboard waiter con 50 ordini | ~2s | ~200ms |
| Scan QR con 100 utenti simultanei | Race condition + 300ms | Atomico + 10ms |
| Payload ordini per refresh | ~500KB | ~100KB |
| Subscriptions attive per client | Tutte le tabelle | Solo dati rilevanti |
| Dimensione DB dopo 1 anno | ~50M righe live | ~5M live + archivio |
| Sicurezza multi-tenant | Nessuna (tutto aperto) | RLS per ristorante |
