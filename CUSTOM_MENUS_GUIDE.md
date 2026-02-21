# Guida Menù Personalizzati - EASYFOOD

## Introduzione
Il sistema di Menù Personalizzati permette ai ristoratori di creare menu specifici e pianificare quando attivarli automaticamente in base al giorno della settimana e all'orario.

## Setup Iniziale

### 1. Eseguire lo script SQL
Eseguire il file `custom_menus_setup.sql` nel database Supabase:
```sql
-- Copia e incolla il contenuto di custom_menus_setup.sql
-- nella SQL Editor di Supabase
```

### 2. Accedere alle Impostazioni
- Aprire la Dashboard Ristoratore
- Andare nella sezione "Impostazioni" (icona ingranaggio)
- Scorrere fino a "Menù Personalizzati"

## Come Usare

### Creare un Menù Personalizzato

1. **Cliccare su "Nuovo Menù"**
2. **Inserire Nome e Descrizione**
   - Nome: es. "Menù Pranzo", "Menù Weekend", "Menù Sera"
   - Descrizione: breve descrizione opzionale

3. **Selezionare i Piatti**
   - Cliccare sul menù creato per aprire l'editor
   - Selezionare i piatti da includere usando le checkbox
   - I piatti selezionati saranno visibili quando il menù è attivo

### Attivare un Menù

**Attivazione Manuale:**
- Cliccare su "Attiva Menù" sulla card del menù desiderato
- Tutti gli altri piatti saranno automaticamente disattivati
- Solo i piatti del menù selezionato saranno visibili ai clienti

**Ripristinare il Menù Completo:**
- Cliccare su "Ripristina Menù Completo" quando un menù è attivo
- Tutti i piatti torneranno ad essere visibili

### Pianificazione Automatica (Futuro)

**Nota:** La pianificazione automatica richiede un sistema di scheduling backend non ancora implementato.

Per ora è possibile:
1. Aggiungere pianificazioni per giorni specifici
2. Specificare pranzo/cena
3. Visualizzare le pianificazioni

**Implementazione Futura:**
- Sistema cron/scheduler che controlla le pianificazioni
- Attivazione automatica dei menu all'orario specificato
- Notifiche quando i menu cambiano

## Funzioni SQL Disponibili

### apply_custom_menu(menu_id UUID)
Attiva un menù personalizzato:
```sql
SELECT apply_custom_menu('uuid-del-menu');
```

### reset_to_full_menu(restaurant_uuid UUID)
Ripristina tutti i piatti:
```sql
SELECT reset_to_full_menu('uuid-del-ristorante');
```

## Struttura Database

### Tabelle
- **custom_menus**: Memorizza i template dei menù
- **custom_menu_dishes**: Collega piatti ai menù
- **custom_menu_schedules**: Definisce quando attivare i menù

### Permessi RLS
Tutte le tabelle hanno Row Level Security abilitato per garantire che ogni ristorante veda solo i propri dati.

## Casi d'Uso

### Esempio 1: Menù Pranzo/Cena
1. Creare "Menù Pranzo" con piatti leggeri
2. Creare "Menù Cena" con piatti completi
3. Attivare manualmente a seconda dell'orario

### Esempio 2: Menù Weekend
1. Creare "Menù Weekend" con piatti speciali
2. Selezionare solo i piatti premium
3. Attivare il venerdì sera e disattivare la domenica sera

### Esempio 3: Menù AYCE Limitato
1. Creare "AYCE Limitato" per All-You-Can-Eat
2. Selezionare solo i piatti inclusi nell'AYCE
3. Attivare quando ci sono prenotazioni AYCE

## Troubleshooting

### I piatti non si attivano/disattivano
- Verificare che le funzioni SQL siano state create correttamente
- Controllare i permessi RLS nel database
- Verificare che `is_active` sia un campo presente nella tabella `dishes`

### Il menù non appare
- Controllare che `restaurantId` sia corretto
- Verificare la connessione al database Supabase
- Controllare la console browser per errori

## Note Tecniche

- I menù usano UUID per gli ID
- Le pianificazioni usano `day_of_week` (0=Domenica, 6=Sabato)
- `meal_type`: 'lunch', 'dinner', 'all'
- Tutte le operazioni sono transazionali
