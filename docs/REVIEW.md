# Review: TypeScript, backend, security, watcher, economics and design

A pass over the Parlamentum Lottery (github.com/Bibo4414/parlamentum-lottery) as of commit `e48c442`, in six steps,
each on its own local branch built on the one before:

| Branch | What it adds | Commits |
|---|---|---|
| `ts-conversion` | Vite + strict TypeScript, the same page and behaviour; a GitHub Actions deploy to Pages | 3 |
| `backend-as-code` | The Supabase backend in the repo (rebuilt from what the page uses), a local stack, contract tests | 3 |
| `security` | A gold ledger, refunds instead of lost gold, limits, draws anyone can check, a CSP, `audit.sql` | 4 |
| `watcher` | Deposits that credit themselves from the game's trade ledger (an edge function), its panel and schedule | 5 |
| `economics` | `npm run odds` and `docs/profitability.md` | 1 |
| `design-pass` | The organizer's numbers; a redesign in the game's look with two design skills; `DESIGN.md`; this review | 11 |

Everything was built and tested on a local Supabase stack. Nothing has been pushed, deployed or run against the live
project or the real game.

**Bibo4414 pushed two commits while this was being written** (`b64c621`, `e48c442`: players can announce deposits,
up to three at a time; a draw now opens the next one by itself; the Mini's seed is 0; past winners show their lottery
and ticket; a fee-earnings panel; "testing only, no refunds" labels). All branches are rebuilt on `e48c442` and carry
those changes.

## 1. What the lottery is (read before changing anything)

- **One file, no server.** `index.html` (49 KB of inline CSS and script) on GitHub Pages, legacy build from `main`.
  The page talks straight to a Supabase project with its publishable key, which is public by design.
- **The backend wasn't in the repo.** Tables, row-level security, the sign-up trigger and about 17 database functions
  existed only in the Supabase dashboard ("run the SQL I provide separately"). Everything that guards gold was
  invisible to review.
- **Accounts:** Supabase e-mail + password; players without an e-mail get a made-up address derived from their
  username, so e-mail confirmation is off.
- **Gold in:** buy Raw Copper from Bibo4414 at 1.05 a unit on the global market; the organizer checks the trade by hand
  and credits 1 gold a unit (since `b64c621`, the player can also announce the deposit). **Gold out:** the player asks,
  the gold is held, the player lists Raw Copper, the organizer buys it.
- **Draws:** two raffles (Mini 10 gold, Grand 50 gold; a 10% fee on top, rounded up). One ticket wins the whole pool;
  the organizer presses "draw" and the database picks with `random()`.

The UX side is in `docs/ux-evaluation.md`.

## 2. TypeScript (`ts-conversion`)

- `src/main.ts` is the old inline script, line for line, under `strict`, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`; `src/database.types.ts` types every table and function the page calls.
- supabase-js comes from npm, pinned (it was jsDelivr's `@2`, whatever 2.x was newest, without integrity).
- **Proof it didn't change behaviour:** against a local backend with the same data, the menu, a raffle as a visitor,
  as a player and as the organizer rendered **pixel for pixel the same** at 390 and 1440 px, and buying, deposits
  (and their cap), withdrawals, crediting, pricing, closing, drawing and reopening gave the same results.
- `npm run typecheck` and `npm run build` pass on every branch (from `watcher` on, the typecheck also covers the tests and the edge function).

## 3. The backend as code (`backend-as-code`)

`supabase/migrations/20261022120000_lottery_baseline.sql` rebuilds the backend from the page: every table it reads,
every function with the arguments it sends, and the behaviour its texts promise. Where the live version couldn't be
seen, it is written the safe way (clients only read; every write is a `security definer` function with a fixed
`search_path`; organizer functions check the organizer; balances can't go below zero; purchases lock the game row).

**It is a reconstruction.** The live project may differ. `supabase/audit.sql` checks the live project from the inside
(read-only) for the holes this design closes; run it first (see Deploying).

## 4. Security findings and fixes (`security`)

Each fix has functional tests (`tests/baseline.test.ts`, `tests/security.test.ts`, `tests/watcher*.test.ts`; 59 in all).

| # | Finding | Risk | Fix | Tested by |
|---|---|---|---|---|
| S1 | The backend's rules were invisible: RLS, organizer checks, the draw | Any gap there can mint or move gold, and nobody could review it | Backend in the repo; `audit.sql` checks the live one | `audit.sql` flags RLS off, player write policies, unchecked organizer functions (checked by planting them in a rolled-back transaction) |
| S2 | "Delete all tickets" and "Reset" removed paid tickets **without refunds**; Reset also **erased the winners' history** | Players lose gold; the public record can be wiped | Both refund every open ticket (price and fee), take the ticket money out of the pools, keep the history | refunds exact to the gold; history kept |
| S3 | The organizer could set a pool **below the ticket money players paid in** | Ticket money quietly kept | The pool can't go below the open draw's ticket money | `security.test.ts` |
| S4 | "Reopen" could abandon an open draw's tickets | Tickets in a draw that never happens | Refused while the draw has tickets | `security.test.ts` |
| S5 | Credits by hand left **no record**; double approvals of one deposit were only prevented by the organizer's memory | Untraceable minting; paying a deposit twice | A gold ledger: every balance change is a line (who, why, which purchase/request/trade); `gold_mismatches()` lists balances the ledger can't explain; deposits settle once | ledger adds up through every path; a dashboard edit is caught; parallel double clicks settle once |
| S6 | The draw used `random()`: not cryptographic, and **nothing could be checked** afterwards | A draw could be re-rolled or chosen without trace | Commit-reveal: a 32-byte seed from `gen_random_bytes` per draw, only its SHA-256 shown while tickets sell; the winner's place = SHA-256("seed:draw:ticket-list digest") mod tickets; seed and list published after; the browser re-checks it | seed secret until the draw; browser check matches the database; a swapped seed or edited list fails; even spread |
| S7 | Draws could happen before the announced time; organizer accounts could buy tickets | Unfair timing; the organizer can see seeds | Early draws refused unless the time is cleared (visibly); organizer accounts can't buy | `security.test.ts` |
| S8 | Withdrawal requests had no cap | Request spam | Three waiting per player (deposits already had three) | parallel requests |
| S9 | supabase-js from an unpinned CDN; no Content-Security-Policy | A bad release or injected script runs with players' sessions | Bundled and pinned; a CSP in the built page: own scripts only, connections only to the Supabase project (and, once the design pass removed every inline style, own styles only) | the built page runs buying, drawing and checking with no violation |
| S10 | Usernames vs game names | A player who signs up under another name never gets their deposits | Sign-up asks for "your Parlamentum name"; usernames unique ignoring case; trades nobody can claim are listed for the organizer and never paid later by themselves | `watcher.test.ts` |

**Sessions and cookies.** There are no cookies: supabase-js keeps the session in `localStorage`, so cross-site script is
the risk; the CSP and escaping everything rendered address it. Supabase rotates refresh tokens.

**Rate limits.** Supabase Auth rate-limits sign-ups and sign-ins per IP. Every money path is bounded by the balance and
the per-player caps. The watcher looks at the game at most once a minute however often it's poked; poking it costs
function invocations, not game requests. Add a CAPTCHA on sign-up (Supabase supports hCaptcha/Turnstile) if bots appear.

**Secrets.** The publishable key in the source is meant to be public. The first commit (`6f50b27`, a localStorage demo)
has a **hard-coded organizer password** in client code, still in the public history; the current site doesn't use it, but
if it was ever reused anywhere, change it there. A full scan of the history for other secrets **was blocked** by the
session's safety classifier; run `gitleaks detect --redact` on the repo (or allow it) to close this.

**Residual risk.** The organizer can read each draw's secret seed in the database, so an organizer *could* foresee a draw
(and organizer accounts are barred from buying for that reason). Mixing in a public randomness beacon (drand) at the draw
would remove even that; not built.

## 5. The watcher (`watcher`)

A Supabase Edge Function (`supabase/functions/watcher`) ported from The Back Room casino's watcher (`027826e`) and the
Grow Ur Gold exchange's version:

- The organizer pastes the House's game login (the 7-day token from `localStorage.token` on parlamentum.org) on the
  organizer page (its Watcher tab, after the design pass). The function **seals it** (AES-256-GCM, key `WATCHER_SEAL_KEY`) before storing it in a table no client
  can read; it is never logged or sent back.
- It reads `/api/me`, `/api/trade/ledger` (the last 200 trades), `/api/contracts?box=history` and
  `/api/global-market/mine` with that login. GETs only.
- A global-market sale of the deposit item at the deposit price credits the buyer the ledger's `total − taxPaid`, in
  whole gold; an accepted contract that sends the House gold for the item credits its sender. **Each game trade pays one
  ledger line, enforced by the database.** A deposit request the player made is settled by the trade, at what was really
  paid. A purchase already credited by hand is linked, not paid again; approving a request by hand checks the game first.
- Unknown answer shapes, a refused login (401/403/429) or a web page instead of JSON stop it with the reason shown.
- **When it looks:** a signed-in page load (at most once a minute across everyone), and a pg_cron schedule every 10
  minutes (`supabase/watcher-schedule.sql`; `CRON_SECRET` as a Bearer header, kept in Vault).
- **Terms are settings:** item code (default `COPPER_RAW`), label, tier, price, the House's export and import tax.
  At a 10% export tax the price that makes 1 unit = 1 gold is **1.12**; at 1.05 a 100-unit deposit credits 94.
- Tested against a mock of the game (`tests/mock-game.ts`, `npm run dev:watcher` for a local demo); the schedule was
  tested end to end on the local stack. **The real game was never called.**

## 6. Economics (`economics`)

`npm run odds` and `docs/profitability.md`. The short version, at today's settings and 10% taxes:

- The House's result on a draw is **fees − seed**, whoever wins. The Mini (no seed since `e48c442`) can't lose; the
  **Grand breaks even at 100 tickets a draw** and loses below it.
- A player alone in a Grand draw wins **+495** (55 in, 550 out). At 30 tickets a draw in each raffle, two draws a week,
  the House loses about **33,000 gold a year**; a 5,000 bankroll lasts about 8 weeks.
- Deposits at 1.05 lose money above a 4.76% export tax; every withdrawal costs the House its import tax on top
  (now a setting: players list at X ÷ (1 + import tax)).

**Recommended settings:** Grand seed = half the last Grand draw's fees, at most 500; a Grand draw goes ahead only when
its fees cover its seed (else it moves to the next slot); keep the 10% fee and prices in multiples of 10; deposit price
1.12 at a 10% export tax (1.06 at 5%); withdrawals listed at X ÷ (1 + import tax); keep at least "owed to players" (shown
on the organizer page) in the game. Together these turn −33,077 a year into about +10,900 at 30 tickets a draw. The seed
policy and the minimum are **not built**; they are the organizer's call.

## 7. The design pass (`design-pass`)

**Skills.** Two skill sets the user chose, downloaded only from what their sites link to (impeccable.style → the
`pbakaus/impeccable` repo at tag `cli-v4.7.0`; designwithintent.ai → the `ghaida/intent` v1.7.1 release), read in full
before installing, and installed to `~/.claude/skills/`:

- **Impeccable** (Apache-2.0): `impeccable` with 45 reference files and its `scripts/` (the launcher fetches its engine
  binary from the same GitHub releases and refuses it unless its SHA-256 matches). Its hooks, live mode and doctor were
  not used.
- **Intent** (CC0): 18 skills — intent, articulate, blueprint, evaluate, fortify, include, investigate, journey,
  localize, measure, organize, philosopher, present, specify, storytelling, strategize, transpose, wireframe.

**How they were used.**

1. Intent's `/evaluate` on the page as it was: `docs/ux-evaluation.md` (one P0, six P1s; clean of pressure tactics).
2. Impeccable's `init` wrote `PRODUCT.md` after three questions to the user: phones and desktops equally, a neutral voice,
   players see the pool and their own tickets only.
3. The look was pinned by the brief: the game's own (navy `#070b14`, panels with the game's gold hairline, gold
   `#e3b341`/`#c9971c`, Oswald labels and numerals, Barlow text). Impeccable's surface round dealt three of seven
   candidate layouts and the user chose **one dense dashboard**. The direction contract stays out of the repo, in the
   local `.impeccable/` folder; `DESIGN.md` is what the repo keeps.
4. Built in code; checked at 390, 800 and 1440 px with every state that matters (visitor, new player, short of gold,
   errors, organizer); Impeccable's detector run over every rendered screen (33 findings → 1 advisory, see below).
5. A fresh finish reviewer judged it against the brief: **fix**, with eight material fixes (the draw's seed was never
   shown, a ticket count and a mislabelled column broke the brief's rules, "tell us" copy, the account chip clipped at
   800 px, a dead zone in the wallet panel, an organizer page too long on phones, boxes inside boxes, cramped groups
   and 36 px targets). All eight were applied in one batch and the same screens recaptured; the reviewer then scored
   the batch (verdict below).
6. Impeccable's documenter recorded the built system in `DESIGN.md` and turned up two accessibility misses the review
   hadn't: a field's outline at 1.6:1 against its panel (now 3.4:1, over the 3:1 WCAG 2.2 asks) and the quantity
   buttons' focus ring clipped by their group (now drawn inside). Both are fixed, and every colour is now a token.

**What changed for players.**

- One dashboard: both pools with live countdowns, the price *with* the fee, buying in place and the draw's sealed
  fingerprint; your gold with what you're waiting for and your last moves; your tickets; the last winners, each
  re-checked in your browser as it appears; and who the House is. Sign-in is on the dashboard itself.
- Sign-up asks for "your Parlamentum name" and says why: deposits are matched to it.
- A wallet: deposit steps written from the live terms (what 100 units credit), an optional deposit report, withdrawals with
  the exact listing ("List 1 Raw Copper at 136.36 gold") and what the game's tax takes, and the full history of the
  player's gold with the balance after each line.
- Draws: the latest winners, each with a proof stamp that the browser earns by redoing the draw; it unfolds into what
  was checked, the fingerprint shown before the draw and the seed revealed at it (copyable, so anyone can run
  `shasum` on it themselves), and how the check works.
- Errors appear under the field they're about, with the way out ("More than your 495 gold: enter 495 or less");
  buttons show when they're busy; real icons; WCAG AA contrast; 44 px touch targets; a bottom tab bar on phones.

**What changed for the organizer.** A page of their own (players never see it), in three tabs. *Requests*: the
House's numbers (owed to players, fees, ledger mismatches), what is waiting (deposits to credit, withdrawals to pay) and
adding gold by hand. *Draws*: each raffle's controls under its own name (no more "whichever raffle was opened last";
every button and confirm names the raffle), with the irreversible actions apart at the bottom. *Watcher*: its state,
its warnings in one list, the House's login and the deposit terms.

**From the UX evaluation:** P0 #1 and P1 #2–#7 are addressed; of the P2s, the player lookup stub (#12) was removed
rather than built.

**Routes:** `#/` dashboard, `#/wallet/deposit|withdraw|history`, `#/draws` (the old `#/winners` still works),
`#/account`, `#/organizer`, `#/organizer/draws`, `#/organizer/watcher`.

**The finish review's verdict.** Round one: **fix**, with the eight material fixes above. After the batch the same
reviewer scored all eight **resolved**, found three regressions the batch itself had introduced (the two withdrawal
buttons touching when they wrap, a 2 px side stripe on the unfolded proof, a typed "!" on the Watcher tab), and kept
the disposition at **fix** for those three. They were then fixed and checked on fresh captures, together with one more
of the same kind the reviewer couldn't see in its captures (the player's own winning row had a green side edge; it is
a "You" badge now). Impeccable allows two review rounds, so there was no third. The detector's one remaining advisory, a
flat size step between headings, is deliberate: the page's hierarchy is carried by the 64 px pool numerals, the 40 px
balance and the gold buttons, while panel headings use the game's own small uppercase labels.

**Screenshots:** `docs/screenshots/` (before and after at phone, tablet and desktop width; `docs/screenshots/README.md`
says how each was made). All names and amounts in them are local test data.

## 8. Tests

```bash
npm run db:start      # local Supabase (Docker)
npm test              # 59 tests: the contract, the security pass, the watcher end to end
npm run typecheck     # page, tests and edge function
npm run build
```

The tests need only the local stack; they never touch the live project or the real game. Each run starts with the
local watcher off, because `npm run dev:watcher` leaves it on for a day and a hand credit then waits for the game's
trade. Run with the watcher demo stopped: the watcher tests use the same mock-game port.

## 9. Deploying

The order matters: the database first, then the function, then the site. Back up first.

1. **Back up the live database.** `npx supabase db dump --db-url "<connection string>" -f live-schema.sql` and again
   with `--data-only -f live-data.sql` (the connection string is under Project Settings → Database; keep both files out
   of git).
2. **Audit the live project.** Paste `supabase/audit.sql` into the SQL Editor and run it (read-only). Part 2 at the
   bottom prints the live definitions. Any "fix" row is a hole in the live site *today*.
3. **Reconcile, then migrate.** The baseline migration describes the schema the page needs; the live one was made by
   hand and may differ. Compare with part 2's output and adapt where they differ, then `npx supabase link --project-ref
   jbpqrjfpbhautjcgxxjj`, mark the baseline as already applied (`npx supabase migration repair --status applied
   20261022120000`) once the live schema matches it, and `npx supabase db push` for the rest (security, watcher,
   page numbers). Run `audit.sql` again: it should report no "fix" rows.
4. **Auth settings** (Authentication → Providers → Email): minimum password length 8; e-mail confirmation stays off for
   username-only accounts.
5. **The watcher function.** `npx supabase functions deploy watcher --no-verify-jwt`, then set two secrets without
   printing them: `npx supabase secrets set WATCHER_SEAL_KEY="$(openssl rand -base64 48)"` and a `CRON_SECRET` the same
   way, kept somewhere private for step 6. Optional: `ALLOWED_ORIGINS` (default `https://bibo4414.github.io`),
   `GAME_URL` (default `https://parlamentum.org`). The function gets the project URL and secret key from Supabase itself.
6. **The schedule.** In the SQL Editor, run `supabase/watcher-schedule.sql` with the project URL and the `CRON_SECRET`
   filled in (they go into Vault, not git).
7. **GitHub Pages.** Settings → Pages → Build and deployment → Source: **GitHub Actions**, *before* merging (with the
   old setting Pages would publish the unbuilt `index.html`). Then merge; the workflow builds and publishes.
8. **On the site, signed in as the organizer** (Organizer → Watcher): set the deposit terms (check the item code in the
   game; 1.12 at a 10% export tax), paste the House's game login, and watch the first look succeed. Re-paste the login before it runs out
   (the page warns two days ahead).

**Environment variables:** the static site needs none (the project URL and publishable key are in
`src/lib/project.ts`). The edge function needs `WATCHER_SEAL_KEY` and `CRON_SECRET` (and optionally `ALLOWED_ORIGINS`,
`GAME_URL`).

## 10. Not done, or not checkable from here

- The live database was never queried: its real rules are unknown until `audit.sql` runs there.
- The real game was never called: the watcher's item code (`COPPER_RAW`) and the shapes of the game's answers come from
  the casino and the exchange, where the same reader runs against the real game. Whether Parlamentum's Cloudflare admits
  requests from Supabase's servers is untested.
- The git history scan for secrets was blocked (see S-Secrets).
- The economics recommendations (seed from fees, minimum per draw) are documented, not built.
