## UX evaluation: the lottery as it was (e48c442)

Method: Intent's `/evaluate` — Nielsen's ten heuristics, cognitive walkthroughs of the players' and the organizer's
main tasks, and the dark-pattern catalog, on the page as of Bibo4414's commit e48c442, run against a local copy of the
backend with seeded test data, at 390 px and 1440 px. Not covered: screen-reader runs, real-device touch, and real
players (no research exists; every rating below is an expert estimate).

### Anti-pattern verdict: minor issues

A raffle for in-game gold is gambling by design, so the bar is honesty about money and no pressure. The page is clean
of pressure tactics: no fake timers (the countdown is the real draw time), no fabricated scarcity or activity, no
streaks, no nagging. Two money disclosures fall short:

- **Hidden costs, borderline (Medium → P1).** The menu advertises "Ticket price 10 gold" and "50 gold"; the 10%
  fee that makes them 11 and 55 appears only in the purchase box of the raffle page. It is shown before the click, but
  not where players compare the two raffles.
- **Undisclosed withdrawal cost (Medium → P1).** "List Raw Copper for X gold" leaves out that the game takes the
  player's own export tax from that sale, so the player receives less than X.

### Priority issues

**P0 — blocks a task or loses gold**
1. **"Delete all tickets" and "Reset" took players' paid tickets without refunds** (labelled "testing only, NO
   refunds"), and Reset also erased the winners' history. *Fixed in the security pass (refunds, history kept);* the
   redesign still has to keep these away from everyday controls. H5. → `/fortify`.

**P1 — major friction or harm**
2. **The sign-up never asks for the player's Parlamentum name.** Deposits are matched by that name (by hand before,
   by the watcher now); a player who picks another username never gets their copper credited. H2, H5. → `/articulate`.
3. **No way to sign in from the menu.** A visitor sees "Your gold: 0" and Deposit / Withdraw, but the account form
   only appears after opening a raffle, halfway down. H6, H1. → `/organize`, `/journey`.
4. **The withdrawal instruction lived in a 3-second toast.** "List Raw Copper for X gold" was shown once, and the
   player's own waiting withdrawals were never listed (the slot was empty). "For X gold" is also ambiguous: one unit at
   X, or X units at 1? H6, H9, H10. → `/articulate`, `/fortify`. *(The list was filled in the security pass.)*
5. **The organizer's controls act on "the selected lottery", shown only at the top of a long page.** Setting a price,
   pool, sales or draw time on the wrong raffle is one scroll away. H5, H1. → `/organize`.
6. **Organizer tools sit inside the players' page**, after the winners, with "My controls / Unlock my controls"
   visible to every player; for the organizer the page runs to about 5,500 px on a phone. H8, H4. → `/organize`.
7. The two disclosure gaps above (fee on the menu, withdrawal tax). → `/articulate`.

**P2 — degraded but recoverable**
8. The deposit / withdraw tabs don't show which one is open, and the panel opens above the page without a way to
   close it except the same button. H1. → `/fortify`.
9. Buttons have no busy state; a slow call invites a second click (the database now refuses doubles). H1. → `/fortify`.
10. The countdown never ticks; the draw time is entered in UTC but shown in local time. H4, H1. → `/articulate`.
11. "Recent ticket entries" repeats "Your tickets"; "How to play" restates the menu; "Participants" always shows
    "—". H8. → `/organize`.
12. "Player lookup" is a button that only says it doesn't work yet. H9. → remove until built.
13. Developer messages reach the organizer ("Run the ticket-price SQL setup in Supabase first"). H2, H9.
    → `/articulate`.
14. Approved deposits and credits leave the player no history: the balance just changes. H1. → `/fortify`.

**P3 — polish**
15. Emoji stand in for icons in headings (🔐 🎟️ 📜 🏆 💰), and screen readers announce them. → `/include`.
16. White text on the red "Create account" / "Play Grand" buttons is about 3.6:1, under AA for its size. → `/include`.
17. Buttons have no focus style of their own. → `/include`.

### Heuristic verdicts

- **H1 Visibility of system status: broken** — the withdrawal instruction disappears (#4); no busy states (#9).
- **H2 Match with the real world: strained** — the username / game-name mismatch (#2) is P1, so: broken.
- **H3 User control and freedom: holds** — destructive organizer actions ask first; players can't undo a purchase,
  which is normal for a raffle.
- **H4 Consistency and standards: strained** — UTC input vs local display (#10).
- **H5 Error prevention: broken** — wrong-raffle controls (#5), destructive actions beside everyday ones (#1).
- **H6 Recognition rather than recall: broken** — sign-in hidden behind a raffle (#3); deposit amounts typed from
  memory.
- **H7 Flexibility and efficiency: strained** — the organizer scrolls one long page for every task.
- **H8 Aesthetic and minimalist design: broken** — organizer tools in the players' page (#6), repeated sections (#11).
- **H9 Error recovery: strained** — developer messages (#13), dead lookup (#12).
- **H10 Help and documentation: strained** — no help on deposits beyond one paragraph; nothing on how a draw works.

### Cognitive walkthroughs (estimates)

| Task | Hesitation | Failure |
|---|---|---|
| First visit: sign up and buy a Mini ticket | finding sign-up (Q2) | — |
| Deposit gold | which username counts (Q3) | a mismatched name never credits (Q1–Q4) |
| Withdraw gold | what "list for X gold" means (Q3) | instruction gone after 3 s (Q2, Q4) |
| Check last draw's winner | — | — (no way to check fairness before the security pass) |
| Organizer: approve a deposit | cross-checking the trade by hand (Q2) | approving a second request for one trade pays twice (Q4) |
| Organizer: change the Mini's ticket price | — | doing it while the Grand is selected (Q3) |

### Positive findings (protect these)

- The total with the fee is shown before buying, honestly worded.
- The balance is always visible.
- Destructive organizer actions ask for confirmation.
- Everything players type is escaped before display; the toast is a polite live region.
- Two raffles, two prices, one balance: the model is simple and the menu says so.

### Recommended actions (as taken in the design pass)

- `/organize`: separate the organizer's page from the players'; give each raffle its own controls; sign-in reachable
  from everywhere (#3, #5, #6, #11).
- `/articulate`: "your Parlamentum name" at sign-up; full costs on the menu; a withdrawal instruction that says how
  many units at what price and what the game's tax takes; plain organizer messages (#2, #4, #7, #10, #13).
- `/fortify`: busy states, a persistent withdrawal instruction, deposit history, clear tab state (#8, #9, #14).
- `/include`: real icons, contrast, focus styles (#15–#17).
