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
