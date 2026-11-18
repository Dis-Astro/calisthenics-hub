# Calisthenics Webapp

Webapp gestionale per palestra/calisthenics con aree pubbliche, admin, segreteria, coach e clienti. Il backend attuale resta Supabase; il deploy statico produce `dist` per Cloudflare.

## Stack

- React 18 + TypeScript
- Vite 8
- Tailwind CSS + shadcn/Radix
- Supabase Auth, Database, Storage ed Edge Functions
- Cloudflare build da `wrangler.toml`

## Setup locale

```sh
npm install
npm run dev
```

Variabili richieste:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Comandi

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run check
```

## Deploy Cloudflare

Impostazioni consigliate per Cloudflare Pages collegato a GitHub:

- Framework preset: `Vite`
- Install command (se configurabile): `npm ci --no-audit --no-fund`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22.16.0` (pinzata anche in `.node-version`)

Il progetto usa npm e mantiene solo `package-lock.json` come lockfile.
Non aggiungere `bun.lock` o `bun.lockb`: Cloudflare puo' selezionare Bun
durante l'installazione automatica e fallire se il relativo lockfile non e'
aggiornato. Per verificare un'installazione ripetibile usare `npm ci`.

Variabili di ambiente da configurare in Cloudflare Pages, sezione
`Settings > Environment variables`, per Production e Preview:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Dopo averle aggiunte o modificate, avviare un nuovo deploy: Vite incorpora le
variabili `VITE_*` durante la build.

`wrangler.toml` espone `pages_build_output_dir = "./dist"` e le variabili
pubbliche Supabase disponibili a Pages. Il comando di build va comunque
impostato nel pannello Cloudflare Pages, in `Settings > Builds and deployments`,
perche' Cloudflare non lo legge dal `wrangler.toml`.

`public/_redirects` contiene le riscritture delle route React verso `index.html`.

## Note tecniche

Il passaggio dal backend Lovable al Supabase di proprieta e documentato in
[docs/MIGRATION_STATUS.md](docs/MIGRATION_STATUS.md). Il confronto dei file locali
non equivale a una sincronizzazione dei database: il cambio backend resta da
eseguire dopo accesso, backup, ripristino e collaudo.

### Volume & Intensità per il lavoro quotidiano

Le tabelle sono indipendenti dalla creazione delle schede e dei test:

- Admin: aprire il profilo cliente; **Volume & Intensità** si trova direttamente
  sotto le schede di allenamento. Il pulsante in alto scorre a questa sezione.
- Coach: aprire **I miei clienti** e premere **Volume & Intensità** sul cliente assegnato.

E' disponibile anche se il cliente non ha alcuna scheda di allenamento.
Le tabelle non compaiono nell'editor delle schede.

Prima di distribuire il frontend aggiornato, applicare al database Supabase
dell'ambiente scelto la migrazione
`supabase/migrations/20261113120000_volume_intensity_tables.sql`.
La build frontend non applica le migrazioni del database.

Le tabelle sono associate al cliente e condivise tra le sue schede e i suoi test.
Admin e coach assegnato possono modificarle; il cliente non ha accesso.
Le celle, compresa TOT., sono testo libero senza calcoli automatici.
Lo storico mostra inizialmente le righe create nel giorno locale più recente.
In caso di errore di salvataggio, mantenere aperta la pagina e usare “Riprova”.

Verifica sull'ambiente di test: aprire le tabelle anche su un cliente senza schede,
creare una tabella e una riga, modificare date
e valori, ricaricare e verificare la persistenza; controllare lo storico,
la conferma di eliminazione e l'accesso con admin, coach assegnato,
coach non assegnato e cliente.

### Struttura applicazione

- Le route sono caricate in lazy loading da `src/App.tsx`.
- Il database non viene modificato da questa pulizia: le migrazioni Supabase restano in `supabase/migrations`.
- Le Edge Function admin sono in `supabase/functions`.
- Riferimenti per la futura app mobile: `docs/MOBILE_APP_REFERENCE.md`.
