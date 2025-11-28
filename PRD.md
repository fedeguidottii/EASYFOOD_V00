# Restaurant Order Management System

Sistema completo di gestione ordini per ristoranti con accesso multi-ruolo tramite QR code e PIN temporanei.

**Experience Qualities**:
1. **Elegante** - Design raffinato che riflette la qualità del servizio ristorativo
2. **Efficiente** - Flussi operativi rapidi per personale e clienti senza attese
3. **Intuitivo** - Interfaccia immediata che non richiede formazione per essere utilizzata

**Complexity Level**: Complex Application (advanced functionality, accounts)
L'app gestisce tre ruoli distinti con funzionalità avanzate, autenticazione multi-livello, gestione ordini in tempo reale e sistema di PIN dinamici per la sicurezza.

## Essential Features

**Sistema Multi-Ruolo**
- Functionality: Gestione di Amministratori, Ristoratori e Clienti con permessi specifici
- Purpose: Separare le responsabilità e garantire sicurezza dei dati
- Trigger: Login con credenziali o accesso QR+PIN
- Progression: Login → Identificazione ruolo → Reindirizzamento dashboard specifica → Operazioni autorizzate
- Success criteria: Ogni utente accede solo alle funzioni del proprio ruolo

**Gestione Tavoli con PIN Dinamici**
- Functionality: Creazione tavoli con QR code univoci e PIN temporanei rigenerabili
- Purpose: Controllo accessi sicuri senza account clienti
- Trigger: Creazione tavolo da parte del ristoratore
- Progression: Creazione tavolo → Generazione QR → Assegnazione PIN → Comunicazione clienti → Accesso menù
- Success criteria: Solo clienti con PIN valido possono ordinare

**Ordini in Tempo Reale**
- Functionality: Invio istantaneo ordini da cliente a cucina con stati aggiornabili
- Purpose: Coordinamento efficiente tra sala e cucina
- Trigger: Invio ordine da menù digitale
- Progression: Selezione piatti → Conferma ordine → Notifica ristoratore → Aggiornamento stati → Servizio
- Success criteria: Ordini arrivano immediatamente e stati sono sincronizzati

**Menù Digitale Dinamico**
- Functionality: Gestione menù con aggiornamenti istantanei visibili ai clienti
- Purpose: Flessibilità operativa e informazioni sempre aggiornate
- Trigger: Modifica menù da pannello ristoratore
- Progression: Modifica articolo → Salvataggio → Aggiornamento istantaneo → Visibilità clienti
- Success criteria: Modifiche menù appaiono immediatamente sui dispositivi clienti

**Dashboard Analitiche**
- Functionality: Visualizzazione metriche operative e trend del ristorante
- Purpose: Supporto decisionale per ottimizzazione del servizio
- Trigger: Accesso sezione analitiche
- Progression: Login ristoratore → Dashboard → Selezione periodo → Visualizzazione grafici → Insights
- Success criteria: Dati accurati e grafici comprensibili per decision making

## Edge Case Handling

- **PIN Scaduto**: Notifica gentile con richiesta di nuovo PIN al personale
- **Connessione Persa**: Cache locale ordini con sincronizzazione automatica al ripristino
- **Tavolo Occupato**: Prevenzione accessi multipli con gestione sessioni esclusive
- **Menù Vuoto**: Interfaccia informativa con guida per aggiungere primi piatti
- **Ordini Simultanei**: Gestione concorrenza con timestamp e code ordinate
- **QR Danneggiato**: Sistema di recovery tramite codice tavolo manuale

## Design Direction

Il design deve evocare eleganza raffinata e professionalità, ispirandosi all'estetica premium del settore hospitality con un'interfaccia ricca ma ordinata che comunichi qualità e attenzione ai dettagli.

## Color Selection

Custom palette - Palette sofisticata che combina neutrali caldi con accenti dorati per creare un'atmosfera di lusso accessibile e professionalità accogliente.

- **Primary Color**: Oro Caldo (oklch(0.78 0.12 85)) - Comunica prestigio, qualità e attenzione al servizio
- **Secondary Colors**: Grigio Antracite (oklch(0.25 0.01 270)) per testo principale, Crema (oklch(0.96 0.02 85)) per sfondi secondari
- **Accent Color**: Oro Intenso (oklch(0.70 0.15 80)) per call-to-action e elementi interattivi importanti
- **Foreground/Background Pairings**: 
  - Background Principale (Bianco #FFFFFF): Grigio Antracite (oklch(0.25 0.01 270)) - Ratio 16.2:1 ✓
  - Card (Crema oklch(0.96 0.02 85)): Grigio Antracite (oklch(0.25 0.01 270)) - Ratio 15.1:1 ✓
  - Primary (Oro Caldo oklch(0.78 0.12 85)): Grigio Scuro (oklch(0.20 0.01 270)) - Ratio 7.2:1 ✓
  - Accent (Oro Intenso oklch(0.70 0.15 80)): Bianco (oklch(1 0 0)) - Ratio 5.8:1 ✓

## Font Selection

Tipografia che comunica modernità sofisticata e leggibilità ottimale, combinando un sans-serif contemporaneo per chiarezza operativa con dettagli che suggeriscono qualità premium.

- **Typographic Hierarchy**: 
  - H1 (Titoli Principali): Inter Bold/32px/tight letter spacing
  - H2 (Sezioni): Inter SemiBold/24px/normal spacing  
  - H3 (Sottosezioni): Inter Medium/20px/normal spacing
  - Body (Testo Principale): Inter Regular/16px/relaxed line height
  - Caption (Dettagli): Inter Regular/14px/muted color

## Animations

Movimenti sottili e sofisticati che reinforzano la percezione di qualità senza mai interferire con l'efficienza operativa, bilanciando eleganza e funzionalità per un'esperienza fluida.

- **Purposeful Meaning**: Transizioni che guidano l'attenzione tra stati operativi e comunicano feedback immediato
- **Hierarchy of Movement**: Ordini e notifiche hanno priorità animativa, seguiti da navigazione, infine da elementi decorativi

## Component Selection

- **Components**: Card per ordini e menù, Button per azioni primarie, Badge per stati, Dialog per conferme, Input per PIN, Select per categorie, Separator per divisioni sezioni
- **Customizations**: TableGrid component per visualizzazione tavoli, OrderCard con stati colorati, PinInput specializzato, QRGenerator integrato
- **States**: Buttons con hover dorato, Input con focus oro, Badge con colori stati ordine, Card con elevazione su hover
- **Icon Selection**: Bell per notifiche, QrCode per accesso, Users per tavoli, ChefHat per ordini, BarChart per analytics
- **Spacing**: Padding base 16px, gap 12px per liste, 24px per sezioni principali, 32px per separazioni major
- **Mobile**: Stack layout per sezioni, collapsible sidebar, touch-friendly buttons 48px min, swipe gestures per ordini