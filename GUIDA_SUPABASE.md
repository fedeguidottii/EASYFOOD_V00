# Guida Configurazione Supabase (Backend)

Questa guida ti spiegherà passo dopo passo come configurare il "cloud" (Supabase) per la tua applicazione ristorante. Questo permetterà di salvare i dati online e sincronizzarli tra tutti i dispositivi (computer, tablet, telefoni).

## 1. Crea un Progetto su Supabase

1.  Vai sul sito [supabase.com](https://supabase.com).
2.  Clicca su **"Start your project"** e registrati (puoi usare GitHub o email).
3.  Una volta dentro, clicca su **"New Project"**.
4.  Compila il modulo:
    *   **Name**: Scegli un nome (es. `RistoranteApp`).
    *   **Database Password**: Scegli una password sicura (o generala). **Salvala da qualche parte**, anche se per questa guida non ci servirà direttamente, è importante per il futuro.
    *   **Region**: Scegli "Frankfurt" (Germania) o "London" (UK) per avere server vicini all'Italia.
5.  Clicca **"Create new project"**.
6.  Attendi qualche minuto che il progetto sia pronto (vedrai una barra di caricamento).

## 2. Recupera le Chiavi di Accesso

Una volta che il progetto è attivo (verde):

1.  Nel menu a sinistra, clicca sull'icona dell'ingranaggio **(Settings)**.
2.  Clicca su **"API"**.
3.  Troverai due valori importanti:
    *   **Project URL**: Un indirizzo web (es. `https://xyz.supabase.co`).
    *   **Project API keys** -> **anon** / **public**: Una stringa lunga di caratteri.

## 3. Collega l'Applicazione

Ora dobbiamo dire alla tua app dove trovare questo database.

1.  Torna nella cartella del tuo progetto sul computer.
2.  Cerca il file chiamato `.env.example`.
3.  Fai una copia di questo file e rinominala semplicemente `.env` (senza `.example`).
4.  Apri il file `.env` con un editor di testo.
5.  Incolla i valori che hai copiato da Supabase:

```env
VITE_SUPABASE_URL=https://tuo-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=tua-chiave-anon-public-lunghissima
```

6.  Salva il file.

## 4. Prepara il Database (Tabelle)

Ora dobbiamo creare le "stanze" (tabelle) dove verranno salvati i dati (menu, ordini, tavoli).

1.  Torna su Supabase nel browser.
2.  Nel menu a sinistra, clicca sull'icona **"SQL Editor"** (sembra un foglio con `<_>`).
3.  Clicca su **"New query"** (foglio bianco).
4.  Torna nel tuo progetto sul computer e apri il file `supabase_setup.sql`.
5.  Copia **tutto** il contenuto di quel file.
6.  Incolla tutto dentro l'editor SQL di Supabase.
7.  Clicca il bottone **"Run"** (in basso a destra o in alto).
8.  Dovresti vedere un messaggio "Success" o nessuna scritta rossa.

## 5. Riavvia l'Applicazione

1.  Se l'applicazione era aperta nel terminale, fermala (premi `Ctrl + C`).
2.  Riavvia l'applicazione con:
    ```bash
    npm run dev
    ```

## Fatto! 🎉

Ora la tua applicazione è collegata al cloud.
*   Tutti i dati che crei (piatti, tavoli, ordini) verranno salvati su Supabase.
*   Se apri l'app dal telefono (collegato alla stessa rete WiFi) vedrai gli stessi dati del computer.
*   Se ricarichi la pagina, i dati non spariranno.

### Verifica
Prova a creare un nuovo piatto nel menu o un nuovo tavolo. Poi ricarica la pagina. Se il piatto è ancora lì, tutto funziona correttamente!
