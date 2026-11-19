# Migrazione da Lovable al Supabase di proprieta

Stato aggiornato il 19 novembre 2026. Il sito usa ancora il backend Lovable.
Importato nello staging nostro il backup completo del 18 novembre, ore 15:24 UTC.
Verificato il contenuto di tutte le 25 tabelle importate con conteggi e impronte
identiche al backup, escluso updated_at applicativo. Il passaggio del sito non e
ancora stato eseguito: occorrono aggiornamento finale, verifica accessi e servizi.

## Obiettivo e riferimenti recuperati

- Trasferire account, dati, file e servizi dal backend gestito da Lovable.
- Recuperare anche gli aggiornamenti intervenuti durante la preparazione.
- Allineare web e app al backend definitivo solo dopo il collaudo della copia.
- Conservare l'origine durante la verifica del nuovo ambiente e il passaggio.
- Continuare sul ramo `codex/2026-11-17-volume-intensita`, senza nuovi rami.

Riferimenti: chat CALI **Analisi del codice** e
`Cali-app/CONSOLIDAMENTO.md`, in particolare le sezioni Vincoli di rilascio,
Candidata del 12 settembre e Database - chiusura verifiche locali.

## Ambienti identificati

| Ambiente | Identificativo | Evidenza | Stato verificato oggi |
| --- | --- | --- | --- |
| Backend originale | `dvjhcdmuuuwepayaatup` | `.env`, `wrangler.toml` e `supabase/config.toml` del web; stesso riferimento nella copia Lovable | API raggiungibile; `volume_tables` e `volume_table_rows` restituiscono PGRST205 |
| Supabase nostro, staging storico | `fyrzzuswjgtwoctovker` | `Cali-app/.env.staging.local`, `Cali-app/supabase/config.toml` e query amministrative | Riattivato, ACTIVE_HEALTHY; copia dati presente |
| Supabase nostro, PoweApp | `nvumgczskawwykddxzth` | Elenco progetti e query amministrative | Riattivato, ACTIVE_HEALTHY; 1 account/profilo, nessuna scheda o pagamento |

### Confronto prima dell’importazione (18 novembre)

Conteggi dello staging ottenuti con `count(*)`, non con le stime delle tabelle.
Conteggi dell'origine letti dalla vista Database del progetto Lovable
`c0dd7586-bb07-41c0-9d0b-22323e4d8d72` (Calisthenics Hub 44).

| Entita | Origine Lovable | Staging nostro |
| --- | ---: | ---: |
| Profili | 46 | 37 |
| Schede | 161 | 89 |
| Esercizi nelle schede | 2983 | 1664 |
| Valutazioni/completamenti | 6508 | 3646 |
| Pagamenti | 124 | 64 |
| Abbonamenti | 58 | 38 |
| Appuntamenti | 168 | 90 |

Nello staging: 39 account Auth, 3 bucket, 0 oggetti Storage; la presenza di
file nell'origine e ancora da verificare. I pagamenti arrivano al 20 luglio,
le valutazioni al 22 luglio; l'ultimo login registrato risale al 4 settembre.
Presenti create-user e reset-user-password. Assenti volume_tables e volume_table_rows.
La tabella migrazioni dello staging e vuota, pur essendo presenti 26 tabelle
pubbliche: non usare la sola cronologia migrazioni per dedurre lo schema applicato.

Il registro storico distingue staging e nuova produzione. Il solo riferimento
allo staging non dimostra che questo sia gia il progetto definitivo o che i dati
siano aggiornati. Verificarne esistenza, disponibilita e destinazione nell'account.

Le chiavi presenti nei file frontend sono pubbliche. Non consentono un backup
amministrativo di utenti, password e intero database. Nessuna chiave e riportata qui.

## Confronto dei sorgenti locali

Questo inventario descrive i file delle repository, non le migrazioni effettivamente
eseguite nei database remoti.

- Web: 24 migrazioni; app: 24 migrazioni.
- 17 migrazioni comuni, con contenuto identico dopo normalizzazione dei fine riga.
- 7 migrazioni presenti solo nel web e 7 solo nell'app.
- `create-user` ha implementazioni diverse; `reset-user-password` e identica.
- `update-user-email` e presente solo nel web.

### Solo nel web

- `20260512084755_801a8cd7-1112-4c77-b9a6-7cfd9ab455dc.sql`
- `20260512090121_d61b31bb-3c26-4f23-83d6-9897ed7bb23b.sql`
- `20260512101904_48dad56e-3fcf-4fcb-8607-2616c56b1a54.sql`
- `20260512102004_ae9d81a9-1490-443a-ac24-cf8bac14a84e.sql`
- `20260701104500_add_payment_billing_month.sql`
- `20260708120000_archive_subscriptions.sql`
- `20261113120000_volume_intensity_tables.sql`

### Solo nell'app

- `20260721094500_add_timer_audio_cues.sql`
- `20260722120000_add_segretaria_role.sql`
- `20260903100000_course_booking_engine.sql`
- `20260904150000_course_confirmation_deadline.sql`
- `20260905090000_protect_profile_identity.sql`
- `20260908090000_workout_completion_ownership.sql`
- `20260911090000_course_capacity_guards.sql`

## Prossime operazioni, nell'ordine

1. Ripristinare l'accesso amministrativo al Supabase nostro e al progetto Lovable
   originale. Identificare il progetto definitivo, distinto dalle prove.
2. Inventariare schema reale, RLS, funzioni, Auth, bucket, file, servizi esterni,
   configurazione email e job. Rilevare anche eventuali dati esclusivi gia presenti
   nella destinazione e definire come conservarli in caso di conflitto.
3. Esportare il database originale completo e proteggere anche lo stato della
   destinazione. Provare il ripristino su una copia prima di importare nell'ambiente
   destinato all'uso reale.
4. Trasferire utenti conservando gli identificativi e verificando i login; copiare
   separatamente i file mantenendo bucket e percorsi. Riconfigurare segreti e
   servizi amministrativi senza inserirli nel frontend o in Git.
5. Confrontare la copia con le migrazioni delle due repository, colmare le
   differenze necessarie e applicare le tabelle Volume & Intensita alla destinazione.
   Non eseguire indiscriminatamente entrambi gli storici sopra uno schema ripristinato.
6. Verificare conteggi, relazioni, file, permessi per ruolo, creazione/reset/cambio
   email utenti, pagamenti, schede, prenotazioni e salvataggio delle tabelle.
7. Recuperare gli aggiornamenti successivi al primo export con una procedura
   concordata per le scritture durante il passaggio; verificare nuovamente i dati.
8. Aggiornare insieme configurazione web/Cloudflare e app: URL, chiave pubblica,
   project ref, endpoint di funzioni e riferimenti ai file. Verificare il sito dopo
   la build e la configurazione dell'app distribuita.
9. Dismettere Lovable solo dopo la verifica del passaggio e del recupero dati.

## Accessi ed esportazione

L'integrazione Supabase e ora collegata e consente di gestire PoweApp e Staging.
Entrambi erano sospesi e sono stati riattivati per ispezionare la copia esistente;
query amministrative eseguite dopo ACTIVE_HEALTHY. Health advisors senza avvisi.

La richiesta amministrativa a `dvjhcdmuuuwepayaatup` viene rifiutata per mancanza
di permessi. L'accesso all'origine e invece disponibile dalla sessione browser
Lovable gia autenticata. Sono state aperte le impostazioni di esportazione,
senza modificare codice o dati applicativi originali.

L’esportazione completa e stata autorizzata esplicitamente dall’utente, quindi
eseguita nello Storage privato dell’origine e scaricata. Il file originale e in
Downloads: urban-flow-gym_261118.backup.zip. La copia di lavoro, i dati Auth e il
backup della destinazione sono nella cartella privata temporanea locale
calisthenics-migration-20261119; nessun dato o hash password va aggiunto a Git.

Nella cronologia Git sono presenti `83448c0` (finalize staging migration and mobile
QA) in Cali-app e `fdf75f5` (sync definitive web app with mobile platform) nel
ramo remoto web di sincronizzazione. Documentano lavoro pregresso sul codice;
il confronto dei dati effettivi va completato dopo la riattivazione.

## Documentazione verificata

- [Export database Lovable](https://docs.lovable.dev/features/database-backups.md):
  export con struttura, dati e utenti; file Storage, codice Edge Functions,
  segreti e configurazione dei provider da gestire separatamente.
- [Backup e ripristino Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Operazioni concluse il 19 novembre

- Backup privato prima della sincronizzazione: 30 tabelle, 6309 record.
- Ripristino locale del backup originale e validazione dei vincoli di destinazione.
- Prova locale della fusione con i dati precedenti dello staging, riuscita.
- Importazione: 49 utenti e identita originali, 46 profili, 161 schede, 2983
  esercizi delle schede, 6509 valutazioni, 124 pagamenti, 58 abbonamenti,
  168 appuntamenti, 861 note di valutazione, 314 turni e altre tabelle originali.
- Conservati i record esclusivi della destinazione e i campi aggiunti dall’app.
- Account admin duplicato: utente ha scelto quello del sito originale. Conservati
  UUID e hash password originali; account amministrativo dello staging archiviato
  con email tecnica non recapitabile, ban permanente e ruolo privo dei permessi admin.
  Originali di quell’account conservati nel backup locale prima della modifica.
- Confronto di contenuto: tutte le 25 tabelle originali importate hanno la stessa
  impronta del backup (timestamp normalizzati a UTC; updated_at escluso).
- Applicata migrazione volume_intensity_tables allo staging; aggiunti i grant
  espliciti per authenticated e controllo dell’identita nella funzione ausiliaria.
- Test RLS locali e nello staging, con transazione annullata: admin crea;
  coach assegnato legge e salva; coach estraneo e cliente esclusi; tentativo di
  impersonare l’admin respinto; anon non legge righe. Nessun dato di test conservato.
- Health advisor senza segnalazioni. Security advisor segnala permessi EXECUTE
  su funzioni preesistenti, search_path di course_day_group e protezione password
  compromesse disattivata. Verificare prima del passaggio definitivo.
- L’origine continua a ricevere scritture: vista Lovable successiva all’import
  mostra 2987 esercizi, 6528 valutazioni e 866 note. Recuperare il delta prima
  di cambiare backend; non dichiarare la copia gia allineata in tempo reale.

### Resta da completare

Recupero delta, confronto delle policy e configurazioni Auth/Storage, funzioni
amministrative, prova login con account originale, verifica web/app e piano di
passaggio delle scritture. Nessuna modifica a URL/chiave pubblica del sito finora.

## Delta del 19 novembre e verifiche finali della copia

Snapshot corrente letto dall’editor SQL Lovable con sole SELECT, senza cambiare
schema o dati dell’origine. La copia e ora a 2987 esercizi, 6530 valutazioni e
866 note di valutazione. Importati 32 record nuovi/modificati: 5 esercizi,
22 valutazioni e 5 note; nessuna cancellazione rilevata rispetto al backup.
Verificati checksum dei blocchi delle valutazioni e nuovamente il contenuto di
tutte le 25 tabelle importate: 25 confronti identici, escluso updated_at.
L’origine continua a ricevere scritture: resta necessario un ultimo delta al
momento del passaggio, con gestione coordinata dei client web/app ancora attivi.

Aggiornate nello staging le Edge Functions create-user (supporto segretaria,
JWT richiesto) e update-user-email (prima assente). Reset-user-password presente.
Gli aggiornamenti non inviano email e non cambiano le password degli utenti.

Applicata staging_function_access: revocato EXECUTE anon sulle funzioni
privilegiate, fissato search_path di course_day_group, convertito il lookup Volume
in SECURITY INVOKER. Collaudo Volume remoto nuovamente passato.

### Due operazioni ancora in attesa

1. Auth: integrazione e CLI non hanno accesso alla modifica della configurazione
   Auth. Aperto dashboard Supabase in browser e richiesto login dell’utente.
   Email/password e provider pubblici coincidono; nell’origine signup disabilitato,
   nella destinazione ancora abilitato. Verificare Site URL, redirect, configurazione
   email e protezione password compromesse prima del passaggio.
2. Policy originali: preparata 20261119093950_staging_source_access.sql con
   61 policy di accesso sulle 23 tabelle originali e 9 funzioni del backup.
   Test locali passati, inclusa negazione dell’auto-promozione del cliente.
   Revisione automatica ha rifiutato l’applicazione remota per l’ampiezza della
   modifica dei permessi; autorizzazione specifica richiesta all’utente.
   Questa migrazione NON e stata applicata. Il test sul vecchio staging conferma
   la vulnerabilita: un cliente potrebbe cambiare il proprio ruolo. Tutti i dati
   del test sono stati annullati; verificati 0 account sintetici e ruolo originale
   del cliente invariato. NON usare questo staging come produzione prima del fix.

Nessun nuovo ramo. Nessun cambio backend nel sito o nell’app distribuita.

Verifiche esterne: sito originale HTTP 200; le tre funzioni amministrative
rifiutano richieste senza autenticazione (401); API Volume anonima restituisce
zero righe. Typecheck e build del web passati. Anteprima locale sulla porta 4173
collegata allo staging tramite sole variabili del processo, senza cambiare .env
o wrangler.toml.

## Autorizzazione e applicazione delle policy

L’utente ha autorizzato esplicitamente l’allineamento delle 61 policy sulle
23 tabelle e delle 9 funzioni nello staging. Applicata con successo la migrazione
staging_source_access. Il precedente blocco della revisione automatica e risolto.
Il test remoto ora conferma che il cliente non puo promuoversi amministratore;
modifica del proprio nome consentita e test Volume per tutti i ruoli riusciti.
Transazione di prova annullata. Il sito e ancora collegato a Lovable.

## Volume & Intensita attivate nel database del sito — 19 novembre

Su richiesta esplicita dell’utente di completare autonomamente l’attivazione,
create volume_tables e volume_table_rows anche nel database Lovable attualmente
usato da superpowegym.it (dvjhcdmuuuwepayaatup). Eseguita sola DDL additiva dal
pannello SQL originale: tabelle, indici, 8 policy RLS, grant authenticated e
2 trigger. Helper can_manage_volume_table in SECURITY INVOKER con controllo
user_uuid = auth.uid(). Non applicata la migrazione generale delle funzioni
app-only dello staging all’origine. Cache PostgREST ricaricata con NOTIFY.

Preflight: entrambe assenti, nessuna policy Volume preesistente, helper necessari
presenti con EXECUTE authenticated. Nessuna cancellazione di dati nello script.

Collaudo nel database effettivo: admin crea tabella/riga, coach assegnato legge,
modifica celle e date e crea una tabella; coach estraneo e cliente non leggono o
scrivono; tentativo di impersonare admin respinto; anon escluso. Prova conclusa
con ROLLBACK e controlli 0 account, 0 tabelle e 0 righe di test residui.
Entrambi gli endpoint REST ora rispondono 200: errore PGRST205 risolto.

Il sito continua a usare lo stesso backend. La migrazione finale resta separata.
**Al prossimo delta includere anche volume_tables e volume_table_rows: i nuovi
contenuti Volume inseriti dall’utente vengono ora salvati nell’origine. Non
riutilizzare l’elenco statico delle 25 tabelle del precedente export**, che era
anteriore alla creazione di queste due tabelle.
