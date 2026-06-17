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

`wrangler.toml` usa:

- install: `npm install --no-audit --no-fund`
- build: `npm run build`
- output: `dist`

## Note tecniche

- Le route sono caricate in lazy loading da `src/App.tsx`.
- Il database non viene modificato da questa pulizia: le migrazioni Supabase restano in `supabase/migrations`.
- Le Edge Function admin sono in `supabase/functions`.
- Riferimenti per la futura app mobile: `docs/MOBILE_APP_REFERENCE.md`.
