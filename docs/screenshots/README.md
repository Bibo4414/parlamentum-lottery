# Screenshots

Browser captures of the page, before and after the design pass. Every image is a headless-Chrome capture of the real
page; none is drawn or generated. The names and amounts are local test data from `scripts/dev-seed.mjs` (the
organizer Bibo4414 and the players Aurelia, Marcus_V, Tiberius and Livia Drusa), not real players.

- **before-…**: the page as it was at `e48c442` (`index.html`), served locally against the local Supabase stack with
  the same seed, captured on 22 Oct 2026.
- **after-…**: the `design-pass` branch on 23 Oct 2026, against the same seed with `npm run dev:watcher` running (a
  mock of the game, so deposits show as credited by the watcher).

Phones were captured at 390 px wide (3x) and are stored at 1.5x; desktops at 1440 px; the tablet at 800 px. Long pages
are cut after about 2,600 px.

| What | Before | After |
|---|---|---|
| First screen, phone | [before-menu-phone](before-menu-phone.jpg) | [after-dashboard-visitor-phone](after-dashboard-visitor-phone.jpg) |
| First screen, desktop | [before-menu-desktop](before-menu-desktop.jpg) | [after-dashboard-visitor-desktop](after-dashboard-visitor-desktop.jpg) |
| A player's raffle, phone | [before-mini-player-phone](before-mini-player-phone.jpg) | [after-dashboard-player-phone](after-dashboard-player-phone.jpg) |
| A player's raffle, desktop | [before-mini-player-desktop](before-mini-player-desktop.jpg) | [after-dashboard-player-desktop](after-dashboard-player-desktop.jpg) |
| The wallet, phone | [before-wallet-player-phone](before-wallet-player-phone.jpg) | [after-wallet-deposit-phone](after-wallet-deposit-phone.jpg), [after-wallet-history-phone](after-wallet-history-phone.jpg) |
| The organizer, phone | [before-grand-organizer-phone](before-grand-organizer-phone.jpg) | [after-organizer-phone](after-organizer-phone.jpg) |
| The organizer, desktop | [before-grand-organizer-desktop](before-grand-organizer-desktop.jpg) | [after-organizer-desktop](after-organizer-desktop.jpg), [draws tab](after-organizer-draws-desktop.jpg), [watcher tab](after-organizer-watcher-desktop.jpg) |

New screens with no "before": the dashboard at 800 px ([after-dashboard-player-tablet](after-dashboard-player-tablet.jpg)),
the Draws page with a draw's proof unfolded ([desktop](after-draws-desktop.jpg), [phone](after-draws-phone.jpg)), and
a withdrawal error under its field ([after-wallet-error-phone](after-wallet-error-phone.jpg)).
