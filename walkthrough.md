# Unified Login & Routing Walkthrough

## Changes Implemented
- **Unified Login**: A single login form now handles both Admin and Restaurant users.
- **Dynamic Credentials**: Passwords are no longer hardcoded in the component but stored in the `User` object.
- **Role-Based Routing**:
  - `admin` -> Admin Dashboard
  - `restaurant` -> Restaurant Dashboard
  - `customer` -> Customer Menu (via QR/PIN)

## Supabase Setup (New Backend)

To enable the cloud backend, follow these steps:

1.  **Create a Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project.
2.  **Get Credentials**: In your project settings (API), find your `Project URL` and `anon public` key.
3.  **Configure Environment**:
    *   Rename `.env.example` to `.env`.
    *   Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4.  **Initialize Database**:
    *   Go to the SQL Editor in Supabase.
    *   Copy the contents of `supabase_setup.sql` from the project root.
    *   Run the script to create tables and policies.
5.  **Restart App**: Run `npm run dev` again. The app will now use Supabase.

## Verification

### 1. Admin Access
1. Go to the main page.
2. Select "Staff" tab.
3. Enter:
   - Username: `admin`
   - Password: `admin123`
4. **Expectation**: You should see the Admin Dashboard (managing restaurants).

### 2. Restaurant Access
1. Logout (if logged in).
2. Select "Staff" tab.
3. Enter:
   - Username: `demo`
   - Password: `restaurant123`
4. **Expectation**: You should see the Restaurant Dashboard (orders, tables, menu).

### 3. Customer Access (QR Code Flow)
1. Log in as Restaurant (`demo`).
2. Go to "Tavoli" section.
3. "Activate" a table (e.g., Table 1).
4. Note the **PIN** generated.
5. Open a new browser tab with `?table=table-1` (or simulate by logging out and using the "Cliente" tab with "table-1").
6. Enter the PIN.
7. **Expectation**: You should see the Customer Menu.

## 🚀 Come provare l'app rapidamente (Quick Start)

### Opzione 1: Test in Rete Locale (Più Veloce)
Per provare l'app sul tuo telefono senza pubblicarla su internet:
1. Assicurati che il telefono e il computer siano connessi allo **stesso Wi-Fi**.
2. Esegui il comando:
   ```bash
   npm run dev -- --host
   ```
3. Il terminale mostrerà un indirizzo tipo `http://192.168.1.x:5173`.
4. Apri quell'indirizzo sul tuo telefono.

### Opzione 2: Pubblicare su Internet (Gratis)
Puoi usare servizi gratuiti come **Vercel** o **Netlify**.

#### Metodo Vercel (Consigliato)
1. Installa la CLI di Vercel (se non ce l'hai): `npm i -g vercel`
2. Esegui il comando:
   ```bash
   vercel
   ```
3. Segui le istruzioni a schermo (accetta i default).
4. Ti verrà fornito un link `https://...vercel.app` che puoi condividere.

> [!CAUTION]
> **IMPORTANTE: Limitazione dei Dati**
> Questa app usa `useKV` che salva i dati nel **browser** del dispositivo.
> - Se crei un ordine sul tuo telefono, **NON** lo vedrai sul computer del ristorante.
> - Ogni dispositivo ha il suo "database" isolato.
> - Per far funzionare l'app come un vero sistema ristorante (dove il cameriere vede gli ordini del cliente), serve un **Backend Reale** (es. Firebase, Supabase) invece di `useKV`.

## Code Changes
- `src/services/types.ts`: Added `password` field to `User`.
- `src/services/DataInitializer.tsx`: Added default passwords.
- `src/components/LoginPage.tsx`: Implemented dynamic user lookup and validation.

# Waiter Dashboard Refactoring

## Overview
The Waiter Dashboard has been significantly refactored to improve usability and visual consistency with the Restaurant Admin Dashboard.

### Key Features Added
1.  **Visual Overhaul**: Table cards now match the premium dark/amber aesthetic of the main dashboard, with clear status indicators (Seduti, In Attesa, Mangiando) and PIN display.
2.  **Quick Order Dialog**: A new streamlined interface for waiters to quickly take orders.
    *   Searchable menu with category filters.
    *   Quick quantity adjustments and notes.
    *   Instant submission to the kitchen.
3.  **Improved "Piatti Pronti"**: The "Ready to Serve" logic is now more robust.
    *   Filters items based on *active* sessions (ignoring closed tables).
    *   Correctly displays dish names (fetched via Supabase join).
    *   Allows marking items as served individually or by table/dish.

### Technical Improvements
-   **Data Fetching**: Updated queries to fetch `dish` details directly with orders (`items:order_items(*, dish:dishes(*))`).
-   **Status Handling**: Consistent handling of `CANCELLED` orders across the dashboard.
-   **Linting**: Installed missing type definitions for `@phosphor-icons/react` and `sonner`.

### Verification Steps
1.  **Login as Waiter/Restaurant**.
2.  **Open Waiter Dashboard**.
3.  **Check Table Cards**: Verify they look like the admin dashboard cards.
4.  **Quick Order**: Click "Ordina" on an active table, add items, and submit. Check if they appear in the order list.
5.  **Kitchen Interaction**: Mark items as "Ready" in Kitchen View (simulated or real).
6.  **Piatti Pronti**: Verify the "Pronti" button counts up and the drawer shows the correct items with dish names.

