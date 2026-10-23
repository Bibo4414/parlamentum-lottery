# parlamentum-lottery

The Parlamentum community lottery: two raffles (Mini and Grand) paid in in-game gold, on GitHub Pages, with Supabase
for accounts, balances and draws.

## Working on it

```bash
npm ci              # once
npm run dev         # http://127.0.0.1:5173, talking to the live Supabase project
npm run build       # type-check, then build into dist/
```

Pushing to `main` builds the site and publishes it (`.github/workflows/pages.yml`). Pages must be set to deploy from
GitHub Actions once: Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## The backend

Supabase holds accounts, balances, tickets and draws. Everything that guards gold is in the database:
`supabase/migrations/` creates the tables, the row-level security rules and the functions the page calls. Clients
only read their own rows; every change to gold goes through one of those functions.

## Running it all on your own machine

Needs Docker running.

```bash
npm run db:start    # local Supabase with the migrations applied
npm run db:seed     # an organizer, four players, tickets and a past draw (passwords: scripts/dev-seed.mjs)
npm run db:env      # point `npm run dev` at the local stack
npm run dev
npm test            # the database tests (local stack only)
```

`npm run db:reset` wipes the local database and re-applies the migrations; `npm run db:types` regenerates
`src/database.types.ts` after a schema change.
