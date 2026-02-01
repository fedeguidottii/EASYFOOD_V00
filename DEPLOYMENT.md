# Guida al Deploy su Vercel

Per pubblicare la tua app e renderla accessibile a tutti, useremo **Vercel**. È gratuito, veloce e perfetto per questo tipo di progetti.

## 1. Preparazione

Assicurati di aver caricato il tuo codice su **GitHub** (Vercel si collega a GitHub per scaricare il codice).

## 2. Collegamento a Vercel

1.  Vai su [vercel.com](https://vercel.com) e registrati (usa il tuo account GitHub).
2.  Clicca su **"Add New..."** -> **"Project"**.
3.  Seleziona il tuo repository GitHub `easyfood_v00` (o come l'hai chiamato) e clicca **"Import"**.

## 3. Configurazione

Vercel rileverà automaticamente che è un progetto **Vite**.

1.  **Framework Preset**: Lascia su `Vite`.
2.  **Root Directory**: Assicurati che sia la cartella dove c'è il `package.json` (se è nella root, lascia vuoto. Se è in una sottocartella come `EASYFOOD_V00`, selezionala).
3.  **Environment Variables**: Qui devi inserire le chiavi di Supabase (come hai fatto nel file `.env`):
    *   **Name**: `VITE_SUPABASE_URL` -> **Value**: `https://iqilquhkwjrbwxydsphr.supabase.co`
    *   **Name**: `VITE_SUPABASE_ANON_KEY` -> **Value**: *(Incolla la tua chiave anonima lunga)*

## 4. Deploy

1.  Clicca su **"Deploy"**.
2.  Attendi circa 1-2 minuti.
3.  Vercel ti darà un link (es. `easyfood-v00.vercel.app`).

## 5. Fatto!

Ora la tua app è online. Puoi stampare i QR Code usando quel link (es. `https://tua-app.vercel.app/?table=uuid-del-tavolo`).
