# Migrazione da Lovable al Supabase di proprieta

Stato ricostruito il 18 novembre 2026. La migrazione remota e il cambio backend
non sono stati eseguiti da questa chat.

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
| Supabase nostro, staging storico | `fyrzzuswjgtwoctovker` | `Cali-app/.env.staging.local`, `Cali-app/supabase/config.toml` e registro del 12 settembre | Endpoint non risolto dalla rete di verifica (ENOTFOUND); dashboard richiede accesso |

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

## Accessi ancora mancanti

L'integrazione Supabase e stata individuata e proposta, ma non risulta ancora
collegata. Il browser del progetto di destinazione e al login. Non e disponibile
un export amministrativo dell'origine.

## Documentazione verificata

- [Export database Lovable](https://docs.lovable.dev/features/database-backups.md):
  export con struttura, dati e utenti; file Storage, codice Edge Functions,
  segreti e configurazione dei provider da gestire separatamente.
- [Backup e ripristino Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
